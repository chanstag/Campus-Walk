import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, lte, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { asset, assetPhoto, building, room } from "../db/schema.js";
import { blobStore } from "../storage/index.js";
import { authorizedProcedure, router } from "../trpc.js";
import type { Context } from "../trpc.js";

type AssetWithType = Awaited<ReturnType<typeof fetchAssets>>[number];

function fetchAssets(db: Context["db"], where: SQL | undefined) {
  return db.query.asset.findMany({ where, with: { assetType: true } });
}

/** RQB v1 cannot order by a relation's column, so sort by type after the fetch. */
function byTypeThenYear(a: AssetWithType, b: AssetWithType) {
  return (
    a.assetType.category.localeCompare(b.assetType.category) ||
    a.assetType.name.localeCompare(b.assetType.name) ||
    (a.installYear ?? 0) - (b.installYear ?? 0)
  );
}

/** Optional free text; empty strings become null so "cleared" and "never set" look the same. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const condition = z.number().int().min(1).max(5);

/**
 * When the rating was made on the device. Offline writes replay late, so the server keeps the
 * newest tap: a write older than the stored `assessed_at` is ignored. A device clock ahead of the
 * server is clamped to now rather than rejected, so the write is not lost.
 */
const assessedAt = z
  .date()
  .transform((d) => (d > new Date() ? new Date() : d))
  .optional();

/** Descriptive fields shared by create and update. Condition is handled by `assess`. */
const descriptive = {
  assetTag: text(100),
  manufacturer: text(200),
  model: text(200),
  serialNumber: text(200),
  installYear: z.number().int().min(1800).max(2100).nullable().optional(),
  notes: text(2000),
};

/**
 * Where an asset goes: a room, or a building's building level (no room). Exactly one of the two.
 * Building-level covers building systems (roof, HVAC, boiler) and delivered-but-unplaced equipment.
 */
const location = {
  roomId: z.uuid().optional(),
  buildingId: z.uuid().optional(),
};
const oneLocation = (v: { roomId?: string; buildingId?: string }) => (v.roomId == null) !== (v.buildingId == null);
const oneLocationError = { message: "Give exactly one of roomId or buildingId" };

/** Resolves a location to the asset's { roomId, buildingId } columns, or throws NOT_FOUND. */
async function resolveLocation(db: Context["db"], loc: { roomId?: string; buildingId?: string }) {
  if (loc.roomId) {
    const target = await db.query.room.findFirst({ where: eq(room.id, loc.roomId), with: { floor: true } });
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
    return { roomId: target.id, buildingId: target.floor.buildingId };
  }
  const target = await db.query.building.findFirst({ where: eq(building.id, loc.buildingId!) });
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Building not found" });
  return { roomId: null, buildingId: target.id };
}

export async function requireAsset(db: Context["db"], assetId: string) {
  const row = await db.query.asset.findFirst({ where: eq(asset.id, assetId) });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
  return row;
}

