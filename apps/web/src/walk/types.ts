import type { RouterOutputs } from "api/src/router";

export type CampusTree = RouterOutputs["campus"]["tree"];
export type Building = CampusTree["buildings"][number];
export type Floor = Building["floors"][number];
export type Room = Floor["rooms"][number];
export type AssetWithType = RouterOutputs["asset"]["byRoom"][number];

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
