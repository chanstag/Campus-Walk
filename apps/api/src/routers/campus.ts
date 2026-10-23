import { TRPCError } from "@trpc/server";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { building, campus, district, floor, room } from "../db/schema.js";
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

const name = z.string().trim().min(1, "Campus name is required").max(200);

/** Descriptive fields shared by create and update. */
const descriptive = {
  campusType: text(100),
  address: text(500),
  yearOpened: z.number().int().min(1800).max(2100).nullable().optional(),
  /** numeric(8, 2) in the database, so it travels back as a string. */
  siteAcres: z
    .number()
    .min(0)
    .max(999999.99)
    .nullable()
    .optional()
    .transform((v) => (v == null ? v : v.toFixed(2))),
};

async function requireDistrict(db: Context["db"], districtId: string) {
  const found = await db.query.district.findFirst({ where: eq(district.id, districtId) });
  if (!found) throw new TRPCError({ code: "NOT_FOUND", message: "District not found" });
}

/** No constraint backs this; two same-named campuses in a district would be indistinguishable. */
async function requireFreeName(db: Context["db"], districtId: string, value: string, exceptCampusId?: string) {
  const clash = await db.query.campus.findFirst({
    where: and(
      eq(campus.districtId, districtId),
      sql`lower(${campus.name}) = lower(${value})`,
      exceptCampusId ? ne(campus.id, exceptCampusId) : undefined,
    ),
  });
  if (clash) throw new TRPCError({ code: "CONFLICT", message: `${clash.name} already exists in this district` });
}

export const campusRouter = router({
  list: authorizedProcedure("campus", "read").query(({ ctx }) =>
    ctx.db.query.campus.findMany({
      with: { district: true },
      orderBy: asc(campus.name),
    }),
  ),

  /** One campus down to rooms, without assets. Assets load per room/building via the asset router. */
  tree: authorizedProcedure("campus", "read").input(z.object({ campusId: z.uuid() })).query(async ({ ctx, input }) => {
    const result = await ctx.db.query.campus.findFirst({
      where: eq(campus.id, input.campusId),
      with: {
        district: true,
        buildings: {
          orderBy: asc(building.name),
          with: {
            floors: {
              orderBy: asc(floor.level),
              with: { rooms: { orderBy: asc(room.number) } },
            },
          },
        },
      },
    });
    if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Campus not found" });
    return result;
  }),

  create: authorizedProcedure("campus", "create")
    .input(z.object({ districtId: z.uuid(), name, ...descriptive }))
    .mutation(async ({ ctx, input }) => {
      await requireDistrict(ctx.db, input.districtId);
      await requireFreeName(ctx.db, input.districtId, input.name);
      const [created] = await ctx.db.insert(campus).values(input).returning();
      return created!;
    }),

  /** Edits descriptive fields or moves the campus to another district. Undefined fields are left alone; null clears. */
  update: authorizedProcedure("campus", "update")
    .input(z.object({ campusId: z.uuid(), districtId: z.uuid().optional(), name: name.optional(), ...descriptive }))
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.query.campus.findFirst({ where: eq(campus.id, input.campusId) });
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Campus not found" });
      const districtId = input.districtId ?? current.districtId;
      if (districtId !== current.districtId) await requireDistrict(ctx.db, districtId);
      if (input.name !== undefined || districtId !== current.districtId) {
        await requireFreeName(ctx.db, districtId, input.name ?? current.name, current.id);
      }
      const { campusId, ...fields } = input;
      const [updated] = await ctx.db.update(campus).set(fields).where(eq(campus.id, campusId)).returning();
      return updated!;
    }),
});
