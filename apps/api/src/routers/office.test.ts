import { count, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { asset, building, campus, floor, room } from "../db/schema.js";
import { callerFor, db, reseed, type Caller } from "../test/db.js";

let caller: Caller;
let bluebonnetId: string;

beforeAll(async () => {
  await reseed();
  caller = await callerFor();
  const row = await db.query.campus.findFirst({ where: eq(campus.name, "Bluebonnet Elementary") });
  bluebonnetId = row!.id;
});

/** Independent reference numbers, straight from the tables, so the aggregate query is checked against something else. */
async function expectedFor(campusId: string) {
  const [items] = await db
    .select({
      items: sql<number>`coalesce(sum(${asset.quantity}), 0)`.mapWith(Number),
      poor: sql<number>`coalesce(sum(${asset.quantity}) filter (where ${asset.condition} <= 2), 0)`.mapWith(Number),
      unrated: sql<number>`coalesce(sum(${asset.quantity}) filter (where ${asset.condition} is null), 0)`.mapWith(Number),
      records: count(asset.id),
    })
    .from(asset)
    .innerJoin(building, eq(building.id, asset.buildingId))
    .where(eq(building.campusId, campusId));
  const [rooms] = await db
    .select({ rooms: count(room.id), walked: count(room.assessedAt) })
    .from(room)
    .innerJoin(floor, eq(floor.id, room.floorId))
    .innerJoin(building, eq(building.id, floor.buildingId))
    .where(eq(building.campusId, campusId));
  return { ...items!, ...rooms! };
}

describe("office.summary", () => {
  it("weights item counts by quantity, not by row", async () => {
    const summary = await caller.office.summary();
    const s = summary.find((x) => x.campus.id === bluebonnetId)!;
    const expected = await expectedFor(bluebonnetId);

    expect(s.assetRecords).toBe(expected.records);
    expect(s.items).toBe(expected.items);
    expect(s.items).toBeGreaterThan(s.assetRecords); // bulk furniture rows have quantity > 1
    expect(s.poorItems).toBe(expected.poor);
    expect(s.unratedItems).toBe(expected.unrated);
    expect(Object.values(s.itemsByCategory).reduce((a, b) => a + b, 0)).toBe(expected.items);
  });

  it("counts rooms and rooms walked per campus", async () => {
    const summary = await caller.office.summary();
    const s = summary.find((x) => x.campus.id === bluebonnetId)!;
    const expected = await expectedFor(bluebonnetId);
    expect(s.rooms).toBe(expected.rooms);
    expect(s.roomsWalked).toBe(expected.walked);
    expect(s.buildings).toBe(3);
  });
});

describe("office.campusDetail", () => {
  it("lists only unwalked rooms and only poor-condition assets for the campus", async () => {
    const detail = await caller.office.campusDetail({ campusId: bluebonnetId });

    expect(detail.roomsRemaining.map((r) => r.number)).toEqual(["P101", "P102"]);
    expect(detail.poorAssets.length).toBeGreaterThan(0);
    expect(detail.poorAssets.every((a) => a.condition != null && a.condition <= 2)).toBe(true);

    const expected = await expectedFor(bluebonnetId);
    expect(detail.itemsByType.reduce((n, t) => n + t.items, 0)).toBe(expected.items);
  });

  it("moves a room out of roomsRemaining once it is finished", async () => {
    const target = await db.query.room.findFirst({ where: eq(room.number, "P102") });
    await caller.room.finish({ roomId: target!.id });
    const detail = await caller.office.campusDetail({ campusId: bluebonnetId });
    expect(detail.roomsRemaining.map((r) => r.number)).toEqual(["P101"]);
  });
});
