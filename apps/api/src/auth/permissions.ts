// Server-side permission evaluation over the role_permission table.
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { permission, rolePermission } from "../db/schema.js";
import { type Action, type PermissionKey, type Resource, permissionKey } from "./permission-catalog.js";

type Grants = Map<string, Set<PermissionKey>>;

// One process serves the API today, so a write on /permissions invalidates this directly. The
// TTL is the safety net if there are ever several instances.
const TTL_MS = 60_000;
let cache: { at: number; grants: Grants } | null = null;

export async function getGrants(db: Db): Promise<Grants> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.grants;
  const rows = await db
    .select({ roleName: rolePermission.roleName, resource: permission.resource, action: permission.action })
    .from(rolePermission)
    .innerJoin(permission, eq(rolePermission.permissionId, permission.id));
  const grants: Grants = new Map();
  for (const row of rows) {
    const set = grants.get(row.roleName) ?? new Set<PermissionKey>();
    set.add(`${row.resource}:${row.action}` as PermissionKey);
    grants.set(row.roleName, set);
  }
  cache = { at: Date.now(), grants };
  return grants;
}

export function invalidateGrants() {
  cache = null;
}

/** Better Auth stores several roles as a comma-separated string. */
export function rolesOf(roleField: string | null | undefined): string[] {
  return (roleField ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

export async function can<R extends Resource>(
  db: Db,
  roleField: string | null | undefined,
  resource: R,
  action: Action<R>,
): Promise<boolean> {
  const key = permissionKey(resource, action);
  const grants = await getGrants(db);
  return rolesOf(roleField).some((role) => grants.get(role)?.has(key) ?? false);
}

/** Every permission the user's role(s) hold, for the web's `useCan`. */
export async function permissionsFor(db: Db, roleField: string | null | undefined): Promise<PermissionKey[]> {
  const grants = await getGrants(db);
  const keys = new Set<PermissionKey>();
  for (const role of rolesOf(roleField)) for (const key of grants.get(role) ?? []) keys.add(key);
  return [...keys].sort();
}
