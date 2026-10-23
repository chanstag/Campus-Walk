import { TRPCError } from "@trpc/server";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { district } from "../db/schema.js";
import { authorizedProcedure, router } from "../trpc.js";
import type { Context } from "../trpc.js";

const name = z.string().trim().min(1, "District name is required").max(200);

/** No constraint backs this; two same-named districts would be indistinguishable in pickers. */
async function requireFreeName(db: Context["db"], value: string, exceptDistrictId?: string) {
  const clash = await db.query.district.findFirst({
    where: and(
      sql`lower(${district.name}) = lower(${value})`,
      exceptDistrictId ? ne(district.id, exceptDistrictId) : undefined,
    ),
  });
  if (clash) throw new TRPCError({ code: "CONFLICT", message: `${clash.name} already exists` });
}

export const districtRouter = router({
  /** Every district, sorted by name, including ones with no campuses yet. */
  list: authorizedProcedure("campus", "read").query(({ ctx }) =>
    ctx.db.query.district.findMany({ orderBy: asc(district.name) }),
  ),

  create: authorizedProcedure("district", "create")
    .input(z.object({ name }))
    .mutation(async ({ ctx, input }) => {
      await requireFreeName(ctx.db, input.name);
      const [created] = await ctx.db.insert(district).values(input).returning();
      return created!;
    }),

  update: authorizedProcedure("district", "update")
    .input(z.object({ districtId: z.uuid(), name }))
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.query.district.findFirst({ where: eq(district.id, input.districtId) });
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "District not found" });
      await requireFreeName(ctx.db, input.name, current.id);
      const [updated] = await ctx.db
        .update(district)
        .set({ name: input.name })
        .where(eq(district.id, input.districtId))
        .returning();
      return updated!;
    }),
});
