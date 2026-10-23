// Resets the TEST database: sample data plus the fixed test users.
//
//   pnpm --filter api db:seed:test        # runs with --env-file=.env.test
//
// Refuses to run unless CAMPUS_WALK_TEST=1 is set, which only .env.test does, so a stray
// invocation can never truncate the dev database. Also imported by the Vitest helper.

import { eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { auth } from "../auth/auth.js";
import { db, type Db } from "../db/client.js";
import { user } from "../db/schema.js";
import { seed } from "../db/seed.js";
import { TEST_USERS } from "./users.js";

export function assertTestDatabase() {
  if (process.env.CAMPUS_WALK_TEST !== "1") {
    throw new Error("Refusing to seed: CAMPUS_WALK_TEST is not 1. Run via `pnpm --filter api db:seed:test`.");
  }
}

/** Creates any missing test user through Better Auth so passwords are hashed the normal way. */
export async function ensureTestUsers(database: Db = db) {
  for (const u of Object.values(TEST_USERS)) {
    const existing = await database.query.user.findFirst({ where: eq(user.email, u.email), columns: { id: true } });
    if (existing) continue;
    // Server-side call with no headers: Better Auth skips the admin-session check (same as invite.accept).
    await auth.api.createUser({ body: { email: u.email, name: u.name, password: u.password, role: u.role } });
  }
}

/** Sample data + test users. The unit of isolation for both Vitest files and Playwright specs. */
export async function seedTestDatabase(options: { log?: (line: string) => void } = {}) {
  assertTestDatabase();
  await seed(db, { log: options.log ?? (() => {}) });
  await ensureTestUsers();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedTestDatabase({ log: console.log })
    .then(() => console.log("[db:seed:test] done"))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
