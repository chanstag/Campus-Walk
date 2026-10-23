import { beforeAll, describe, expect, it } from "vitest";
import {
  anonymousCaller,
  callerFor,
  findAssetByTag,
  findAssetType,
  findRoomByNumber,
  reseed,
  type Caller,
} from "../test/db.js";

let caller: Caller;

beforeAll(async () => {
  await reseed();
  caller = await callerFor();
});

describe("asset.byRoom", () => {
  it("lists a room's assets with their type, sorted by category then type name", async () => {
    const target = await findRoomByNumber("101");
    const rows = await caller.asset.byRoom({ roomId: target.id });
    expect(rows.length).toBe(7);
    const keys = rows.map((a) => `${a.assetType.category}/${a.assetType.name}`);
    expect(keys).toEqual([...keys].sort());
    expect(rows.every((a) => a.roomId === target.id)).toBe(true);
  });

  it("requires a session", async () => {
    const target = await findRoomByNumber("101");
    await expect(anonymousCaller().asset.byRoom({ roomId: target.id })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("asset.create", () => {
  it("derives the building from the room and leaves assessedAt null without a condition", async () => {
    const target = await findRoomByNumber("102");
    const type = await findAssetType("Projector");
    const created = await caller.asset.create({ roomId: target.id, assetTypeId: type.id, notes: "   " });

    expect(created.buildingId).toBe(target.floor.buildingId);
    expect(created.roomId).toBe(target.id);
    expect(created.quantity).toBe(1);
    expect(created.condition).toBeNull();
    expect(created.assessedAt).toBeNull();
    expect(created.notes).toBeNull(); // blank text is stored as null
    expect(created.assetType.name).toBe("Projector");
  });

  it("counts a condition given at creation as an assessment", async () => {
    const target = await findRoomByNumber("102");
    const type = await findAssetType("Student Chair");
    const created = await caller.asset.create({ roomId: target.id, assetTypeId: type.id, quantity: 12, condition: 2 });
    expect(created.condition).toBe(2);
    expect(created.assessedAt).toBeInstanceOf(Date);
  });

  it("throws NOT_FOUND for an unknown room", async () => {
    const type = await findAssetType("Projector");
    await expect(caller.asset.create({ roomId: crypto.randomUUID(), assetTypeId: type.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("asset.update", () => {
  it("leaves omitted fields alone, clears null ones, and stores empty strings as null", async () => {
    const tagged = await findAssetByTag("CR-1005"); // Interactive Display, Promethean PRO-840
    expect(tagged.manufacturer).toBe("Promethean");

    const afterNotes = await caller.asset.update({ assetId: tagged.id, notes: "firmware out of date" });
    expect(afterNotes.notes).toBe("firmware out of date");
    expect(afterNotes.manufacturer).toBe("Promethean");
    expect(afterNotes.model).toBe("PRO-840");

    const cleared = await caller.asset.update({ assetId: tagged.id, manufacturer: null, model: "" });
    expect(cleared.manufacturer).toBeNull();
    expect(cleared.model).toBeNull();
    expect(cleared.notes).toBe("firmware out of date");
  });

  it("throws NOT_FOUND for an unknown asset", async () => {
    await expect(caller.asset.update({ assetId: crypto.randomUUID(), notes: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("asset.assess", () => {
  it("records the condition with a timestamp and clears both when the rating is removed", async () => {
    const tagged = await findAssetByTag("CR-1004");
    const rated = await caller.asset.assess({ assetId: tagged.id, condition: 1, notes: "leg broken" });
    expect(rated.condition).toBe(1);
    expect(rated.notes).toBe("leg broken");
    expect(rated.assessedAt).toBeInstanceOf(Date);

    const cleared = await caller.asset.assess({ assetId: tagged.id, condition: null });
    expect(cleared.condition).toBeNull();
    expect(cleared.assessedAt).toBeNull();
    expect(cleared.notes).toBe("leg broken"); // notes omitted, so untouched
  });

  it("rejects an out-of-range condition", async () => {
    const tagged = await findAssetByTag("CR-1004");
    await expect(caller.asset.assess({ assetId: tagged.id, condition: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("asset.remove", () => {
  it("deletes the asset and then reports NOT_FOUND", async () => {
    const tagged = await findAssetByTag("CR-1006");
    await expect(caller.asset.remove({ assetId: tagged.id })).resolves.toEqual({ id: tagged.id });
    await expect(caller.asset.remove({ assetId: tagged.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
