import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { building, floor } from "../db/schema.js";
import { authorizedProcedure, router } from "../trpc.js";
import type { Context } from "../trpc.js";

/** 0 is a ground floor, negatives are basements. The tree sorts by level. */
const level = z.number().int().min(-10).max(200);
const name = z.string().trim().min(1, "Floor name is required").max(100);

/** Levels are unique per building; checked up front for a readable error, the constraint backs it. */
async function requireFreeLevel(db: Context["db"], buildingId: string, value: number, exceptFloorId?: string) {
  const clash = await db.query.floor.findFirst({
    where: and(eq(floor.buildingId, buildingId), eq(floor.level, value), exceptFloorId ? ne(floor.id, exceptFloorId) : undefined),
  });
  if (clash) throw new TRPCError({ code: "CONFLICT", message: `Level ${value} is already ${clash.name} in this building` });
}

export const floorRouter = router({
  /** Adds a floor to a building. The client suggests the next level and its name. */
  create: authorizedProcedure("floor", "create")
    .input(z.object({ buildingId: z.uuid(), level, name }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.query.building.findFirst({ where: eq(building.id, input.buildingId) });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Building not found" });
      await requireFreeLevel(ctx.db, input.buildingId, input.level);
      const [created] = await ctx.db.insert(floor).values(input).returning();
      return created!;
    }),

  /** Renames or re-levels a floor. Undefined fields are left alone. */
  update: authorizedProcedure("floor", "update")
    .input(z.object({ floorId: z.uuid(), level: level.optional(), name: name.optional() }))
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.query.floor.findFirst({ where: eq(floor.id, input.floorId) });
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Floor not found" });
      if (input.level !== undefined && input.level !== current.level)
        await requireFreeLevel(ctx.db, current.buildingId, input.level, current.id);
      const { floorId, ...fields } = input;
      const [updated] = await ctx.db.update(floor).set(fields).where(eq(floor.id, floorId)).returning();
      return updated!;
    }),
});
