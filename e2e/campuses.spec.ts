import { expect, test, type Page } from "@playwright/test";
import { reseed, SAMPLE, TEST_USERS } from "./fixtures";

const DISTRICT = "Cedar Ridge ISD";

const district = (page: Page, name: string) => page.getByRole("region", { name });

test.describe("campuses: adding and editing districts and campuses", () => {
  test.beforeAll(() => reseed());

  test("a new district starts empty; a campus added to it opens on the walk screen", async ({ page }) => {
    await page.goto("/walk");
    await page.getByRole("link", { name: "Campuses" }).click();
    await expect(page).toHaveURL(/\/campuses$/);
    await expect(district(page, DISTRICT).getByRole("link", { name: SAMPLE.campus })).toBeVisible();

    await page.getByRole("button", { name: "Add district" }).click();
    const add = page.getByRole("dialog");
    await add.getByLabel("Name").fill("cedar ridge isd");
    await add.getByRole("button", { name: "Add", exact: true }).click();
    await expect(add.getByText(`${DISTRICT} already exists`)).toBeVisible();
    await add.getByLabel("Name").fill("Austin ISD");
    await add.getByRole("button", { name: "Add", exact: true }).click();
    await expect(add).toBeHidden();
    await expect(district(page, "Austin ISD").getByText("No campuses in Austin ISD yet.")).toBeVisible();

    await district(page, "Austin ISD").getByRole("button", { name: "Add campus" }).click();
    const campus = page.getByRole("dialog");
    await expect(campus.getByText("New campus in Austin ISD.")).toBeVisible();
    await campus.getByLabel("Name").fill("Live Oak Middle");
    await campus.getByLabel("Type").fill("Middle");
    await campus.getByLabel("Year opened").fill("1998");
    await campus.getByLabel("Site area (acres)").fill("14.5");
    await campus.getByRole("button", { name: "Add", exact: true }).click();
    await expect(campus).toBeHidden();

    const row = district(page, "Austin ISD").getByRole("row", { name: /Live Oak Middle/ });
    await expect(row).toContainText("Middle");
    await expect(row).toContainText("1998");
    await expect(row).toContainText("14.5");

    await row.getByRole("link", { name: "Live Oak Middle" }).click();
    await expect(page).toHaveURL(/\/walk\?campus=/);
    await expect(page.getByRole("button", { name: "Live Oak Middle", exact: true })).toBeVisible();
  });

  test("a district is renamed and a campus edited or moved, with conflicts shown inline", async ({ page }) => {
    await page.goto("/campuses");

    await page.getByRole("button", { name: "Rename Austin ISD" }).click();
    const rename = page.getByRole("dialog");
    await rename.getByLabel("Name").fill("Austin Independent SD");
    await rename.getByRole("button", { name: "Save" }).click();
    await expect(rename).toBeHidden();
    await expect(district(page, "Austin Independent SD")).toBeVisible();

    await page.getByRole("button", { name: `Edit ${SAMPLE.otherCampus}` }).click();
    const edit = page.getByRole("dialog");
    await expect(edit.getByLabel("Name")).toHaveValue(SAMPLE.otherCampus);
    await edit.getByLabel("Name").fill(SAMPLE.campus.toLowerCase());
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit.getByText(`${SAMPLE.campus} already exists in this district`)).toBeVisible();
    await edit.getByLabel("Name").fill("Cedar Ridge HS");
    await edit.getByLabel("District").click();
    await page.getByRole("option", { name: "Austin Independent SD" }).click();
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(edit).toBeHidden();

    await expect(district(page, "Austin Independent SD").getByRole("link", { name: "Cedar Ridge HS" })).toBeVisible();
    await expect(district(page, DISTRICT).getByRole("link", { name: "Cedar Ridge HS" })).toHaveCount(0);
  });

  test("field users don't see the page or its link", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USERS.field.email);
    await page.getByLabel("Password").fill(TEST_USERS.field.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/walk/);

    await expect(page.getByRole("link", { name: "Campuses" })).toHaveCount(0);
    await page.goto("/campuses");
    await expect(page.getByText("You do not have access to this page.")).toBeVisible();
    await context.close();
  });
});
