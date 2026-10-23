import { createHmac } from "node:crypto";
import { env } from "../env.js";
import { LocalBlobStore } from "./local-store.js";

export * from "./blob-store.js";

/** URL-signing key, derived from the auth secret so there is no extra secret to manage. */
const signingKey = createHmac("sha256", env.BETTER_AUTH_SECRET).update("blob:").digest();

export const blobStore = new LocalBlobStore(env.STORAGE_DIR, signingKey);
