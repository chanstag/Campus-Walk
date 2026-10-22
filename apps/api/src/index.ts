import "dotenv/config";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import { fromNodeHeaders } from "better-auth/node";
import Fastify from "fastify";
import { auth } from "./auth/auth.js";
import { env } from "./env.js";
import { appRouter, type AppRouter } from "./router.js";
import { createContext } from "./trpc.js";

const port = Number(process.env.PORT ?? 3001);

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: [env.APP_URL],
  credentials: true,
});

// Better Auth handles sign-in/out, session and admin endpoints under /api/auth/*. Fastify has
// already parsed the JSON body, so it is re-serialised into a Fetch Request for auth.handler.
server.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    const url = new URL(request.url, env.API_URL);
    const req = new Request(url, {
      method: request.method,
      headers: fromNodeHeaders(request.headers),
      ...(request.body ? { body: JSON.stringify(request.body) } : {}),
    });
    const response = await auth.handler(req);

    reply.status(response.status);
    response.headers.forEach((value, key) => {
      // Fastify computes the length itself; set-cookie must stay one header per cookie.
      if (key === "content-length" || key === "set-cookie") return;
      reply.header(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) reply.header("set-cookie", cookies);
    return reply.send(response.body ? await response.text() : null);
  },
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
