import "dotenv/config";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { appRouter, type AppRouter } from "./router.js";
import { createContext } from "./trpc.js";

const port = Number(process.env.PORT ?? 3001);

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: ["http://localhost:5173"],
});

await server.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext,
    onError({ path, error }) {
      server.log.error({ path, err: error }, "tRPC error");
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
});

// Plain Fastify route, coexisting with tRPC. Useful for load balancer checks.
server.get("/health", async () => ({ ok: true }));

await server.listen({ port, host: "0.0.0.0" });
