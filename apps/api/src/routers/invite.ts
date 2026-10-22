import { TRPCError } from "@trpc/server";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "../auth/auth.js";
import { hashInviteToken } from "../auth/invitations.js";
import { isRole } from "../auth/roles.js";
import type { Db } from "../db/client.js";
import { invitation } from "../db/schema.js";
import { publicProcedure, router } from "../trpc.js";

type InviteStatus = "valid" | "expired" | "used" | "unknown";

async function lookup(db: Db, token: string) {
  const row = await db.query.invitation.findFirst({ where: eq(invitation.tokenHash, hashInviteToken(token)) });
  let status: InviteStatus = "unknown";
  if (row) status = row.acceptedAt ? "used" : row.expiresAt.getTime() < Date.now() ? "expired" : "valid";
  return { row, status };
}

/** Public: the invitee has no session yet. The token is the only credential. */
export const inviteRouter = router({
  get: publicProcedure.input(z.object({ token: z.string().min(1) })).query(async ({ ctx, input }) => {
    const { row, status } = await lookup(ctx.db, input.token);
    if (!row || status !== "valid") return { status, email: null, name: null, role: null };
    return { status, email: row.email, name: row.name, role: row.role };
  }),

  accept: publicProcedure
    .input(z.object({ token: z.string().min(1), name: z.string().trim().min(1).max(200), password: z.string().min(10).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const { row, status } = await lookup(ctx.db, input.token);
      if (!row || status !== "valid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `This invitation is ${status === "unknown" ? "not valid" : status}.` });
      }
      if (!isRole(row.role)) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invitation has an unknown role." });

      // Server-side call with no headers: Better Auth's createUser skips the admin-session
      // check in that case, which is what lets an invite (not an admin) create the account.
      try {
        await auth.api.createUser({
          body: { email: row.email, name: input.name, password: input.password, role: row.role },
        });
      } catch (err) {
        if (err instanceof APIError) throw new TRPCError({ code: "BAD_REQUEST", message: err.message, cause: err });
        throw err;
      }
      await ctx.db.update(invitation).set({ acceptedAt: new Date() }).where(eq(invitation.id, row.id));
      return { email: row.email };
    }),
});
