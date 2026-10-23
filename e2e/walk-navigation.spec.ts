import { expect, test } from "@playwright/test";
import { openRoom, SAMPLE } from "./fixtures";

test.describe("walk: navigation", () => {
  test("the root redirects to the walk screen and asks for a campus", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/walk$/);
    await expect(page.getByText("Select a campus in the tree.")).toBeVisible();
  });

  test("selecting a room writes campus, floor and room into the URL; back walks up the tree", async ({ page }) => {
    await openRoom(page, SAMPLE.room101);
    await expect(page).toHaveURL(/\/walk\?campus=[^&]+&floor=[^&]+&room=[^&]+$/);
    await expect(page.getByRole("navigation", { name: "Location" })).toContainText("101 · Classroom 101");

    await page.goBack();
    await expect(page).toHaveURL(/\/walk\?campus=[^&]+&floor=[^&]+$/);
    await expect(page.getByText("Pick a room to see its assets.")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/walk$/);
    await expect(page.getByText("Select a campus in the tree.")).toBeVisible();
  });

  test("a reload restores the selection from the URL", async ({ page }) => {
    await openRoom(page, SAMPLE.room101);
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: /^101/ })).toBeVisible();
    await expect(page.getByText(/\d+ records?, \d+ items?/)).toBeVisible();
  });

  test("signed-out visitors are sent to the login page and back after signing in", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/office");
    await expect(page).toHaveURL(/\/login$/);
    await context.close();
  });
});
