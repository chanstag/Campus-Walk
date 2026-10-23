import type { inferRouterOutputs } from "@trpc/server";
import { sql } from "drizzle-orm";
import { assetRouter } from "./routers/asset.js";
import { assetPhotoRouter } from "./routers/assetPhoto.js";
import { assetTypeRouter } from "./routers/assetType.js";
import { campusRouter } from "./routers/campus.js";
import { inviteRouter } from "./routers/invite.js";
import { officeRouter } from "./routers/office.js";
import { permissionsRouter } from "./routers/permissions.js";
import { roomRouter } from "./routers/room.js";
import { usersRouter } from "./routers/users.js";
import { protectedProcedure, router } from "./trpc.js";

// One sub-router per level of the hierarchy. building/floor/room routers slot in here when needed.
export const appRouter = router({
  health: protectedProcedure.query(async ({ ctx }) => {
    await ctx.db.execute(sql`select 1`);
    return { db: "ok" as const, at: new Date().toISOString() };
  }),

  campus: campusRouter,
  room: roomRouter,
  asset: assetRouter,
  /** Photos on an asset: signed upload/download URLs over the blob store. */
  assetPhoto: assetPhotoRouter,
  assetType: assetTypeRouter,
  /** View-specific aggregates for the office summary page. */
  office: officeRouter,
  /** Admin-only user management and invitations. */
  users: usersRouter,
  /** Public: accept an invitation (the invitee has no session yet). */
  invite: inviteRouter,
  /** Role × permission matrix (read/edit) and the caller's own permissions. */
  permissions: permissionsRouter,
});

export type AppRouter = typeof appRouter;
/** e.g. RouterOutputs["campus"]["tree"] on the web side instead of re-declaring shapes. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
