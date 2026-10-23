import { TRPCError } from "@trpc/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { building, campus, floor } from "../db/schema.js";
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

const name = z.string().trim().min(1, "Building name is required").max(200);

/** Descriptive fields shared by create and update. */
const descriptive = {
  buildingType: text(100),
  yearBuilt: z.number().int().min(1800).max(2100).nullable().optional(),
  grossSf: z.number().int().min(0).nullable().optional(),
};

/** Every building has at least one floor; a new one starts with this. */
const FIRST_FLOOR = { level: 1, name: "First Floor" };

/** No constraint backs this; two same-named buildings would be indistinguishable in the tree. */
async function requireFreeName(db: Context["db"], campusId: string, value: string, exceptBuildingId?: string) {
  const clash = await db.query.building.findFirst({
    where: and(
      eq(building.campusId, campusId),
      sql`lower(${building.name}) = lower(${value})`,
      exceptBuildingId ? ne(building.id, exceptBuildingId) : undefined,
    ),
  });
  if (clash) throw new TRPCError({ code: "CONFLICT", message: `${clash.name} already exists on this campus` });
}

export const buildingRouter = router({
  /** Adds a building with its first floor, in one batch so neither exists without the other. */
  create: authorizedProcedure("building", "create")
    .input(z.object({ campusId: z.uuid(), name, ...descriptive }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.db.query.campus.findFirst({ where: eq(campus.id, input.campusId) });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Campus not found" });
      await requireFreeName(ctx.db, input.campusId, input.name);
      const buildingId = crypto.randomUUID();
      const [[created], [firstFloor]] = await ctx.db.batch([
        ctx.db
          .insert(building)
          .values({ id: buildingId, ...input })
          .returning(),
        ctx.db
          .insert(floor)
          .values({ buildingId, ...FIRST_FLOOR })
          .returning(),
      ]);
      return { building: created!, floor: firstFloor! };
    }),

  /** Edits descriptive fields. Undefined fields are left alone; null clears. */
  update: authorizedProcedure("building", "update")
    .input(z.object({ buildingId: z.uuid(), name: name.optional(), ...descriptive }))
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.query.building.findFirst({ where: eq(building.id, input.buildingId) });
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Building not found" });
      if (input.name !== undefined) await requireFreeName(ctx.db, current.campusId, input.name, current.id);
      const { buildingId, ...fields } = input;
      const [updated] = await ctx.db.update(building).set(fields).where(eq(building.id, buildingId)).returning();
      return updated!;
    }),
});
