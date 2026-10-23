import { expect, test as setup } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config";
import { reseed, TEST_USERS } from "./fixtures";

// Runs once before the spec files: fresh data, then a real sign-in through the login page.
// The resulting cookie jar is saved and loaded by every spec (see playwright.config.ts).
setup("reseed the test database and sign in as the test admin", async ({ page }) => {
  reseed();

  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_USERS.admin.email);
  await page.getByLabel("Password").fill(TEST_USERS.admin.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/walk/);
  await expect(page.getByText(TEST_USERS.admin.name)).toBeVisible();
  await page.context().storageState({ path: STORAGE_STATE });
});
