import { expect, test } from "@playwright/test";
import { assetCard, openRoom, reseed, SAMPLE } from "./fixtures";

test.describe("walk: rating an asset", () => {
  test.beforeAll(() => reseed());

  test("a tap on the picker updates the badge at once, persists, and a second tap clears it", async ({ page }) => {
    await openRoom(page, SAMPLE.room101);
    const card = assetCard(page, "Student Desk");
    const picker = card.getByRole("group", { name: "Condition" });
    const excellent = picker.getByRole("button", { name: "Excellent" });

    // Sample: Student Desk ×23 is rated Good (4).
    await expect(picker.getByRole("button", { name: "Good" })).toHaveAttribute("aria-pressed", "true");

    await excellent.click();
    await expect(excellent).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByText("Excellent").first()).toBeVisible();

    await page.reload();
    const after = assetCard(page, "Student Desk");
    await expect(after.getByRole("button", { name: "Excellent" })).toHaveAttribute("aria-pressed", "true");

    await after.getByRole("button", { name: "Excellent" }).click();
    await expect(after.getByRole("button", { name: "Excellent" })).toHaveAttribute("aria-pressed", "false");
    await expect(after.getByText("Not rated")).toBeVisible();
    await expect(page.getByText(/1 not rated/)).toBeVisible();
  });
});
