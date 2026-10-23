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

describe("asset.byBuilding", () => {
  it("lists only the building's room-less assets", async () => {
    const hvac = await findAssetByTag("CR-1205"); // Rooftop HVAC Unit, no room
    expect(hvac.roomId).toBeNull();
    const rows = await caller.asset.byBuilding({ buildingId: hvac.buildingId });
    expect(rows.some((a) => a.id === hvac.id)).toBe(true);
    expect(rows.every((a) => a.roomId === null && a.buildingId === hvac.buildingId)).toBe(true);
  });
});

describe("asset.create at building level", () => {
  it("stores a null room on the given building", async () => {
    const hvac = await findAssetByTag("CR-1205");
    const type = await findAssetType("Boiler");
    const created = await caller.asset.create({ buildingId: hvac.buildingId, assetTypeId: type.id, condition: 4 });
    expect(created.roomId).toBeNull();
    expect(created.buildingId).toBe(hvac.buildingId);
    expect(created.condition).toBe(4);
    const rows = await caller.asset.byBuilding({ buildingId: hvac.buildingId });
    expect(rows.some((a) => a.id === created.id)).toBe(true);
  });

  it("rejects both or neither of roomId and buildingId", async () => {
    const hvac = await findAssetByTag("CR-1205");
    const target = await findRoomByNumber("102");
    const type = await findAssetType("Boiler");
    await expect(
      caller.asset.create({ roomId: target.id, buildingId: hvac.buildingId, assetTypeId: type.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.asset.create({ assetTypeId: type.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND for an unknown building", async () => {
    const type = await findAssetType("Boiler");
    await expect(
      caller.asset.create({ buildingId: crypto.randomUUID(), assetTypeId: type.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
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

describe("asset.move", () => {
  it("moves an asset into a room in another building, keeping its assessment", async () => {
    const tagged = await findAssetByTag("CR-1005"); // room 101, Main Building
    const from = await findRoomByNumber("101");
    const to = await findRoomByNumber("P101"); // Portable P-1
    expect(to.floor.buildingId).not.toBe(tagged.buildingId);

    const moved = await caller.asset.move({ assetId: tagged.id, roomId: to.id });
    expect(moved.roomId).toBe(to.id);
    expect(moved.buildingId).toBe(to.floor.buildingId);
    expect(moved.condition).toBe(tagged.condition);
    expect(moved.assessedAt).toEqual(tagged.assessedAt);
    expect(moved.assetType.name).toBe(tagged.assetType.name);

    const left = await caller.asset.byRoom({ roomId: from.id });
    expect(left.some((a) => a.id === tagged.id)).toBe(false);
    const arrived = await caller.asset.byRoom({ roomId: to.id });
    expect(arrived.some((a) => a.id === tagged.id)).toBe(true);
  });

  it("moves a room asset to building level and back into a room", async () => {
    const tagged = await findAssetByTag("CR-1004"); // room 101
    const room101 = await findRoomByNumber("101");
    const toBuilding = await caller.asset.move({ assetId: tagged.id, buildingId: room101.floor.buildingId });
    expect(toBuilding.roomId).toBeNull();
    expect(toBuilding.buildingId).toBe(room101.floor.buildingId);
    expect(toBuilding.condition).toBe(tagged.condition);

    const p101 = await findRoomByNumber("P101");
    const toRoom = await caller.asset.move({ assetId: tagged.id, roomId: p101.id });
    expect(toRoom.roomId).toBe(p101.id);
    expect(toRoom.buildingId).toBe(p101.floor.buildingId);
  });

  it("rejects both or neither target, and an unknown building", async () => {
    const tagged = await findAssetByTag("CR-1004");
    const target = await findRoomByNumber("102");
    await expect(
      caller.asset.move({ assetId: tagged.id, roomId: target.id, buildingId: target.floor.buildingId }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.asset.move({ assetId: tagged.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.asset.move({ assetId: tagged.id, buildingId: crypto.randomUUID() })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("is allowed for field users", async () => {
    const tagged = await findAssetByTag("CR-1005");
    const back = await findRoomByNumber("101");
    const field = await callerFor("field");
    await expect(field.asset.move({ assetId: tagged.id, roomId: back.id })).resolves.toMatchObject({ roomId: back.id });
  });

  it("throws NOT_FOUND for an unknown asset or room", async () => {
    const tagged = await findAssetByTag("CR-1005");
    const target = await findRoomByNumber("102");
    await expect(caller.asset.move({ assetId: crypto.randomUUID(), roomId: target.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller.asset.move({ assetId: tagged.id, roomId: crypto.randomUUID() })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("requires a session", async () => {
    const tagged = await findAssetByTag("CR-1005");
    const target = await findRoomByNumber("102");
    await expect(anonymousCaller().asset.move({ assetId: tagged.id, roomId: target.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("asset.remove", () => {
  it("deletes the asset and then reports NOT_FOUND", async () => {
    const tagged = await findAssetByTag("CR-1006");
    await expect(caller.asset.remove({ assetId: tagged.id })).resolves.toEqual({ id: tagged.id });
    await expect(caller.asset.remove({ assetId: tagged.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
