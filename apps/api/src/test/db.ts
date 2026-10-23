// Helpers for router tests. Procedures are called in-process through `appRouter.createCaller`
// with a hand-built session, so no HTTP server or cookie is involved.
//
// Isolation is per file: call `reseed()` in `beforeAll`. The Neon HTTP driver has no
// transactions, so there is no per-test rollback; tests look rows up by room number or
// asset tag (sample ids are not stored) and avoid depending on each other's writes.

import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { asset, assetType, room, user } from "../db/schema.js";
import { appRouter } from "../router.js";
import type { Context } from "../trpc.js";
import { seedTestDatabase } from "./seed.js";
import { TEST_USERS, type TestUserKey } from "./users.js";

export { db, TEST_USERS };

export async function reseed() {
  await seedTestDatabase();
}

function baseContext(session: Context["session"]): Context {
  // Nothing in the routers reads req/res yet (users.* does, but through Better Auth; not covered here).
  return { db, session, req: {} as Context["req"], res: {} as Context["res"] };
}

/** A caller signed in as one of the test users. */
export async function callerFor(who: TestUserKey = "admin") {
  const row = await db.query.user.findFirst({ where: eq(user.email, TEST_USERS[who].email) });
  if (!row) throw new Error(`Test user ${who} is missing; call reseed() first.`);
  const now = new Date();
  const session = {
    user: row,
    session: {
      id: `test-session-${who}`,
      token: `test-token-${who}`,
      userId: row.id,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
      impersonatedBy: null,
    },
  } as unknown as NonNullable<Context["session"]>;
  return appRouter.createCaller(baseContext(session));
}

/** A caller with no session, for asserting UNAUTHORIZED. */
export function anonymousCaller() {
  return appRouter.createCaller(baseContext(null));
}

export type Caller = Awaited<ReturnType<typeof callerFor>>;

export async function findRoomByNumber(number: string) {
  const row = await db.query.room.findFirst({ where: eq(room.number, number), with: { floor: true } });
  if (!row) throw new Error(`No room numbered ${number} in the seed`);
  return row;
}

export async function findAssetByTag(tag: string) {
  const row = await db.query.asset.findFirst({ where: eq(asset.assetTag, tag), with: { assetType: true } });
  if (!row) throw new Error(`No asset tagged ${tag} in the seed`);
  return row;
}

export async function findAssetType(name: string) {
  const row = await db.query.assetType.findFirst({ where: eq(assetType.name, name) });
  if (!row) throw new Error(`No asset type named ${name} in the seed`);
  return row;
}
