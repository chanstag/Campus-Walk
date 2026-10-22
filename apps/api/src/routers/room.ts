import { TRPCError } from "@trpc/server";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { asset, room } from "../db/schema.js";
import { publicProcedure, router } from "../trpc.js";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const roomRouter = router({
  /**
   * Marks the room walked (assessed_at = now) with its own condition and notes.
   * Unrated assets do not block this; the count comes back so the UI can warn.
   * Calling it again on a finished room simply updates it.
   */
  finish: publicProcedure
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
