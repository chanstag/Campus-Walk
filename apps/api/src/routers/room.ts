import { TRPCError } from "@trpc/server";
import { and, count, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { asset, floor, room } from "../db/schema.js";
import { authorizedProcedure, router } from "../trpc.js";
import type { Context } from "../trpc.js";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const number = z.string().trim().min(1, "Room number is required").max(20);
const size = z.number().int().min(0).nullable().optional();

/** Descriptive fields shared by create and update. Assessment fields are handled by `finish`. */
const descriptive = {
  /** Empty or missing on create falls back to the room number. */
  name: text(200),
  roomType: text(100),
  areaSf: size,
  capacity: size,
};

/** Room numbers are unique per floor; checked up front for a readable error, the constraint backs it. */
async function requireFreeNumber(db: Context["db"], floorId: string, value: string, exceptRoomId?: string) {
  const clash = await db.query.room.findFirst({
    where: and(eq(room.floorId, floorId), eq(room.number, value), exceptRoomId ? ne(room.id, exceptRoomId) : undefined),
  });
  if (clash) throw new TRPCError({ code: "CONFLICT", message: `Room ${value} already exists on this floor` });
}

export const roomRouter = router({
  /** Adds a room to a floor. Starts unwalked. */
  create: authorizedProcedure("room", "create")
    .input(z.object({ floorId: z.uuid(), number, ...descriptive }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.query.floor.findFirst({ where: eq(floor.id, input.floorId) });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Floor not found" });
      await requireFreeNumber(ctx.db, input.floorId, input.number);
      const { name, ...rest } = input;
      const [created] = await ctx.db
        .insert(room)
        .values({ ...rest, name: name ?? input.number })
        .returning();
      return created!;
    }),

  /** Edits descriptive fields. Undefined fields are left alone; null clears (a cleared name becomes the number). */
  update: authorizedProcedure("room", "update")
    .input(z.object({ roomId: z.uuid(), number: number.optional(), ...descriptive }))
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.query.room.findFirst({ where: eq(room.id, input.roomId) });
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      if (input.number !== undefined && input.number !== current.number)
        await requireFreeNumber(ctx.db, current.floorId, input.number, current.id);
      const { roomId, name, ...rest } = input;
      const [updated] = await ctx.db
        .update(room)
        .set({ ...rest, ...(name !== undefined ? { name: name ?? input.number ?? current.number } : {}) })
        .where(eq(room.id, roomId))
        .returning();
      return updated!;
    }),

  /**
   * Marks the room walked (assessed_at = now) with its own condition and notes.
   * Unrated assets do not block this; the count comes back so the UI can warn.
   * Calling it again on a finished room simply updates it.
   */
  finish: authorizedProcedure("room", "assess")
    .input(
      z.object({
        roomId: z.uuid(),
        condition: z.number().int().min(1).max(5).nullable().optional(),
        notes: text(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(room)
        .set({
          assessedAt: new Date(),
          ...(input.condition !== undefined ? { condition: input.condition } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        })
        .where(eq(room.id, input.roomId))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      const [unrated] = await ctx.db
        .select({ n: count() })
        .from(asset)
        .where(and(eq(asset.roomId, input.roomId), isNull(asset.condition)));
      return { room: updated, unratedAssets: unrated?.n ?? 0 };
    }),
});
