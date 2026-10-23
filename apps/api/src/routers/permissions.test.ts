import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_GRANTS, PERMISSION_KEYS } from "../auth/permission-catalog.js";
import { invalidateGrants } from "../auth/permissions.js";
import { anonymousCaller, callerFor, findAssetByTag, reseed, type Caller } from "../test/db.js";

let admin: Caller;
let field: Caller;

beforeAll(async () => {
  await reseed();
  invalidateGrants(); // the seed runs out of process from the router's point of view
  admin = await callerFor("admin");
  field = await callerFor("field");
});

async function permissionId(key: string) {
  const { permissions } = await admin.permissions.matrix();
  const [resource, action] = key.split(":");
  const row = permissions.find((p) => p.resource === resource && p.action === action);
  if (!row) throw new Error(`No permission ${key}`);
  return row.id;
}

describe("permissions.mine", () => {
  it("returns the seeded defaults for each role", async () => {
    expect(await admin.permissions.mine()).toEqual([...PERMISSION_KEYS].sort());
    expect(await field.permissions.mine()).toEqual([...(DEFAULT_GRANTS.field as string[])].sort());
  });

  it("requires a session", async () => {
    await expect(anonymousCaller().permissions.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("authorizedProcedure", () => {
  it("rejects a role without the grant and names the missing permission", async () => {
    await expect(field.users.list()).rejects.toMatchObject({ code: "FORBIDDEN", message: "Missing permission user:read" });
    await expect(field.permissions.matrix()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("follows the matrix on the next request after a grant changes", async () => {
    const target = await findAssetByTag("CR-1004");
    const id = await permissionId("asset:delete");

    await admin.permissions.set({ roleName: "field", permissionId: id, granted: false });
    await expect(field.asset.remove({ assetId: target.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing permission asset:delete",
    });
    expect(await field.permissions.mine()).not.toContain("asset:delete");

    await admin.permissions.set({ roleName: "field", permissionId: id, granted: true });
    await expect(field.asset.remove({ assetId: target.id })).resolves.toMatchObject({ id: target.id });
  });
});

describe("permissions.set", () => {
  it("is itself permission-gated", async () => {
    const id = await permissionId("asset:read");
    await expect(field.permissions.set({ roleName: "field", permissionId: id, granted: false })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing permission permission:update",
    });
  });

  it("refuses to take the permission grants away from admin", async () => {
    for (const key of ["permission:read", "permission:update"]) {
      const id = await permissionId(key);
      await expect(admin.permissions.set({ roleName: "admin", permissionId: id, granted: false })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    expect(await admin.permissions.mine()).toContain("permission:update");
  });

  it("is idempotent in both directions", async () => {
    const id = await permissionId("summary:read");
    await admin.permissions.set({ roleName: "office", permissionId: id, granted: true });
    await admin.permissions.set({ roleName: "office", permissionId: id, granted: true });
    await admin.permissions.set({ roleName: "office", permissionId: id, granted: false });
    await admin.permissions.set({ roleName: "office", permissionId: id, granted: false });
    const { grants } = await admin.permissions.matrix();
    expect(grants.some((g) => g.roleName === "office" && g.permissionId === id)).toBe(false);
  });
});
