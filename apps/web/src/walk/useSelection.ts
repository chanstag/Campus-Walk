import { parseAsString, useQueryStates } from "nuqs";
import type { AssetLocation } from "./types";

/**
 * Current campus / building / floor / room, stored in the URL (?campus=&building=&floor=&room=).
 * Components use this and never nuqs directly, so swapping to a router later
 * only touches this file. Ids are not validated here; the components treat an
 * id that is missing from the fetched data as "not found".
 *
 * `building` is set only when the building itself is selected (its own assets);
 * a floor or room selection leaves it empty, so the URL names exactly one leaf.
 *
 * Every level is a tree node, so every change pushes a history entry and the
 * back button walks the tree in reverse.
 */
export function useSelection() {
  const [{ campus, building, floor, room }, set] = useQueryStates({
    campus: parseAsString,
    building: parseAsString,
    floor: parseAsString,
    room: parseAsString,
  });

  return {
    campusId: campus,
    buildingId: building,
    floorId: floor,
    roomId: room,
    /** The asset list on screen, if any: drags and moves start from here. */
    assetLocation: (room ? { roomId: room } : building ? { buildingId: building } : null) as AssetLocation | null,
    /** Picking a campus clears everything below it. */
    selectCampus: (campusId: string) =>
      set({ campus: campusId, building: null, floor: null, room: null }, { history: "push" }),
    /** A building's own assets (building systems, unplaced equipment). */
    selectBuilding: (campusId: string, buildingId: string) =>
      set({ campus: campusId, building: buildingId, floor: null, room: null }, { history: "push" }),
    /** Picking a floor also sets its campus, so a click in another campus is one history entry. */
    selectFloor: (campusId: string, floorId: string) =>
      set({ campus: campusId, building: null, floor: floorId, room: null }, { history: "push" }),
    /** Same for rooms: the whole path is written at once. */
    selectRoom: (campusId: string, floorId: string, roomId: string) =>
      set({ campus: campusId, building: null, floor: floorId, room: roomId }, { history: "push" }),
  };
}
