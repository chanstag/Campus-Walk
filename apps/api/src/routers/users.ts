import { TRPCError } from "@trpc/server";
import { APIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import { asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { auth } from "../auth/auth.js";
import { hashInviteToken, inviteExpiry, inviteUrl, newInviteToken } from "../auth/invitations.js";
import { ROLES } from "../auth/roles.js";
import { invitation, user } from "../db/schema.js";
import { authorizedProcedure, router } from "../trpc.js";

const roleSchema = z.enum(ROLES);
const passwordSchema = z.string().min(10).max(128);

/** Better Auth's admin endpoints validate the caller's session from these headers. */
function headersOf(ctx: { req: { headers: Record<string, unknown> } }) {
  return fromNodeHeaders(ctx.req.headers as Parameters<typeof fromNodeHeaders>[0]);
}

/** Surface Better Auth validation errors (unknown user, weak password, ...) as 400s, not 500s. */
async function authCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof APIError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: err.message, cause: err });
    }
    throw err;
  }
}

/**
 * User management, admin only. Users are Better Auth rows; invitations are ours.
 * The raw invite token is only ever returned from `invite` and `regenerateLink`.
 */
export const usersRouter = router({
  list: authorizedProcedure("user", "read").query(async ({ ctx }) => {
    const [users, invitations] = await Promise.all([
      ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          banned: user.banned,
          banReason: user.banReason,
          createdAt: user.createdAt,
        })
        .from(user)
        .orderBy(asc(user.name)),
      ctx.db.query.invitation.findMany({
        where: isNull(invitation.acceptedAt),
        orderBy: asc(invitation.createdAt),
        columns: { id: true, email: true, name: true, role: true, expiresAt: true, createdAt: true },
      }),
    ]);
    return { users, invitations };
  }),

  invite: authorizedProcedure("user", "invite")
    .input(z.object({ email: z.email(), name: z.string().trim().max(200).optional(), role: roleSchema }))
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase();
      const existing = await ctx.db.query.user.findFirst({ where: eq(user.email, email), columns: { id: true } });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A user with that email already exists." });

      // One pending invitation per email: replace rather than accumulate.
      await ctx.db.delete(invitation).where(eq(invitation.email, email));

      const token = newInviteToken();
      const [row] = await ctx.db
        .insert(invitation)
        .values({
          email,
          name: input.name || null,
          role: input.role,
          tokenHash: hashInviteToken(token),
          expiresAt: inviteExpiry(),
          invitedBy: ctx.user.id,
        })
        .returning({ id: invitation.id });
      return { invitationId: row!.id, url: inviteUrl(token) };
    }),

  regenerateLink: authorizedProcedure("user", "invite").input(z.object({ invitationId: z.uuid() })).mutation(async ({ ctx, input }) => {
    const token = newInviteToken();
    const [row] = await ctx.db
      .update(invitation)
      .set({ tokenHash: hashInviteToken(token), expiresAt: inviteExpiry(), invitedBy: ctx.user.id })
      .where(eq(invitation.id, input.invitationId))
      .returning({ id: invitation.id });
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return { invitationId: row.id, url: inviteUrl(token) };
  }),

  revokeInvitation: authorizedProcedure("user", "invite").input(z.object({ invitationId: z.uuid() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(invitation).where(eq(invitation.id, input.invitationId));
    return { ok: true as const };
  }),

  setRole: authorizedProcedure("user", "update")
    .input(z.object({ userId: z.string(), role: roleSchema }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id && input.role !== "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove your own admin role." });
      }
      await authCall(() => auth.api.setRole({ body: input, headers: headersOf(ctx) }));
      return { ok: true as const };
    }),

  ban: authorizedProcedure("user", "update")
    .input(z.object({ userId: z.string(), reason: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot ban yourself." });
      await authCall(() =>
        auth.api.banUser({ body: { userId: input.userId, banReason: input.reason }, headers: headersOf(ctx) }),
      );
      return { ok: true as const };
    }),

  unban: authorizedProcedure("user", "update").input(z.object({ userId: z.string() })).mutation(async ({ ctx, input }) => {
    await authCall(() => auth.api.unbanUser({ body: input, headers: headersOf(ctx) }));
    return { ok: true as const };
  }),

  remove: authorizedProcedure("user", "delete").input(z.object({ userId: z.string() })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove yourself." });
    await authCall(() => auth.api.removeUser({ body: input, headers: headersOf(ctx) }));
    return { ok: true as const };
  }),

  /** Stand-in for "forgot password" until email exists: admin sets one and tells the user. */
  setTemporaryPassword: authorizedProcedure("user", "update")
    .input(z.object({ userId: z.string(), password: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      await authCall(() =>
        auth.api.setUserPassword({
          body: { userId: input.userId, newPassword: input.password },
          headers: headersOf(ctx),
        }),
      );
      return { ok: true as const };
    }),
});
