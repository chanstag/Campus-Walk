import "dotenv/config";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import { fromNodeHeaders } from "better-auth/node";
import Fastify from "fastify";
import { auth } from "./auth/auth.js";
import { env } from "./env.js";
import { appRouter, type AppRouter } from "./router.js";
import { filesRoutes } from "./storage/routes.js";
import { createContext } from "./trpc.js";

const port = Number(process.env.PORT ?? 3001);

const server = Fastify({ logger: true });

await server.register(cors, {
  origin: [env.APP_URL],
  credentials: true,
});

// Better Auth handles sign-in/out, session and admin endpoints under /api/auth/*. This scope
// replaces Fastify's JSON parser with a raw string one so the body (possibly empty, as on
// sign-out) is forwarded byte-for-byte instead of being parsed and re-serialised.
await server.register(async (scope) => {
  scope.removeAllContentTypeParsers();
  scope.addContentTypeParser("*", { parseAs: "string" }, (_req, body, done) => done(null, body));

  scope.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(request.url, env.API_URL);
      const body = typeof request.body === "string" && request.body.length > 0 ? request.body : undefined;
      const req = new Request(url, {
        method: request.method,
        headers: fromNodeHeaders(request.headers),
        ...(body !== undefined ? { body } : {}),
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

// Photo bytes for the local blob store (signed PUT/GET URLs; see src/storage/).
await server.register(filesRoutes);

// Plain Fastify route, coexisting with tRPC. Useful for load balancer checks.
server.get("/health", async () => ({ ok: true }));

await server.listen({ port, host: "0.0.0.0" });
