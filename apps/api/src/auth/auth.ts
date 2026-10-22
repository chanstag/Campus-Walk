import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { env } from "../env.js";
import { ac, roles } from "./roles.js";

export const auth = betterAuth({
  baseURL: env.API_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  // The browser talks to the API through the Vite proxy (same origin), but Better Auth checks
  // the Origin header on state-changing requests, so the web origin must be listed.
  trustedOrigins: [env.APP_URL],
  // `transaction` defaults to false in the adapter; the Neon HTTP driver has no transactions.
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // Invite-only: accounts are created by `invite.accept` (server-side createUser) or the
    // create-admin script, never by the public sign-up endpoint.
    disableSignUp: true,
    minPasswordLength: 10,
  },
  // No cookie cache on purpose: ban / remove / role changes must take effect on the next
  // request, and a cached cookie would keep a revoked session alive until it expired.
  session: { cookieCache: { enabled: false } },
  plugins: [admin({ ac, roles, defaultRole: "field", adminRoles: ["admin"] })],
});

export type Auth = typeof auth;
