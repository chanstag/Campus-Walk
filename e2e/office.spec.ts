import { expect, test } from "@playwright/test";
import { reseed, SAMPLE } from "./fixtures";

test.describe("office", () => {
  test.beforeAll(() => reseed());

  test("shows a card per campus and the selected campus's detail, linking into the walk", async ({ page }) => {
    await page.goto("/office");
    const bluebonnet = page.getByRole("button", { name: new RegExp(`^${SAMPLE.campus}`) });
    await expect(bluebonnet).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`^${SAMPLE.otherCampus}`) })).toBeVisible();
    await expect(bluebonnet).toContainText(/Rooms walked\s*\d+ \/ \d+/);

    await bluebonnet.click();
    await expect(page).toHaveURL(/\/office\?campus=/);
    await expect(bluebonnet).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Items by type" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Items in poor condition/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Rooms yet to be walked/ })).toContainText("(2)");

    // A room still to be walked links straight to it on the walk screen.
    await page.getByRole("link", { name: /^P101 / }).click();
    await expect(page).toHaveURL(/\/walk\?campus=[^&]+&floor=[^&]+&room=[^&]+$/);
    await expect(page.getByRole("heading", { level: 2, name: /^P101/ })).toBeVisible();
  });

  test("the office and walk screens share the ?campus= key", async ({ page }) => {
    await page.goto("/office");
    await page.getByRole("button", { name: new RegExp(`^${SAMPLE.campus}`) }).click();
    await expect(page).toHaveURL(/campus=/);
    const campusId = new URL(page.url()).searchParams.get("campus");

    // The same id selects the campus on the walk screen (the nav link itself goes to a bare /walk).
    await page.goto(`/walk?campus=${campusId}`);
    await expect(page.getByRole("navigation", { name: "Location" })).toContainText(SAMPLE.campus);
    await expect(page.getByText("Pick a room to see its assets.")).toBeVisible();

    await page.goto(`/office?campus=${campusId}`);
    await expect(page.getByRole("button", { name: new RegExp(`^${SAMPLE.campus}`) })).toHaveAttribute("aria-pressed", "true");
  });
});
