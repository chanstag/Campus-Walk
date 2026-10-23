import { describe, expect, it } from "vitest";
import { sign, verify, type SignedRequest } from "./sign.js";

const secret = Buffer.from("test-secret");
const now = Date.UTC(2026, 0, 1);
const req: SignedRequest = { method: "PUT", key: "assets/a/b.jpg", exp: now / 1000 + 60, contentType: "image/jpeg" };

describe("sign / verify", () => {
  it("accepts its own signature before expiry", () => {
    expect(verify(secret, req, sign(secret, req), now)).toBe(true);
  });

  it("rejects after expiry", () => {
    expect(verify(secret, req, sign(secret, req), now + 61_000)).toBe(false);
  });

  it("rejects a different key, method, content type or expiry", () => {
    const sig = sign(secret, req);
    expect(verify(secret, { ...req, key: "assets/a/c.jpg" }, sig, now)).toBe(false);
    expect(verify(secret, { ...req, method: "GET" }, sig, now)).toBe(false);
    expect(verify(secret, { ...req, contentType: "image/png" }, sig, now)).toBe(false);
    expect(verify(secret, { ...req, exp: req.exp + 3600 }, sig, now)).toBe(false);
  });

  it("rejects another secret and garbage", () => {
    expect(verify(Buffer.from("other"), req, sign(secret, req), now)).toBe(false);
    expect(verify(secret, req, "", now)).toBe(false);
    expect(verify(secret, { ...req, exp: Number.NaN }, sign(secret, req), now)).toBe(false);
  });
});
