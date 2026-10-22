import type { inferRouterOutputs } from "@trpc/server";
import { sql } from "drizzle-orm";
import { assetRouter } from "./routers/asset.js";
import { assetTypeRouter } from "./routers/assetType.js";
import { campusRouter } from "./routers/campus.js";
import { officeRouter } from "./routers/office.js";
import { roomRouter } from "./routers/room.js";
import { publicProcedure, router } from "./trpc.js";

// One sub-router per level of the hierarchy. building/floor routers slot in here when needed.
export const appRouter = router({
  health: publicProcedure.query(async ({ ctx }) => {
    await ctx.db.execute(sql`select 1`);
    return { db: "ok" as const, at: new Date().toISOString() };
  }),

  campus: campusRouter,
  room: roomRouter,
  asset: assetRouter,
  assetType: assetTypeRouter,
  /** View-specific aggregates for the office summary page. */
  office: officeRouter,
});

export type AppRouter = typeof appRouter;
/** e.g. RouterOutputs["campus"]["tree"] on the web side instead of re-declaring shapes. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
