import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { invalidateGrants, permissionsFor } from "../auth/permissions.js";
import { ROLES } from "../auth/roles.js";
import { permission, role, rolePermission } from "../db/schema.js";
import { authorizedProcedure, protectedProcedure, router } from "../trpc.js";

/** The role × permission matrix. Grants are data; the catalog of pairs is seeded. */
export const permissionsRouter = router({
  /** The caller's own permission keys, for `useCan` on the web. */
  mine: protectedProcedure.query(({ ctx }) => permissionsFor(ctx.db, ctx.user.role)),

  matrix: authorizedProcedure("permission", "read").query(async ({ ctx }) => {
    const [roles, permissions, grants] = await Promise.all([
      ctx.db.select().from(role),
      ctx.db.select().from(permission).orderBy(asc(permission.resource), asc(permission.action)),
      ctx.db.select({ roleName: rolePermission.roleName, permissionId: rolePermission.permissionId }).from(rolePermission),
    ]);
    const order = (name: string) => (ROLES as readonly string[]).indexOf(name);
    roles.sort((a, b) => order(a.name) - order(b.name));
    return { roles, permissions, grants };
  }),

  set: authorizedProcedure("permission", "update")
    .input(z.object({ roleName: z.enum(ROLES), permissionId: z.uuid(), granted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const perm = await ctx.db.query.permission.findFirst({ where: eq(permission.id, input.permissionId) });
      if (!perm) throw new TRPCError({ code: "NOT_FOUND", message: "Unknown permission." });
      // Lockout guard: admins always keep permission:* so the matrix stays editable by someone.
      if (!input.granted && input.roleName === "admin" && perm.resource === "permission") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Admins must keep the permission:* grants." });
      }
      if (input.granted) {
        await ctx.db
          .insert(rolePermission)
          .values({ roleName: input.roleName, permissionId: input.permissionId })
          .onConflictDoNothing();
      } else {
        await ctx.db
          .delete(rolePermission)
          .where(and(eq(rolePermission.roleName, input.roleName), eq(rolePermission.permissionId, input.permissionId)));
      }
      invalidateGrants();
      return { ok: true as const };
    }),
});