export const assetRouter = router({
  byRoom: authorizedProcedure("asset", "read").input(z.object({ roomId: z.uuid() })).query(async ({ ctx, input }) => {
    const rows = await fetchAssets(ctx.db, eq(asset.roomId, input.roomId));
    return rows.sort(byTypeThenYear);
  }),

  /**
   * Assets in a building that are not in any room: building systems (roof, HVAC, boiler)
   * and delivered-but-unplaced equipment. The walk screen shows both together as the
   * building's own assets; assetType.typicallyBuildingLevel tells them apart if needed.
   */
  byBuilding: authorizedProcedure("asset", "read")
    .input(z.object({ buildingId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await fetchAssets(
        ctx.db,
        and(eq(asset.buildingId, input.buildingId), isNull(asset.roomId)),
      );
      return rows.sort(byTypeThenYear);
    }),

  /**
   * Every asset in a campus, rooms and building level alike, sorted like `byRoom`. The walk screen
   * uses it to fill each room's cache in one request so rooms not yet opened work offline.
   */
  byCampus: authorizedProcedure("asset", "read")
    .input(z.object({ campusId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const buildings = ctx.db.select({ id: building.id }).from(building).where(eq(building.campusId, input.campusId));
      const rows = await fetchAssets(ctx.db, inArray(asset.buildingId, buildings));
      return rows.sort(byTypeThenYear);
    }),

  /**
   * Adds an asset to a room (building derived from the room) or to a building's building level.
   * A condition given here counts as an assessment. The client may pick the id (offline creates);
   * repeating a create with the same id returns the existing row instead of inserting twice.
   */
  create: authorizedProcedure("asset", "create")
    .input(
      z
        .object({
          id: z.uuid().optional(),
          ...location,
          assetTypeId: z.uuid(),
          quantity: z.number().int().min(1).default(1),
          condition: condition.nullable().default(null),
          assessedAt,
          ...descriptive,
        })
        .refine(oneLocation, oneLocationError),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const [existing] = await fetchAssets(ctx.db, eq(asset.id, input.id));
        if (existing) return existing;
      }
      const { id, roomId, buildingId, condition: rating, assessedAt: ratedAt, ...rest } = input;
      const placed = await resolveLocation(ctx.db, { roomId, buildingId });
      const [inserted] = await ctx.db
        .insert(asset)
        .values({
          id,
          ...placed,
          condition: rating,
          assessedAt: rating == null ? null : (ratedAt ?? new Date()),
          ...rest,
        })
        // A concurrent replay of the same create lost the race; the row is there either way.
        .onConflictDoNothing({ target: asset.id })
        .returning({ id: asset.id });
      const [created] = await fetchAssets(ctx.db, eq(asset.id, inserted?.id ?? id!));
      return created!;
    }),

  /** Edits descriptive fields. Undefined fields are left alone; null clears. */
  update: authorizedProcedure("asset", "update")
    .input(
      z.object({
        assetId: z.uuid(),
        assetTypeId: z.uuid().optional(),
        quantity: z.number().int().min(1).optional(),
        ...descriptive,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { assetId, ...fields } = input;
      await requireAsset(ctx.db, assetId);
      await ctx.db.update(asset).set(fields).where(eq(asset.id, assetId));
      const [updated] = await fetchAssets(ctx.db, eq(asset.id, assetId));
      return updated!;
    }),

  /**
   * Moves an asset into another room or onto a building's building level, possibly in another
   * building. Building follows the room; condition and notes travel with the asset.
   */
  move: authorizedProcedure("asset", "update")
    .input(z.object({ assetId: z.uuid(), ...location }).refine(oneLocation, oneLocationError))
    .mutation(async ({ ctx, input }) => {
      await requireAsset(ctx.db, input.assetId);
      const placed = await resolveLocation(ctx.db, input);
      await ctx.db.update(asset).set(placed).where(eq(asset.id, input.assetId));
      const [moved] = await fetchAssets(ctx.db, eq(asset.id, input.assetId));
      return moved!;
    }),

  /**
   * Records the current condition. With `assessedAt` (the time of the tap), a write older than the
   * stored rating is ignored and the current row comes back unchanged. assessed_by stays null for now.
   */
  assess: authorizedProcedure("asset", "assess")
    .input(z.object({ assetId: z.uuid(), condition: condition.nullable(), notes: text(2000), assessedAt }))
    .mutation(async ({ ctx, input }) => {
      await requireAsset(ctx.db, input.assetId);
      const ratedAt = input.assessedAt ?? new Date();
      await ctx.db
        .update(asset)
        .set({
          condition: input.condition,
          assessedAt: input.condition == null ? null : ratedAt,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        })
        .where(and(eq(asset.id, input.assetId), or(isNull(asset.assessedAt), lte(asset.assessedAt, ratedAt))));
      const [updated] = await fetchAssets(ctx.db, eq(asset.id, input.assetId));
      return updated!;
    }),

  remove: authorizedProcedure("asset", "delete").input(z.object({ assetId: z.uuid() })).mutation(async ({ ctx, input }) => {
    // Photo rows cascade with the asset; their files have to be removed by hand.
    const photos = await ctx.db.select({ key: assetPhoto.key }).from(assetPhoto).where(eq(assetPhoto.assetId, input.assetId));
    const deleted = await ctx.db.delete(asset).where(eq(asset.id, input.assetId)).returning({ id: asset.id });
    if (deleted.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
    await blobStore.delete(photos.map((p) => p.key));
    return { id: input.assetId };
  }),
});
