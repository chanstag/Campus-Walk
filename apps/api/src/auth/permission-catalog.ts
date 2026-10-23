// The vocabulary of permissions: every resource and the actions it supports. Browser-safe (the
// web app imports it at runtime through the `api` workspace link): no drizzle, node or ./db.
//
// This file is NOT where access is decided. Grants (which role holds which permission) live in
// the `role_permission` table and are edited on /permissions. The catalog is only the list of
// possible pairs (seeded into `permission`) plus the defaults used on first seed.
import type { Role } from "./roles.js";

export const PERMISSIONS = {
  campus: ["read"],
  room: ["read", "create", "update", "assess"],
  asset: ["read", "create", "update", "assess", "delete"],
  /** Office aggregates (`office.*` procedures). */
  summary: ["read"],
  user: ["read", "invite", "update", "delete"],
  /** The role × permission matrix itself. */
  permission: ["read", "update"],
} as const;

export type Resource = keyof typeof PERMISSIONS;
export type Action<R extends Resource> = (typeof PERMISSIONS)[R][number];
export type PermissionKey = { [R in Resource]: `${R}:${Action<R>}` }[Resource];

export const RESOURCES = Object.keys(PERMISSIONS) as Resource[];

export const RESOURCE_LABELS: Record<Resource, string> = {
  campus: "Campuses",
  room: "Rooms",
  asset: "Assets",
  summary: "Office summary",
  user: "Users",
  permission: "Permissions",
};

export function permissionKey<R extends Resource>(resource: R, action: Action<R>): PermissionKey {
  return `${resource}:${action}` as PermissionKey;
}

export const PERMISSION_KEYS: PermissionKey[] = RESOURCES.flatMap((resource) =>
  (PERMISSIONS[resource] as readonly string[]).map((action) => `${resource}:${action}` as PermissionKey),
);

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === "string" && (PERMISSION_KEYS as string[]).includes(value);
}

/** Shown on the matrix screen next to each row. */
export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "campus:read": "Browse campuses, buildings, floors and rooms",
  "room:read": "See a room's details and assessment",
  "room:create": "Add rooms to a floor",
  "room:update": "Edit a room's number, name, type, area and capacity",
  "room:assess": "Finish a room (condition, notes, walked date)",
  "asset:read": "See the assets in a room or building",
  "asset:create": "Add assets",
  "asset:update": "Edit an asset's descriptive fields",
  "asset:assess": "Rate an asset's condition",
  "asset:delete": "Remove assets",
  "summary:read": "View the office summary and campus detail",
  "user:read": "See the list of users and pending invitations",
  "user:invite": "Invite people and manage invitation links",
  "user:update": "Change roles, ban/unban, set temporary passwords",
  "user:delete": "Remove users",
  "permission:read": "View the role × permission matrix",
  "permission:update": "Edit the role × permission matrix",
};

/** First-seed defaults only. After seeding, the database is the source of truth. */
export const DEFAULT_GRANTS: Record<Role, PermissionKey[] | "all"> = {
  admin: "all",
  office: [
    "campus:read",
    "room:read",
    "room:create",
    "room:update",
    "room:assess",
    "asset:read",
    "asset:create",
    "asset:update",
    "asset:assess",
    "asset:delete",
    "summary:read",
  ],
  field: ["campus:read", "room:read", "room:create", "room:update", "room:assess", "asset:read", "asset:create", "asset:update", "asset:assess", "asset:delete"],
};
