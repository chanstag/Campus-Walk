// /files/* for the local blob store: PUT uploads and GET downloads, each authorized by the
// URL's signature (see sign.ts), not by a session. An S3/R2 driver would not need this route.
import type { FastifyInstance } from "fastify";
import { MAX_PHOTO_BYTES, PHOTO_CONTENT_TYPES, contentTypeOfKey, type PhotoContentType } from "./blob-store.js";
import { blobStore } from "./index.js";

type FilesRequest = { Params: { "*": string }; Querystring: { exp?: string; sig?: string } };

export async function filesRoutes(scope: FastifyInstance) {
  scope.addContentTypeParser(
    Object.keys(PHOTO_CONTENT_TYPES),
    { parseAs: "buffer", bodyLimit: MAX_PHOTO_BYTES },
    (_req, body, done) => done(null, body),
  );

  scope.put<FilesRequest>("/files/*", async (request, reply) => {
    const key = request.params["*"];
    const contentType = request.headers["content-type"]?.split(";")[0]?.trim() as PhotoContentType | undefined;
    const signed = { method: "PUT" as const, key, exp: Number(request.query.exp), contentType };
    if (!contentType || !blobStore.verify(signed, request.query.sig ?? "")) {
      return reply.status(403).send({ error: "Invalid or expired upload URL" });
    }
    if (contentTypeOfKey(key) !== contentType || !Buffer.isBuffer(request.body)) {
      return reply.status(400).send({ error: "Body does not match the signed content type" });
    }
    await blobStore.write(key, request.body);
    return reply.status(204).send();
  });

  scope.get<FilesRequest>("/files/*", async (request, reply) => {
    const key = request.params["*"];
    if (!blobStore.verify({ method: "GET", key, exp: Number(request.query.exp) }, request.query.sig ?? "")) {
      return reply.status(403).send({ error: "Invalid or expired URL" });
    }
    if (!(await blobStore.stat(key))) return reply.status(404).send({ error: "Not found" });
    reply.header("content-type", contentTypeOfKey(key));
    reply.header("cache-control", "private, max-age=3600");
    return reply.send(blobStore.read(key));
  });
}
