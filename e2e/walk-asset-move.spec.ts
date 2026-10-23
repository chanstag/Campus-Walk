import { expect, test } from "@playwright/test";
import { assetCard, openRoom, reseed, SAMPLE, treeRoom } from "./fixtures";

const room102 = { ...SAMPLE.room101, number: "102", name: "Classroom 102" };

test.describe("walk: moving an asset to another room", () => {
  test.beforeAll(() => reseed());

  test("dragging a card onto a room in the tree moves it there", async ({ page }) => {
    await openRoom(page, SAMPLE.room101);
    const card = assetCard(page, "CR-1005");
    await expect(card).toBeVisible();

    await card.dragTo(treeRoom(page, room102));
    await expect(card).toHaveCount(0);
    await expect(page.getByText(/^6 records/)).toBeVisible();

    await treeRoom(page, room102).click();
    await expect(page.getByRole("heading", { level: 2, name: /^102/ })).toBeVisible();
    await expect(assetCard(page, "CR-1005")).toBeVisible();
  });

  test("the card menu moves an asset into a room in another building", async ({ page }) => {
    await openRoom(page, room102);
    await assetCard(page, "CR-1005").getByRole("button", { name: "Asset actions" }).click();
    await page.getByRole("menuitem", { name: "Move to room…" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Room" }).click();
    await page.getByRole("option", { name: /^P101/ }).click();
    await dialog.getByRole("button", { name: "Move" }).click();
    await expect(dialog).toBeHidden();
    await expect(assetCard(page, "CR-1005")).toHaveCount(0);

    await openRoom(page, SAMPLE.roomP101);
    await expect(assetCard(page, "CR-1005")).toBeVisible();
  });
});
