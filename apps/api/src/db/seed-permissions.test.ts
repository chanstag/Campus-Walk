import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROLES } from "../auth/roles.js";
import { db, reseed } from "../test/db.js";
import { permission, rolePermission } from "./schema.js";
import { seedPermissions } from "./seed-permissions.js";

beforeAll(() => reseed());
// Leave the matrix at its defaults for whichever file runs next.
afterAll(() => reseed());

async function holders(resource: string, action: string) {
  const rows = await db
    .select({ roleName: rolePermission.roleName })
    .from(rolePermission)
    .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
    .where(and(eq(permission.resource, resource), eq(permission.action, action)));
  return rows.map((r) => r.roleName).sort();
}

describe("seedPermissions (plain run on an already-seeded database)", () => {
  it("grants a pair that is new to the catalog to every role whose defaults include it", async () => {
    // Simulate a database seeded before room:create existed: the pair and its grants are absent.
    await db.delete(permission).where(and(eq(permission.resource, "room"), eq(permission.action, "create")));
    expect(await holders("room", "create")).toEqual([]);

    const result = await seedPermissions(db);

    expect(result.added).toBe(1);
    expect(result.defaulted).toEqual([]);
    expect(result.extended.sort()).toEqual([...ROLES].sort());
    expect(await holders("room", "create")).toEqual([...ROLES].sort());
  });

  it("does not re-grant an existing pair that was revoked", async () => {
    const [row] = await db
      .select({ id: permission.id })
      .from(permission)
      .where(and(eq(permission.resource, "room"), eq(permission.action, "create")));
    await db
      .delete(rolePermission)
      .where(and(eq(rolePermission.roleName, "field"), eq(rolePermission.permissionId, row!.id)));

    const result = await seedPermissions(db);

    expect(result.added).toBe(0);
    expect(result.extended).toEqual([]);
    expect(await holders("room", "create")).toEqual(["admin", "office"]);
  });
});
