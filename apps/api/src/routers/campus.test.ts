import { beforeAll, describe, expect, it } from "vitest";
import { anonymousCaller, callerFor, reseed, type Caller } from "../test/db.js";

let caller: Caller;

beforeAll(async () => {
  await reseed();
  caller = await callerFor();
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
