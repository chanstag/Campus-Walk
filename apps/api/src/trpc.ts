import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { fromNodeHeaders } from "better-auth/node";
import superjson from "superjson";
import { auth } from "./auth/auth.js";
import { isAdmin } from "./auth/roles.js";
import { db } from "./db/client.js";

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  // Cookie-cached, so this is usually a signature check rather than a DB read.
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return { req, res, db, session };
}
export type Context = Awaited<ReturnType<typeof createContext>>;

// superjson so Date (assessed_at, created_at, ...) survives the wire with its inferred type.
const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

/** Any signed-in user. Narrows ctx to { user, session }. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.session.user, session: ctx.session.session } });
});

/**
 * Stopgap gate for user management. Application permissions are not modelled in code; a
 * DB-driven ABAC layer is planned and will replace this check.
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdmin(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
  return next();
});
