import { expect, test, type Page } from "@playwright/test";
import { reseed, SAMPLE, treeRoom } from "./fixtures";

const portable = SAMPLE.roomP101;

/** Expands the tree down to Portable P-1's first floor, which also selects the floor. */
async function openPortableFloor(page: Page) {
  await page.goto("/walk");
  await page.getByRole("button", { name: portable.campus, exact: true }).click();
  await page.getByRole("button", { name: portable.building, exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${portable.floor} `) }).click();
  await expect(treeRoom(page, portable)).toBeVisible();
}

test.describe("walk: adding and editing a room", () => {
  test.beforeAll(() => reseed());

  test("a room added from the tree is selected, and its details can be edited", async ({ page }) => {
    await openPortableFloor(page);

    // Add from the tree row at the end of the floor.
    await page.locator('[data-slot="sidebar"]').getByRole("button", { name: "Add room" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add room" })).toBeVisible();
    await dialog.getByLabel("Number").fill("P150");
    await dialog.getByLabel("Type").fill("Storage");
    await dialog.getByLabel("Area (sf)").fill("140");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog).toBeHidden();

    // The new room opens: unwalked, no assets, name defaulted to the number.
    const heading = page.getByRole("heading", { level: 2 });
    await expect(heading).toHaveText("P150");
    await expect(page.getByText("Storage", { exact: true })).toBeVisible();
    await expect(page.getByText("140 sf")).toBeVisible();
    await expect(page.getByText("No assets recorded")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish room" })).toBeVisible();
    const newRoom = { ...portable, number: "P150", name: "P150" };
    await expect(treeRoom(page, newRoom)).toBeVisible();
    await expect(treeRoom(page, newRoom).getByLabel("Walked")).toHaveCount(0);

    // Edit: a clashing number is refused inline, then a valid one saves.
    await page.getByRole("button", { name: "Edit details" }).click();
    const edit = page.getByRole("dialog");
    await expect(edit.getByRole("heading", { name: "Edit room" })).toBeVisible();
    await expect(edit.getByLabel("Name")).toHaveValue("");
    await edit.getByLabel("Number").fill(portable.number);
    await edit.getByLabel("Name").fill("Custodial storage");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit.getByText(`Room ${portable.number} already exists on this floor`)).toBeVisible();

    await edit.getByLabel("Number").fill("P150A");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit).toBeHidden();
    await expect(heading).toHaveText("P150A · Custodial storage");
    await expect(treeRoom(page, { ...portable, number: "P150A", name: "Custodial storage" })).toBeVisible();
  });

  test("the floor view offers Add room when no room is selected", async ({ page }) => {
    await openPortableFloor(page);
    const main = page.getByRole("main");
    await expect(main.getByText("Pick a room to see its assets.")).toBeVisible();
    await main.getByRole("button", { name: "Add room" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(`New room on ${portable.floor}.`)).toBeVisible();
    await dialog.getByLabel("Number").fill("P151");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("P151");
  });
});
