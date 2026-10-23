import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { fromNodeHeaders } from "better-auth/node";
import superjson from "superjson";
import { auth } from "./auth/auth.js";
import type { Action, Resource } from "./auth/permission-catalog.js";
import { can } from "./auth/permissions.js";
import { db } from "./db/client.js";

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  // No cookie cache (see auth.ts), so this is one session lookup per request.
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
 * Signed in AND the user's role holds `resource:action` in the role_permission table.
 * Rejects with FORBIDDEN naming the missing permission. The resource/action pair is checked
 * against the catalog at compile time; the grant itself is data.
 */
export const authorizedProcedure = <R extends Resource>(resource: R, action: Action<R>) =>
  protectedProcedure.use(async ({ ctx, next }) => {
    if (!(await can(ctx.db, ctx.user.role, resource, action))) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Missing permission ${resource}:${action}` });
    }
    return next();
  });
