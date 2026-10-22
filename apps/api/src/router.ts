import type { inferRouterOutputs } from "@trpc/server";
import { sql } from "drizzle-orm";
import { assetRouter } from "./routers/asset.js";
import { assetTypeRouter } from "./routers/assetType.js";
import { campusRouter } from "./routers/campus.js";
import { publicProcedure, router } from "./trpc.js";

// One sub-router per level of the hierarchy. building/floor/room routers slot in here when needed.
export const appRouter = router({
  health: publicProcedure.query(async ({ ctx }) => {
    await ctx.db.execute(sql`select 1`);
    return { db: "ok" as const, at: new Date().toISOString() };
  }),

  campus: campusRouter,
  asset: assetRouter,
  assetType: assetTypeRouter,
});

export type AppRouter = typeof appRouter;
/** e.g. RouterOutputs["campus"]["tree"] on the web side instead of re-declaring shapes. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
