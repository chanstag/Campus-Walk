import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export { TEST_USERS } from "../apps/api/src/test/users";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Truncates the campus tables in the test branch and reloads the sample data (a few seconds).
 * Call it in `test.beforeAll` of any spec that writes, so specs do not depend on each other.
 */
export function reseed() {
  execFileSync("pnpm", ["--filter", "api", "db:seed:test"], { cwd: ROOT, stdio: "pipe" });
}

/** Stable sample-data targets. Numbers and names are human identifiers; ids change on every seed. */
export const SAMPLE = {
  campus: "Bluebonnet Elementary",
  otherCampus: "Cedar Ridge High School",
  /** Walked, 7 rated assets. */
  room101: { campus: "Bluebonnet Elementary", building: "Main Building", floor: "First Floor", number: "101", name: "Classroom 101" },
  /** Unwalked, every asset unrated. */
  roomP101: { campus: "Bluebonnet Elementary", building: "Portable P-1", floor: "First Floor", number: "P101", name: "Classroom P101" },
} as const;

export type RoomTarget = { campus: string; building: string; floor: string; number: string; name: string };

/** Clicks through the sidebar tree to a room and waits for its asset grid. */
export async function openRoom(page: Page, room: RoomTarget) {
  await page.goto("/walk");
  await page.getByRole("button", { name: room.campus, exact: true }).click();
  await page.getByRole("button", { name: room.building, exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${room.floor} `) }).click();
  await page.getByRole("button", { name: new RegExp(`^${room.number} ${room.name}`) }).click();
  await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${room.number}`) })).toBeVisible();
  // The grid shows a record/item count once asset.byRoom has loaded (or the empty state).
  await expect(page.getByText(/\d+ records?, \d+ items?|No assets recorded/)).toBeVisible();
}

/** The sidebar entry for a room, e.g. to check its "Walked" mark. */
export function treeRoom(page: Page, room: RoomTarget) {
  return page.getByRole("button", { name: new RegExp(`^${room.number} ${room.name}`) });
}

/** One asset card on the walk screen, by any text it shows (type name, tag, notes). */
export function assetCard(page: Page, text: string | RegExp) {
  return page.getByRole("article").filter({ hasText: text });
}
