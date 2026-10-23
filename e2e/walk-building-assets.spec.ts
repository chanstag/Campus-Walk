import { expect, test } from "@playwright/test";
import { assetCard, openBuilding, openRoom, reseed, SAMPLE, TEST_USERS, treeBuilding, treeRoom } from "./fixtures";

const main = { campus: SAMPLE.campus, building: "Main Building" };
const room102 = { ...SAMPLE.room101, number: "102", name: "Classroom 102" };

test.describe("walk: building-level assets", () => {
  test.beforeAll(() => reseed());

  test("clicking a building shows its building systems, which can be rated like room assets", async ({ page }) => {
    await openBuilding(page, main.campus, main.building);
    await expect(page).toHaveURL(/\/walk\?campus=[^&]+&building=[^&]+$/);
    await expect(page.getByRole("navigation", { name: "Location" })).toContainText(main.building);
    // Sample: 11 room-less assets in Main Building (HVAC, boiler, roof, …); its floors stay in the tree.
    await expect(page.getByText(/^11 records/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^First Floor / })).toBeVisible();

    // CR-1212 is the Boiler, rated Poor (2).
    const boiler = assetCard(page, "CR-1212");
    await expect(boiler).toContainText("Boiler");
    const good = boiler.getByRole("group", { name: "Condition" }).getByRole("button", { name: "Good" });
    await good.click();
    await expect(good).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(assetCard(page, "CR-1212").getByRole("button", { name: "Good" })).toHaveAttribute("aria-pressed", "true");
  });

  test("adding an asset at building level offers building systems first", async ({ page }) => {
    await openBuilding(page, main.campus, main.building);
    await page.getByRole("button", { name: "Add asset" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Type" }).click();
    await expect(page.getByRole("option").first()).toContainText("Building System");
    await page.getByRole("option", { name: /^Elevator/ }).click();
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/^12 records/)).toBeVisible();
  });

  test("the card menu moves a room asset to building level", async ({ page }) => {
    await openRoom(page, SAMPLE.room101);
    await assetCard(page, "CR-1005").getByRole("button", { name: "Asset actions" }).click();
    await page.getByRole("menuitem", { name: "Move…" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Destination" }).click();
    await page.getByRole("group", { name: main.building }).getByRole("option", { name: "Building level" }).click();
    await dialog.getByRole("button", { name: "Move" }).click();
    await expect(dialog).toBeHidden();
    await expect(assetCard(page, "CR-1005")).toHaveCount(0);

    await treeBuilding(page, main.building).click();
    await expect(page.getByRole("heading", { level: 2, name: main.building, exact: true })).toBeVisible();
    await expect(assetCard(page, "CR-1005")).toBeVisible();
  });

  test("dragging a building-level card onto a room in the tree places it there", async ({ page }) => {
    // Opening room 101 first leaves its building and floor expanded; selecting the building keeps them so.
    await openRoom(page, SAMPLE.room101);
    await treeBuilding(page, main.building).click();
    await expect(page.getByRole("heading", { level: 2, name: main.building, exact: true })).toBeVisible();
    const card = assetCard(page, "CR-1005");
    await expect(card).toBeVisible();

    await card.dragTo(treeRoom(page, room102));
    await expect(card).toHaveCount(0);

    await treeRoom(page, room102).click();
    await expect(page.getByRole("heading", { level: 2, name: /^102/ })).toBeVisible();
    await expect(assetCard(page, "CR-1005")).toBeVisible();
  });

  test("field users can rate building systems but not edit the building", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USERS.field.email);
    await page.getByLabel("Password").fill(TEST_USERS.field.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/walk/);

    await openBuilding(page, main.campus, main.building);
    await expect(page.getByRole("button", { name: "Edit building" })).toHaveCount(0);
    const roof = assetCard(page, "CR-1211");
    await roof.getByRole("button", { name: "Excellent" }).click();
    await expect(roof.getByRole("button", { name: "Excellent" })).toHaveAttribute("aria-pressed", "true");
    await context.close();
  });
});
