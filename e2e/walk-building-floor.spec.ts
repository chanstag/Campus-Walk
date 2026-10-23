import { expect, test, type Page } from "@playwright/test";
import { reseed, SAMPLE, TEST_USERS } from "./fixtures";

const sidebar = (page: Page) => page.locator('[data-slot="sidebar"]');
const floorHeading = (page: Page) => page.getByRole("heading", { level: 2 });

async function expandCampus(page: Page) {
  await page.goto("/walk");
  await page.getByRole("button", { name: SAMPLE.campus, exact: true }).click();
  // Gymnasium is never renamed here (the edit test renames Main Building).
  await expect(page.getByRole("button", { name: "Gymnasium", exact: true })).toBeVisible();
}

/** Expands the tree to a floor and selects it, which shows the floor view. */
async function openFloor(page: Page, building: string, floor: string) {
  await expandCampus(page);
  await page.getByRole("button", { name: building, exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${floor} `) }).click();
  await expect(floorHeading(page)).toHaveText(`${building} · ${floor}`);
}

test.describe("walk: adding and editing buildings and floors", () => {
  test.beforeAll(() => reseed());

  test("a new building starts with a First Floor; a new floor suggests its level and name", async ({ page }) => {
    await expandCampus(page);

    await sidebar(page).getByRole("button", { name: "Add building" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/starts with a First Floor/)).toBeVisible();
    await dialog.getByLabel("Name").fill("Annex");
    await dialog.getByLabel("Type").fill("Academic");
    await dialog.getByLabel("Year built").fill("2024");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog).toBeHidden();

    // The new building's first floor is selected and expanded in the tree.
    await expect(floorHeading(page)).toHaveText("Annex · First Floor");
    await expect(page.getByText("Academic · Built 2024 · 1 floor")).toBeVisible();
    await expect(page.getByText("No rooms on First Floor yet.")).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: "Add room" })).toBeVisible();

    // Add a floor: level 2 and "Second Floor" are suggested; the name follows the level.
    await sidebar(page).getByRole("button", { name: "Add floor" }).click();
    const add = page.getByRole("dialog");
    await expect(add.getByLabel("Level")).toHaveValue("2");
    await expect(add.getByLabel("Name")).toHaveValue("Second Floor");
    await add.getByLabel("Level").fill("0");
    await expect(add.getByLabel("Name")).toHaveValue("Ground Floor");
    await add.getByRole("button", { name: "Add", exact: true }).click();
    await expect(add).toBeHidden();

    await expect(floorHeading(page)).toHaveText("Annex · Ground Floor");
    // Ordered by level: Ground (0) above First (1).
    const floors = sidebar(page).getByRole("button", { name: /^(Ground|First) Floor / });
    await expect(floors).toHaveText([/^Ground Floor/, /^First Floor/]);
  });

  test("building and floor details are edited from the floor view, with conflicts shown inline", async ({ page }) => {
    await openFloor(page, "Main Building", "First Floor");

    await page.getByRole("button", { name: "Edit building" }).click();
    const building = page.getByRole("dialog");
    await expect(building.getByLabel("Name")).toHaveValue("Main Building");
    await building.getByLabel("Name").fill("portable p-1");
    await building.getByRole("button", { name: "Save" }).click();
    await expect(building.getByText("Portable P-1 already exists on this campus")).toBeVisible();
    await building.getByLabel("Name").fill("Main Hall");
    await building.getByRole("button", { name: "Save" }).click();
    await expect(building).toBeHidden();
    await expect(floorHeading(page)).toHaveText("Main Hall · First Floor");
    await expect(page.getByRole("button", { name: "Main Hall", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Edit floor" }).click();
    const floor = page.getByRole("dialog");
    await floor.getByLabel("Level").fill("2");
    await floor.getByRole("button", { name: "Save" }).click();
    await expect(floor.getByText("Level 2 is already Second Floor in this building")).toBeVisible();
    await floor.getByLabel("Level").fill("1");
    await floor.getByLabel("Name").fill("Ground Level");
    await floor.getByRole("button", { name: "Save" }).click();
    await expect(floor).toBeHidden();
    await expect(floorHeading(page)).toHaveText("Main Hall · Ground Level");
  });

  test("field users can add rooms but not buildings or floors", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USERS.field.email);
    await page.getByLabel("Password").fill(TEST_USERS.field.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/walk/);

    await openFloor(page, "Gymnasium", "First Floor");
    await expect(sidebar(page).getByRole("button", { name: "Add room" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add building" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add floor" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit building" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit floor" })).toHaveCount(0);
    await context.close();
  });
});
