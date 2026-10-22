import { ac, roles } from "api/src/auth/roles";
import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Same origin: the Vite dev proxy (and the production host) forward /api/auth to the API.
// adminClient is here for the `role` field's type on session.user; user management itself
// goes through tRPC (`users.*`).
export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles })],
});

export const { useSession, signIn, signOut } = authClient;
