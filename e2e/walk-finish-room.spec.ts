import { expect, test } from "@playwright/test";
import { openRoom, reseed, SAMPLE, treeRoom } from "./fixtures";

test.describe("walk: finishing a room", () => {
  test.beforeAll(() => reseed());

  test("warns about unrated assets, finishes anyway, and marks the room walked in the tree", async ({ page }) => {
    await openRoom(page, SAMPLE.roomP101);
    await expect(treeRoom(page, SAMPLE.roomP101).getByLabel("Walked")).toHaveCount(0);
    await expect(page.getByText("Not yet")).toBeVisible();

    await page.getByRole("button", { name: "Finish room" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/assets are not rated yet/)).toBeVisible();
    await dialog.getByLabel("Notes").fill("Walked during the e2e run");
    await dialog.getByRole("button", { name: "Finish anyway" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Update room" })).toBeVisible();
    await expect(page.getByText("Walked during the e2e run")).toBeVisible();
    await expect(treeRoom(page, SAMPLE.roomP101).getByLabel("Walked")).toBeVisible();
  });
});
