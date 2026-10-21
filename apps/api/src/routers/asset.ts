import { and, eq, isNull, type SQL } from "drizzle-orm";
import { z } from "zod";
import { asset } from "../db/schema.js";
import { publicProcedure, router } from "../trpc.js";
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

export const assetRouter = router({
  byRoom: publicProcedure.input(z.object({ roomId: z.uuid() })).query(async ({ ctx, input }) => {
    const rows = await fetchAssets(ctx.db, eq(asset.roomId, input.roomId));
    return rows.sort(byTypeThenYear);
  }),

  /**
   * Assets in a building that are not in any room: building systems (roof, HVAC, boiler)
   * and delivered-but-unplaced equipment. Split them on assetType.typicallyBuildingLevel.
   */
  byBuilding: publicProcedure
    .input(z.object({ buildingId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await fetchAssets(
        ctx.db,
        and(eq(asset.buildingId, input.buildingId), isNull(asset.roomId)),
      );
      return rows.sort(byTypeThenYear);
    }),
});
