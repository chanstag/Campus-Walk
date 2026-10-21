import { initTRPC } from "@trpc/server";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import superjson from "superjson";
import { db } from "./db/client.js";

export function createContext({ req, res }: CreateFastifyContextOptions) {
  return { req, res, db };
}
export type Context = Awaited<ReturnType<typeof createContext>>;

// superjson so Date (assessed_at, created_at, ...) survives the wire with its inferred type.
const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
