/**
 * The server's tRPC error code (`NOT_FOUND`, `FORBIDDEN`, …), or undefined when the request never
 * got a tRPC answer: offline, DNS, a dropped connection, a proxy error page.
 */
export function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("data" in err)) return undefined;
  const data = (err as { data?: unknown }).data;
  if (typeof data !== "object" || data === null || !("code" in data)) return undefined;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export function isUnauthorized(err: unknown) {
  return errorCode(err) === "UNAUTHORIZED";
}

/**
 * A write the server looked at and refused. Those are rolled back and shown as failed. Everything
 * else (network failures, and an expired session, which signing in again fixes) is retried.
 */
export function isServerRejection(err: unknown) {
  const code = errorCode(err);
  return code !== undefined && code !== "UNAUTHORIZED";
}
