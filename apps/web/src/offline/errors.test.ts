import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";
import { errorCode, isServerRejection, isUnauthorized } from "./errors";

/** The shape a tRPC error response carries once the client has parsed it. */
function serverError(code: string) {
  return TRPCClientError.from({ error: { message: code, code: -32600, data: { code, httpStatus: 400 } } });
}

describe("errorCode", () => {
  it("reads the tRPC code from a server answer", () => {
    expect(errorCode(serverError("NOT_FOUND"))).toBe("NOT_FOUND");
  });

  it("is undefined for a request that never got an answer", () => {
    expect(errorCode(TRPCClientError.from(new TypeError("Failed to fetch")))).toBeUndefined();
    expect(errorCode(new Error("boom"))).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
  });
});

describe("isServerRejection", () => {
  it("is true for codes the server decided on", () => {
    for (const code of ["NOT_FOUND", "FORBIDDEN", "BAD_REQUEST", "CONFLICT"]) expect(isServerRejection(serverError(code))).toBe(true);
  });

  it("is false for network failures and for an expired session, which are retried", () => {
    expect(isServerRejection(TRPCClientError.from(new TypeError("Failed to fetch")))).toBe(false);
    expect(isServerRejection(serverError("UNAUTHORIZED"))).toBe(false);
    expect(isUnauthorized(serverError("UNAUTHORIZED"))).toBe(true);
  });
});
