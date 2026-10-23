import { beforeAll, describe, expect, it } from "vitest";
import { anonymousCaller, callerFor, findBuilding, reseed, type Caller } from "../test/db.js";

const BLUEBONNET = "Bluebonnet Elementary";

let admin: Caller;
let field: Caller;
/** Main Building has First Floor (1) and Second Floor (2) in the sample. */
let mainId: string;

beforeAll(async () => {
  await reseed();
  admin = await callerFor("admin");
  field = await callerFor("field");
  mainId = (await findBuilding(BLUEBONNET, "Main Building")).id;
});

describe("floor.create", () => {
  it("adds a floor; the tree orders floors by level", async () => {
    const third = await admin.floor.create({ buildingId: mainId, level: 3, name: "  Third Floor " });
    expect(third).toMatchObject({ buildingId: mainId, level: 3, name: "Third Floor" });
    const basement = await admin.floor.create({ buildingId: mainId, level: -1, name: "Basement" });

    const { buildings } = await admin.campus.tree({ campusId: (await findBuilding(BLUEBONNET, "Main Building")).campusId });
    const main = buildings.find((b) => b.id === mainId)!;
    expect(main.floors.map((f) => f.level)).toEqual([-1, 1, 2, 3]);
    expect(main.floors[0]!.id).toBe(basement.id);
  });

  it("rejects a level already used in the building and names the floor holding it", async () => {
    await expect(admin.floor.create({ buildingId: mainId, level: 2, name: "Mezzanine" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Level 2 is already Second Floor in this building",
    });
  });

  it("allows the same level in another building", async () => {
    const gym = await findBuilding(BLUEBONNET, "Gymnasium");
    const created = await admin.floor.create({ buildingId: gym.id, level: 2, name: "Second Floor" });
    expect(created.buildingId).toBe(gym.id);
  });

  it("validates its input", async () => {
    await expect(admin.floor.create({ buildingId: mainId, level: 4, name: " " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.floor.create({ buildingId: mainId, level: 1.5, name: "Half" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.floor.create({ buildingId: mainId, level: 500, name: "Sky" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND for an unknown building", async () => {
    await expect(admin.floor.create({ buildingId: crypto.randomUUID(), level: 1, name: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is refused to field users by default, and requires a session", async () => {
    await expect(field.floor.create({ buildingId: mainId, level: 9, name: "Ninth Floor" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing permission floor:create",
    });
    await expect(anonymousCaller().floor.create({ buildingId: mainId, level: 9, name: "X" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("floor.update", () => {
  it("renames, and re-levels onto a free level", async () => {
    const main = await findBuilding(BLUEBONNET, "Main Building");
    const third = main.floors.find((f) => f.level === 3)!;
    const updated = await admin.floor.update({ floorId: third.id, level: 4, name: "Fourth Floor" });
    expect(updated).toMatchObject({ level: 4, name: "Fourth Floor" });
  });

  it("rejects a level held by another floor, but not keeping its own", async () => {
    const main = await findBuilding(BLUEBONNET, "Main Building");
    const fourth = main.floors.find((f) => f.level === 4)!;
    await expect(admin.floor.update({ floorId: fourth.id, level: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
    const same = await admin.floor.update({ floorId: fourth.id, level: 4, name: "Top Floor" });
    expect(same.name).toBe("Top Floor");
  });

  it("keeps the floor's rooms when it is renamed", async () => {
    const main = await findBuilding(BLUEBONNET, "Main Building");
    const first = main.floors.find((f) => f.level === 1)!;
    await admin.floor.update({ floorId: first.id, name: "Ground" });
    const { buildings } = await admin.campus.tree({ campusId: main.campusId });
    const renamed = buildings.find((b) => b.id === mainId)!.floors.find((f) => f.id === first.id)!;
    expect(renamed.name).toBe("Ground");
    expect(renamed.rooms.length).toBeGreaterThan(0);
  });

  it("throws NOT_FOUND for an unknown floor", async () => {
    await expect(admin.floor.update({ floorId: crypto.randomUUID(), name: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is refused to field users by default", async () => {
    const main = await findBuilding(BLUEBONNET, "Main Building");
    await expect(field.floor.update({ floorId: main.floors[0]!.id, name: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
