import { beforeAll, describe, expect, it } from "vitest";
import { anonymousCaller, callerFor, reseed, type Caller } from "../test/db.js";

const BLUEBONNET = "Bluebonnet Elementary";

let caller: Caller;
let field: Caller;
let districtId: string;

beforeAll(async () => {
  await reseed();
  caller = await callerFor();
  field = await callerFor("field");
  districtId = (await caller.district.list())[0]!.id;
});

describe("campus.list", () => {
  it("returns every campus with its district, sorted by name", async () => {
    const list = await caller.campus.list();
    expect(list.map((c) => c.name)).toEqual(["Bluebonnet Elementary", "Cedar Ridge High School"]);
    expect(list[0]?.district.name).toBe("Cedar Ridge ISD");
  });

  it("requires a session", async () => {
    await expect(anonymousCaller().campus.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("campus.tree", () => {
  it("returns buildings → floors → rooms without assets, rooms sorted by number", async () => {
    const [bluebonnet] = await caller.campus.list();
    const tree = await caller.campus.tree({ campusId: bluebonnet!.id });

    expect(tree.buildings.map((b) => b.name)).toEqual(["Gymnasium", "Main Building", "Portable P-1"]);
    const main = tree.buildings.find((b) => b.name === "Main Building")!;
    expect(main.floors.map((f) => f.level)).toEqual([1, 2]);

    const rooms = main.floors[0]!.rooms;
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.map((r) => r.number)).toEqual([...rooms.map((r) => r.number)].sort());
    expect(rooms[0]).not.toHaveProperty("assets");
  });

  it("throws NOT_FOUND for an unknown campus", async () => {
    await expect(caller.campus.tree({ campusId: crypto.randomUUID() })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("campus.create", () => {
  it("adds a campus in the district, empty in the tree", async () => {
    const created = await caller.campus.create({
      districtId,
      name: "  Live Oak Middle ",
      campusType: "Middle",
      address: "12 Oak St",
      yearOpened: 1998,
      siteAcres: 14.5,
    });
    expect(created).toMatchObject({ districtId, name: "Live Oak Middle", campusType: "Middle", address: "12 Oak St", yearOpened: 1998, siteAcres: "14.50" });
    expect((await caller.campus.tree({ campusId: created.id })).buildings).toEqual([]);
    expect((await caller.campus.list()).map((c) => c.name)).toContain("Live Oak Middle");
  });

  it("leaves optional fields null when omitted", async () => {
    const created = await caller.campus.create({ districtId, name: "Annex Campus" });
    expect(created).toMatchObject({ campusType: null, address: null, yearOpened: null, siteAcres: null });
  });

  it("rejects a name already used in the district, ignoring case, but allows it in another", async () => {
    await expect(caller.campus.create({ districtId, name: "bluebonnet elementary" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: `${BLUEBONNET} already exists in this district`,
    });
    const other = await caller.district.create({ name: "Other ISD" });
    expect((await caller.campus.create({ districtId: other.id, name: BLUEBONNET })).districtId).toBe(other.id);
  });

  it("validates its input and throws NOT_FOUND for an unknown district", async () => {
    await expect(caller.campus.create({ districtId, name: " " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.campus.create({ districtId, name: "Old", yearOpened: 1700 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.campus.create({ districtId, name: "Neg", siteAcres: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.campus.create({ districtId: crypto.randomUUID(), name: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is refused to field users by default", async () => {
    await expect(field.campus.create({ districtId, name: "Field Campus" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Missing permission campus:create",
    });
  });
});

describe("campus.update", () => {
  const find = async (name: string) => (await caller.campus.list()).find((c) => c.name === name)!;

  it("edits descriptive fields; omitted fields stay, null clears", async () => {
    const before = await find("Live Oak Middle");
    const updated = await caller.campus.update({ campusId: before.id, name: "Live Oak MS", siteAcres: null });
    expect(updated).toMatchObject({ name: "Live Oak MS", siteAcres: null, address: "12 Oak St", yearOpened: 1998 });
  });

  it("rejects renaming onto another campus in the district, but not a case change of its own name", async () => {
    const liveOak = await find("Live Oak MS");
    await expect(caller.campus.update({ campusId: liveOak.id, name: BLUEBONNET })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await caller.campus.update({ campusId: liveOak.id, name: "LIVE OAK MS" })).name).toBe("LIVE OAK MS");
  });

  it("moves a campus to another district, checking the name there", async () => {
    const other = (await caller.district.list()).find((d) => d.name === "Other ISD")!;
    const bluebonnet = (await caller.campus.list()).find((c) => c.name === BLUEBONNET && c.districtId === districtId)!;
    await expect(caller.campus.update({ campusId: bluebonnet.id, districtId: other.id })).rejects.toMatchObject({ code: "CONFLICT" });
    const annex = await find("Annex Campus");
    expect((await caller.campus.update({ campusId: annex.id, districtId: other.id })).districtId).toBe(other.id);
    await expect(caller.campus.update({ campusId: annex.id, districtId: crypto.randomUUID() })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND for an unknown campus and is refused to field users", async () => {
    await expect(caller.campus.update({ campusId: crypto.randomUUID(), name: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const liveOak = await find("LIVE OAK MS");
    await expect(field.campus.update({ campusId: liveOak.id, name: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
