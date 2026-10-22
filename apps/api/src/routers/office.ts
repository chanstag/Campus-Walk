import { asc, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { asset, assetType, building, campus, floor, room } from "../db/schema.js";
import { publicProcedure, router } from "../trpc.js";

/**
 * Office summary. A view-specific router rather than a hierarchy level.
 * Item counts are quantity-weighted. "Poor" is condition <= 2. Building-level
 * assets (no room) count toward their campus through building.campus_id.
 */
const items = sql<number>`coalesce(sum(${asset.quantity}), 0)`.mapWith(Number);
const poorItems = sql<number>`coalesce(sum(${asset.quantity}) filter (where ${asset.condition} <= 2), 0)`.mapWith(Number);
const unratedItems = sql<number>`coalesce(sum(${asset.quantity}) filter (where ${asset.condition} is null), 0)`.mapWith(Number);

export const officeRouter = router({
  summary: publicProcedure.query(async ({ ctx }) => {
    const [campuses, rooms, byCategory] = await Promise.all([
      ctx.db
        .select({
          id: campus.id,
          name: campus.name,
          campusType: campus.campusType,
          buildings: count(building.id),
        })
        .from(campus)
        .leftJoin(building, eq(building.campusId, campus.id))
        .groupBy(campus.id)
        .orderBy(asc(campus.name)),
      ctx.db
        .select({
          campusId: building.campusId,
          rooms: count(room.id),
          walked: count(room.assessedAt),
        })
        .from(room)
        .innerJoin(floor, eq(floor.id, room.floorId))
        .innerJoin(building, eq(building.id, floor.buildingId))
        .groupBy(building.campusId),
      ctx.db
        .select({
          campusId: building.campusId,
          category: assetType.category,
          records: count(asset.id),
          items,
          poorItems,
          unratedItems,
        })
        .from(asset)
        .innerJoin(building, eq(building.id, asset.buildingId))
        .innerJoin(assetType, eq(assetType.id, asset.assetTypeId))
        .groupBy(building.campusId, assetType.category),
    ]);

    return campuses.map((c) => {
      const r = rooms.find((x) => x.campusId === c.id);
      const cats = byCategory.filter((x) => x.campusId === c.id);
      const sum = (pick: (x: (typeof cats)[number]) => number) => cats.reduce((n, x) => n + pick(x), 0);
      return {
        campus: { id: c.id, name: c.name, campusType: c.campusType },
        buildings: c.buildings,
        rooms: r?.rooms ?? 0,
        roomsWalked: r?.walked ?? 0,
        assetRecords: sum((x) => x.records),
        items: sum((x) => x.items),
        itemsByCategory: Object.fromEntries(cats.map((x) => [x.category, x.items])) as Record<string, number>,
        poorItems: sum((x) => x.poorItems),
        unratedItems: sum((x) => x.unratedItems),
      };
    });
  }),

  campusDetail: publicProcedure.input(z.object({ campusId: z.uuid() })).query(async ({ ctx, input }) => {
    const [itemsByType, poorAssets, roomsRemaining] = await Promise.all([
      ctx.db
        .select({
          category: assetType.category,
          typeName: assetType.name,
          records: count(asset.id),
          items,
          poorItems,
          unratedItems,
        })
        .from(asset)
        .innerJoin(building, eq(building.id, asset.buildingId))
        .innerJoin(assetType, eq(assetType.id, asset.assetTypeId))
        .where(eq(building.campusId, input.campusId))
        .groupBy(assetType.category, assetType.name)
        .orderBy(asc(assetType.category), asc(assetType.name)),
      ctx.db
        .select({
          id: asset.id,
          typeName: assetType.name,
          category: assetType.category,
          quantity: asset.quantity,
          condition: asset.condition,
          notes: asset.notes,
          assetTag: asset.assetTag,
          building: building.name,
          roomId: room.id,
          floorId: room.floorId,
          roomNumber: room.number,
          roomName: room.name,
        })
        .from(asset)
        .innerJoin(building, eq(building.id, asset.buildingId))
        .innerJoin(assetType, eq(assetType.id, asset.assetTypeId))
        .leftJoin(room, eq(room.id, asset.roomId))
        .where(sql`${building.campusId} = ${input.campusId} and ${asset.condition} <= 2`)
        .orderBy(asc(asset.condition), desc(asset.quantity), asc(building.name), asc(room.number))
        .limit(500),
      ctx.db
        .select({
          id: room.id,
          floorId: room.floorId,
          number: room.number,
          name: room.name,
          roomType: room.roomType,
          floor: floor.name,
          building: building.name,
        })
        .from(room)
        .innerJoin(floor, eq(floor.id, room.floorId))
        .innerJoin(building, eq(building.id, floor.buildingId))
        .where(sql`${building.campusId} = ${input.campusId} and ${room.assessedAt} is null`)
        .orderBy(asc(building.name), asc(floor.level), asc(room.number)),
    ]);
    return { itemsByType, poorAssets, roomsRemaining };
  }),
});
