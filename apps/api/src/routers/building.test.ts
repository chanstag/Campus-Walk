import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_GRANTS, PERMISSION_KEYS } from "../auth/permission-catalog.js";
import { anonymousCaller, callerFor, findBuilding, reseed, type Caller } from "../test/db.js";

const BLUEBONNET = "Bluebonnet Elementary";
const CEDAR_RIDGE = "Cedar Ridge High School";

let admin: Caller;
let field: Caller;
let bluebonnetId: string;
let cedarRidgeId: string;

beforeAll(async () => {
  await reseed();
  admin = await callerFor("admin");
  field = await callerFor("field");
  const campuses = await admin.campus.list();
  bluebonnetId = campuses.find((c) => c.name === BLUEBONNET)!.id;
  cedarRidgeId = campuses.find((c) => c.name === CEDAR_RIDGE)!.id;
});

describe("building.create", () => {
  it("adds the building with a First Floor, both visible in the campus tree", async () => {
    const result = await admin.building.create({
      campusId: bluebonnetId,
      name: "  Annex ",
      buildingType: "Academic",
      yearBuilt: 2024,
      grossSf: 4200,
    });
    expect(result.building).toMatchObject({ campusId: bluebonnetId, name: "Annex", buildingType: "Academic", yearBuilt: 2024, grossSf: 4200 });
    expect(result.floor).toMatchObject({ buildingId: result.building.id, level: 1, name: "First Floor" });

    const tree = await admin.campus.tree({ campusId: bluebonnetId });
    const annex = tree.buildings.find((b) => b.id === result.building.id)!;
    expect(annex.floors.map((f) => f.id)).toEqual([result.floor.id]);
    expect(annex.floors[0]!.rooms).toEqual([]);
  });

  it("leaves optional fields null when omitted", async () => {
    const { building } = await admin.building.create({ campusId: bluebonnetId, name: "Shed" });
    expect(building).toMatchObject({ buildingType: null, yearBuilt: null, grossSf: null });
  });

  it("rejects a name already used on the campus, ignoring case", async () => {
    await expect(admin.building.create({ campusId: bluebonnetId, name: "main building" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Main Building already exists on this campus",
    });
  });

  it("allows the same name on another campus", async () => {
    const { building } = await admin.building.create({ campusId: cedarRidgeId, name: "Annex" });
    expect(building.campusId).toBe(cedarRidgeId);
  });

  it("validates its input", async () => {
    await expect(admin.building.create({ campusId: bluebonnetId, name: "  " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.building.create({ campusId: bluebonnetId, name: "Old", yearBuilt: 1700 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin.building.create({ campusId: bluebonnetId, name: "Neg", grossSf: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws NOT_FOUND for an unknown campus", async () => {
    await expect(admin.building.create({ campusId: crypto.randomUUID(), name: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is refused to field users by default, and requires a session", async () => {
    await expect(field.building.create({ campusId: bluebonnetId, name: "Field Shed" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing permission building:create",
    });
    await expect(anonymousCaller().building.create({ campusId: bluebonnetId, name: "X" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("building.update", () => {
  it("edits descriptive fields; omitted fields stay, null clears", async () => {
    const before = await findBuilding(BLUEBONNET, "Gymnasium");
    const updated = await admin.building.update({ buildingId: before.id, name: "Gym", grossSf: null });
    expect(updated).toMatchObject({ name: "Gym", grossSf: null, buildingType: before.buildingType, yearBuilt: before.yearBuilt });
  });

  it("rejects renaming onto another building on the campus, but not a case change of its own name", async () => {
    const gym = await findBuilding(BLUEBONNET, "Gym");
    await expect(admin.building.update({ buildingId: gym.id, name: "Portable P-1" })).rejects.toMatchObject({ code: "CONFLICT" });
    const recased = await admin.building.update({ buildingId: gym.id, name: "GYM" });
    expect(recased.name).toBe("GYM");
  });

  it("throws NOT_FOUND for an unknown building", async () => {
    await expect(admin.building.update({ buildingId: crypto.randomUUID(), name: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is refused to field users by default", async () => {
    const main = await findBuilding(BLUEBONNET, "Main Building");
    await expect(field.building.update({ buildingId: main.id, name: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("building and floor permissions", () => {
  it("default to admin and office only", () => {
    const keys = ["building:create", "building:update", "floor:create", "floor:update"];
    expect(PERMISSION_KEYS).toEqual(expect.arrayContaining(keys));
    expect(DEFAULT_GRANTS.admin).toBe("all");
    expect(DEFAULT_GRANTS.office).toEqual(expect.arrayContaining(keys));
    for (const key of keys) expect(DEFAULT_GRANTS.field, key).not.toContain(key);
  });
});
