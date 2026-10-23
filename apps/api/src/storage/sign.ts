// HMAC-signed URLs for the local blob store, the same idea as an S3 presigned URL: the signature
// is the authorization, so the /files route needs no session. Pure functions; the secret is passed in.
import { createHmac, timingSafeEqual } from "node:crypto";

export type SignedRequest = {
  method: "GET" | "PUT";
  key: string;
  /** Expiry, unix seconds. */
  exp: number;
  /** PUT only: the upload must arrive with exactly this content type. */
  contentType?: string;
};

function payload(req: SignedRequest) {
  return [req.method, req.key, req.exp, req.contentType ?? ""].join("\n");
}

export function sign(secret: Buffer, req: SignedRequest): string {
  return createHmac("sha256", secret).update(payload(req)).digest("base64url");
}

export function verify(secret: Buffer, req: SignedRequest, signature: string, now = Date.now()): boolean {
  if (!Number.isSafeInteger(req.exp) || req.exp * 1000 < now) return false;
  const expected = Buffer.from(sign(secret, req));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
