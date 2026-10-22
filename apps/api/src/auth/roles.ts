// Role NAMES only. This file is imported by the web app at runtime (via the `api` workspace
// link), so it must stay browser-safe: nothing from drizzle, node, or ./db.
//
// Application permissions (which role may do what to which resource) are intentionally NOT
// defined here. They will live in the database as an admin-editable ABAC layer; until then the
// only gate in code is `isAdmin`, used for user management.
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const ROLES = ["admin", "office", "field"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  office: "Office",
  field: "Field",
};

// Better Auth's admin plugin rejects role values it has not been told about, so each name is
// registered. Only `admin` carries statements, and only Better Auth's own user/session ones,
// which let the admin plugin's endpoints (create/ban/remove user, set password) run.
export const ac = createAccessControl({ ...defaultStatements });
export const roles = {
  admin: ac.newRole({ ...adminAc.statements }),
  office: ac.newRole({}),
  field: ac.newRole({}),
} satisfies Record<Role, unknown>;

/** Better Auth stores multiple roles as a comma-separated string. */
export function isAdmin(role: string | null | undefined): boolean {
  return (role ?? "").split(",").includes("admin");
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
