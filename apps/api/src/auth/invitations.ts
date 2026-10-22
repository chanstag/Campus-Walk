import { createHash, randomBytes } from "node:crypto";
import { env } from "../env.js";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Raw token goes in the link; only its hash is stored. */
export function newInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteUrl(token: string) {
  return `${env.APP_URL}/invite/${token}`;
}

export function inviteExpiry(from = Date.now()) {
  return new Date(from + INVITE_TTL_MS);
}
