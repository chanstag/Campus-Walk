import { TRPCError } from "@trpc/server";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import { z } from "zod";
import { asset, room } from "../db/schema.js";
import { protectedProcedure, router } from "../trpc.js";
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

/** Descriptive fields shared by create and update. Condition is handled by `assess`. */
const descriptive = {
  assetTag: text(100),
  manufacturer: text(200),
  model: text(200),
  serialNumber: text(200),
  installYear: z.number().int().min(1800).max(2100).nullable().optional(),
  notes: text(2000),
};

async function requireAsset(db: Context["db"], assetId: string) {
  const row = await db.query.asset.findFirst({ where: eq(asset.id, assetId) });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
  return row;
}

export const assetRouter = router({
  byRoom: protectedProcedure.input(z.object({ roomId: z.uuid() })).query(async ({ ctx, input }) => {
    const rows = await fetchAssets(ctx.db, eq(asset.roomId, input.roomId));
    return rows.sort(byTypeThenYear);
  }),

  /**
   * Assets in a building that are not in any room: building systems (roof, HVAC, boiler)
   * and delivered-but-unplaced equipment. Split them on assetType.typicallyBuildingLevel.
   */
  byBuilding: protectedProcedure
    .input(z.object({ buildingId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await fetchAssets(
        ctx.db,
        and(eq(asset.buildingId, input.buildingId), isNull(asset.roomId)),
      );
      return rows.sort(byTypeThenYear);
    }),

  /** Adds an asset to a room. Building is derived from the room. A condition given here counts as an assessment. */
  create: protectedProcedure
    .input(
      z.object({
        roomId: z.uuid(),
        assetTypeId: z.uuid(),
        quantity: z.number().int().min(1).default(1),
        condition: condition.nullable().default(null),
        ...descriptive,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.query.room.findFirst({
        where: eq(room.id, input.roomId),
        with: { floor: true },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      const { roomId, assetTypeId, quantity, condition: rating, ...rest } = input;
      const [inserted] = await ctx.db
        .insert(asset)
        .values({
          roomId,
          assetTypeId,
          buildingId: target.floor.buildingId,
          quantity,
          condition: rating,
          assessedAt: rating == null ? null : new Date(),
          ...rest,
        })
        .returning({ id: asset.id });
      const [created] = await fetchAssets(ctx.db, eq(asset.id, inserted!.id));
      return created!;
    }),

  /** Edits descriptive fields. Undefined fields are left alone; null clears. */
  update: protectedProcedure
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

  /** Records the current condition. assessed_by stays null until auth exists. */
  assess: protectedProcedure
    .input(z.object({ assetId: z.uuid(), condition: condition.nullable(), notes: text(2000) }))
    .mutation(async ({ ctx, input }) => {
      await requireAsset(ctx.db, input.assetId);
      await ctx.db
        .update(asset)
        .set({
          condition: input.condition,
          assessedAt: input.condition == null ? null : new Date(),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        })
        .where(eq(asset.id, input.assetId));
      const [updated] = await fetchAssets(ctx.db, eq(asset.id, input.assetId));
      return updated!;
    }),

  remove: protectedProcedure.input(z.object({ assetId: z.uuid() })).mutation(async ({ ctx, input }) => {
    const deleted = await ctx.db.delete(asset).where(eq(asset.id, input.assetId)).returning({ id: asset.id });
    if (deleted.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
    return { id: input.assetId };
  }),
});
