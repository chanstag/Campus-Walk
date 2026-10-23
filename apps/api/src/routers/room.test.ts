import { and, count, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { asset } from "../db/schema.js";
import { anonymousCaller, callerFor, db, findRoomByNumber, reseed, type Caller } from "../test/db.js";

let caller: Caller;

beforeAll(async () => {
  await reseed();
  caller = await callerFor();
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
