import { expect, test } from "@playwright/test";
import { assetCard, openRoom, reseed, SAMPLE } from "./fixtures";

test.describe("walk: adding, editing and deleting an asset", () => {
  test.beforeAll(() => reseed());

  test("an added asset appears in its category, can be edited, and can be deleted", async ({ page }) => {
    await openRoom(page, SAMPLE.room101);

    // Add
    await page.getByRole("button", { name: "Add asset" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: /^Projector/ }).click();
    await dialog.getByLabel("Notes").fill("Added by e2e");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog).toBeHidden();

    const card = assetCard(page, "Added by e2e");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Projector");
    await expect(card.getByText("Not rated")).toBeVisible();

    // Edit
    await card.getByRole("button", { name: "Asset actions" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const edit = page.getByRole("dialog");
    await expect(edit.getByRole("heading", { name: "Edit asset" })).toBeVisible();
    await edit.getByLabel("Notes").fill("Edited by e2e");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit).toBeHidden();
    await expect(assetCard(page, "Edited by e2e")).toBeVisible();
    await expect(assetCard(page, "Added by e2e")).toHaveCount(0);

    // Delete
    const edited = assetCard(page, "Edited by e2e");
    await edited.getByRole("button", { name: "Asset actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const confirm = page.getByRole("alertdialog").or(page.getByRole("dialog"));
    await expect(confirm.getByText("Delete this asset?")).toBeVisible();
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(assetCard(page, "Edited by e2e")).toHaveCount(0);
  });
});
