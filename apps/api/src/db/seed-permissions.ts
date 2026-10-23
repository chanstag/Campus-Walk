// Seeds the permission catalog and default grants. Idempotent and safe to re-run:
//   pnpm --filter api db:seed:permissions            # add new catalog pairs, drop stale ones,
//                                                    # give defaults to roles that have no grants yet
//   pnpm --filter api db:seed:permissions -- --reset # also restore every role to its defaults
// Separate from seed.ts (campus sample data) on purpose: that one truncates, this one upserts.
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { count, eq, inArray, sql } from "drizzle-orm";
import {
  DEFAULT_GRANTS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_KEYS,
  type PermissionKey,
} from "../auth/permission-catalog.js";
import { ROLES, ROLE_LABELS } from "../auth/roles.js";
import type { Db } from "./client.js";
import { permission, role, rolePermission } from "./schema.js";

export async function seedPermissions(db: Db, opts: { reset?: boolean } = {}) {
  await db
    .insert(role)
    .values(ROLES.map((name) => ({ name, label: ROLE_LABELS[name] })))
    .onConflictDoUpdate({ target: role.name, set: { label: sql`excluded.label` } });

  await db
    .insert(permission)
    .values(
      PERMISSION_KEYS.map((key) => {
        const [resource, action] = key.split(":") as [string, string];
        return { resource, action, description: PERMISSION_DESCRIPTIONS[key] };
      }),
    )
    .onConflictDoUpdate({
      target: [permission.resource, permission.action],
      set: { description: sql`excluded.description` },
    });

  const existing = await db.select().from(permission);
  const stale = existing.filter((p) => !(PERMISSION_KEYS as string[]).includes(`${p.resource}:${p.action}`));
  if (stale.length) {
    await db.delete(permission).where(
      inArray(
        permission.id,
        stale.map((p) => p.id),
      ),
    );
  }
  const idByKey = new Map(existing.map((p) => [`${p.resource}:${p.action}` as PermissionKey, p.id]));

  const counts = await db
    .select({ roleName: rolePermission.roleName, n: count() })
    .from(rolePermission)
    .groupBy(rolePermission.roleName);
  const defaulted: string[] = [];
  for (const name of ROLES) {
    const has = counts.find((c) => c.roleName === name)?.n ?? 0;
    if (has > 0 && !opts.reset) continue;
    if (opts.reset) await db.delete(rolePermission).where(eq(rolePermission.roleName, name));
    const keys = DEFAULT_GRANTS[name] === "all" ? PERMISSION_KEYS : DEFAULT_GRANTS[name];
    await db
      .insert(rolePermission)
      .values(keys.map((key) => ({ roleName: name, permissionId: idByKey.get(key)! })))
      .onConflictDoNothing();
    defaulted.push(name);
  }

  return { permissions: PERMISSION_KEYS.length, removed: stale.length, defaulted };
}

const runDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (runDirectly) {
  const { db } = await import("./client.js");
  const result = await seedPermissions(db, { reset: process.argv.includes("--reset") });
  console.log(
    `Permissions: ${result.permissions} in catalog, ${result.removed} stale removed; defaults applied to: ${
      result.defaulted.join(", ") || "none (all roles already have grants)"
    }`,
  );
}
