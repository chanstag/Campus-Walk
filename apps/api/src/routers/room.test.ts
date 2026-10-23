import { and, count, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_GRANTS, PERMISSION_KEYS } from "../auth/permission-catalog.js";
import { ROLES } from "../auth/roles.js";
import { asset } from "../db/schema.js";
import { anonymousCaller, callerFor, db, findRoomByNumber, reseed, type Caller } from "../test/db.js";

let caller: Caller;
let field: Caller;
/** Portable P-1's floor, captured before room.create adds a second "P101" elsewhere. */
let floorId: string;

beforeAll(async () => {
  await reseed();
  caller = await callerFor();
  field = await callerFor("field");
  floorId = (await findRoomByNumber("P101")).floorId;
});

async function unratedIn(roomId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(asset)
    .where(and(eq(asset.roomId, roomId), isNull(asset.condition)));
  return row?.n ?? 0;
}

describe("room.finish", () => {
  it("marks the room walked and reports unrated assets instead of rejecting", async () => {
    // P101 is unwalked in the sample and every asset in it is unrated.
    const target = await findRoomByNumber("P101");
    expect(target.assessedAt).toBeNull();
    const unrated = await unratedIn(target.id);
    expect(unrated).toBeGreaterThan(0);

    const result = await caller.room.finish({ roomId: target.id, condition: 3, notes: "  needs paint  " });

    expect(result.unratedAssets).toBe(unrated);
    expect(result.room.assessedAt).toBeInstanceOf(Date);
    expect(result.room.condition).toBe(3);
    expect(result.room.notes).toBe("needs paint");
  });

  it("updates a finished room in place; empty notes clear it, omitted fields stay", async () => {
    const target = await findRoomByNumber("P101");
    const again = await caller.room.finish({ roomId: target.id, notes: "" });
    expect(again.room.condition).toBe(3);
    expect(again.room.notes).toBeNull();
    expect(again.room.assessedAt!.getTime()).toBeGreaterThan(target.assessedAt!.getTime());
  });

  it("rejects an out-of-range condition", async () => {
    const target = await findRoomByNumber("101");
    await expect(caller.room.finish({ roomId: target.id, condition: 6 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND for an unknown room", async () => {
    await expect(caller.room.finish({ roomId: crypto.randomUUID() })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requires a session", async () => {
    const target = await findRoomByNumber("101");
    await expect(anonymousCaller().room.finish({ roomId: target.id })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("room.create", () => {
  it("adds an unwalked room to the floor; a blank name falls back to the number", async () => {
    const created = await field.room.create({ floorId, number: "  P199 ", name: "", roomType: "Storage", areaSf: 120 });
    expect(created).toMatchObject({ floorId, number: "P199", name: "P199", roomType: "Storage", areaSf: 120, capacity: null });
    expect(created.assessedAt).toBeNull();
    expect(created.condition).toBeNull();
    expect((await findRoomByNumber("P199")).id).toBe(created.id);
  });

  it("rejects a number already used on the same floor", async () => {
    await expect(field.room.create({ floorId, number: "P101" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Room P101 already exists on this floor",
    });
  });

  it("allows the same number on another floor", async () => {
    const other = (await findRoomByNumber("101")).floorId;
    const created = await field.room.create({ floorId: other, number: "P101" });
    expect(created.floorId).toBe(other);
  });

  it("validates its input", async () => {
    await expect(field.room.create({ floorId, number: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(field.room.create({ floorId, number: "P198", areaSf: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(field.room.create({ floorId, number: "P198", capacity: 2.5 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND for an unknown floor", async () => {
    await expect(field.room.create({ floorId: crypto.randomUUID(), number: "X1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requires a session", async () => {
    await expect(anonymousCaller().room.create({ floorId, number: "X2" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("room.update", () => {
  it("edits descriptive fields; omitted fields stay, null clears, assessment is untouched", async () => {
    const before = await findRoomByNumber("101");
    const updated = await field.room.update({ roomId: before.id, name: "Science Lab", capacity: null });
    expect(updated).toMatchObject({ number: "101", name: "Science Lab", capacity: null, roomType: before.roomType, areaSf: before.areaSf });
    expect(updated.assessedAt).toEqual(before.assessedAt);
    expect(updated.condition).toBe(before.condition);
  });

  it("renumbers; a cleared name follows the new number", async () => {
    const target = await findRoomByNumber("P199");
    const updated = await field.room.update({ roomId: target.id, number: "P199A", name: null });
    expect(updated).toMatchObject({ number: "P199A", name: "P199A" });
  });

  it("rejects renumbering onto another room on the floor, but not keeping its own number", async () => {
    const target = await findRoomByNumber("P199A");
    await expect(field.room.update({ roomId: target.id, number: "P101" })).rejects.toMatchObject({ code: "CONFLICT" });
    const same = await field.room.update({ roomId: target.id, number: "P199A", roomType: "Office" });
    expect(same.roomType).toBe("Office");
  });

  it("throws NOT_FOUND for an unknown room", async () => {
    await expect(field.room.update({ roomId: crypto.randomUUID(), name: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("room create/update permissions", () => {
  it("are granted to every role by default", () => {
    for (const role of ROLES) {
      const grants = DEFAULT_GRANTS[role] === "all" ? PERMISSION_KEYS : DEFAULT_GRANTS[role];
      expect(grants, role).toEqual(expect.arrayContaining(["room:create", "room:update"]));
    }
  });

  it("are enforced: revoking room:create from field makes create FORBIDDEN", async () => {
    const { permissions } = await caller.permissions.matrix();
    const perm = permissions.find((p) => p.resource === "room" && p.action === "create")!;
    await caller.permissions.set({ roleName: "field", permissionId: perm.id, granted: false });
    try {
      await expect(field.room.create({ floorId, number: "P197" })).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Missing permission room:create",
      });
    } finally {
      await caller.permissions.set({ roleName: "field", permissionId: perm.id, granted: true });
    }
  });
});
