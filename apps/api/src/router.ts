import { sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "./trpc.js";

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(({ input }) => ({ greeting: `Hello, ${input.name}!` })),

  health: publicProcedure.query(async ({ ctx }) => {
    await ctx.db.execute(sql`select 1`);
    return { db: "ok" as const, at: new Date().toISOString() };
  }),
});

export type AppRouter = typeof appRouter;
