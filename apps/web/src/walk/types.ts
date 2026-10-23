import type { RouterOutputs } from "api/src/router";

export type CampusTree = RouterOutputs["campus"]["tree"];
export type Building = CampusTree["buildings"][number];
export type Floor = Building["floors"][number];
export type Room = Floor["rooms"][number];
export type AssetWithType = RouterOutputs["asset"]["byRoom"][number];

/** Where an asset list lives: a room, or a building's own (room-less) assets. */
export type AssetLocation = { roomId: string } | { buildingId: string };

export function isRoomLocation(loc: AssetLocation): loc is { roomId: string } {
  return "roomId" in loc;
}

export function sameLocation(a: AssetLocation | null, b: AssetLocation | null) {
  if (!a || !b) return false;
  return isRoomLocation(a) ? isRoomLocation(b) && a.roomId === b.roomId : !isRoomLocation(b) && a.buildingId === b.buildingId;
}

export function findBuilding(tree: CampusTree | undefined, buildingId: string | null) {
  if (!tree || !buildingId) return undefined;
  return tree.buildings.find((b) => b.id === buildingId);
}

export function findFloor(tree: CampusTree | undefined, floorId: string | null) {
  if (!tree || !floorId) return undefined;
  for (const building of tree.buildings) {
    const floor = building.floors.find((f) => f.id === floorId);
    if (floor) return { building, floor };
  }
  return undefined;
}

export function findRoom(tree: CampusTree | undefined, roomId: string | null) {
  if (!tree || !roomId) return undefined;
  for (const building of tree.buildings)
    for (const floor of building.floors) {
      const room = floor.rooms.find((r) => r.id === roomId);
      if (room) return { building, floor, room };
    }
  return undefined;
}

export function walkedCount(rooms: Room[]) {
  return rooms.filter((r) => r.assessedAt != null).length;
}
