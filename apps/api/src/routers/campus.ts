import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { building, campus, floor, room } from "../db/schema.js";
import { authorizedProcedure, router } from "../trpc.js";

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
});
