import { parseAsString, useQueryStates } from "nuqs";

/**
 * Current campus / floor / room, stored in the URL (?campus=&floor=&room=).
 * Components use this and never nuqs directly, so swapping to a router later
 * only touches this file. Ids are not validated here; the components treat an
 * id that is missing from the fetched data as "not found".
 *
 * Every level is a tree node, so every change pushes a history entry and the
 * back button walks the tree in reverse.
 */
export function useSelection() {
  const [{ campus, floor, room }, set] = useQueryStates({
    campus: parseAsString,
    floor: parseAsString,
    room: parseAsString,
  });

  return {
    campusId: campus,
    floorId: floor,
    roomId: room,
    /** Picking a campus clears everything below it. */
    selectCampus: (campusId: string) =>
      set({ campus: campusId, floor: null, room: null }, { history: "push" }),
    /** Picking a floor also sets its campus, so a click in another campus is one history entry. */
    selectFloor: (campusId: string, floorId: string) =>
      set({ campus: campusId, floor: floorId, room: null }, { history: "push" }),
    /** Same for rooms: the whole path is written at once. */
    selectRoom: (campusId: string, floorId: string, roomId: string) =>
      set({ campus: campusId, floor: floorId, room: roomId }, { history: "push" }),
  };
}
