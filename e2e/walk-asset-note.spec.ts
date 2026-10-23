import { expect, test } from "@playwright/test";
import { assetCard, openRoom, reseed, SAMPLE } from "./fixtures";

test.describe("walk: quick note on an asset card", () => {
  test.beforeAll(() => reseed());

  test("a note can be added and edited inline, and cancel keeps the old note", async ({ page }) => {
    await openRoom(page, SAMPLE.room101);

    // Add an asset to work with, so the note text identifies the card.
    await page.getByRole("button", { name: "Add asset" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: /^Projector/ }).click();
    await dialog.getByLabel("Notes").fill("Quick note e2e");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog).toBeHidden();

    // Edit inline and save with the button.
    const card = assetCard(page, "Quick note e2e");
    await card.getByRole("button", { name: "Edit note" }).click();
    // While editing, the card no longer shows the note text, so find the one open note box directly.
    const box = page.getByRole("textbox", { name: /^Note for/ });
    await expect(box).toBeFocused();
    await box.fill("Quick note e2e, lamp flickers");
    await page.getByRole("button", { name: "Save note" }).click();
    const saved = assetCard(page, "Quick note e2e, lamp flickers");
    await expect(box).toHaveCount(0);
    await expect(saved).toBeVisible();

    // Cancel with Escape leaves the note alone.
    await saved.getByRole("button", { name: "Edit note" }).click();
    await box.fill("Quick note e2e, discarded");
    await box.press("Escape");
    await expect(assetCard(page, "Quick note e2e, lamp flickers")).toBeVisible();

    // Ctrl+Enter saves after a reload, so it really reached the database.
    await page.reload();
    const again = assetCard(page, "Quick note e2e, lamp flickers");
    await again.getByRole("button", { name: "Edit note" }).click();
    await box.fill("Quick note e2e, replaced");
    await box.press("Control+Enter");
    await expect(assetCard(page, "Quick note e2e, replaced")).toBeVisible();
    await page.reload();
    await expect(assetCard(page, "Quick note e2e, replaced")).toBeVisible();
  });
});
