import { expect, type Page, test } from "@playwright/test";
import { assetCard, openRoom, reseed, SAMPLE } from "./fixtures";

/** The header indicator; it only renders while offline or while writes are waiting. */
function syncStatus(page: Page) {
  return page.getByRole("status", { name: "Sync status" });
}

/**
 * Writes saved to IndexedDB and not yet confirmed by the server. The cache is written a moment
 * after each change, so wait on this before reloading.
 */
function queuedWrites(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction("keyval").objectStore("keyval").get("campus-walk-cache");
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            const raw = get.result as string | undefined;
            resolve(raw ? JSON.parse(raw).json.clientState.mutations.length : 0);
          };
        };
      }),
  );
}

/** Every request the app makes to the API or Better Auth. */
const API = /\/(trpc|api\/auth)\//;

test.describe("walk: offline", () => {
  test.beforeAll(() => reseed());

  test("work done offline, in a room never opened online, is queued and syncs on reconnect", async ({ page, context }) => {
    // Opening a campus caches every room's assets (asset.byCampus), not just the one shown.
    const seeded = page.waitForResponse((r) => r.url().includes("asset.byCampus") && r.ok());
    await openRoom(page, SAMPLE.room101);
    await seeded;

    await context.setOffline(true);
    await expect(syncStatus(page)).toHaveText("Offline");

    // Tree navigation is client-side; P101 was never opened, so its assets come from the seed.
    await page.getByRole("button", { name: SAMPLE.roomP101.building, exact: true }).click();
    await page.getByRole("button", { name: new RegExp(`^${SAMPLE.roomP101.floor} `) }).last().click();
    await page.getByRole("button", { name: new RegExp(`^${SAMPLE.roomP101.number} ${SAMPLE.roomP101.name}`) }).click();
    await expect(page.getByRole("heading", { level: 2, name: /^P101/ })).toBeVisible();
    const first = page.getByRole("article").first();
    await expect(first.getByText("Not rated")).toBeVisible();

    // A second tap on a card with a queued rating still works; the last tap wins.
    const picker = first.getByRole("group", { name: "Condition" });
    await picker.getByRole("button", { name: "Fair" }).click();
    await picker.getByRole("button", { name: "Excellent" }).click();
    await expect(picker.getByRole("button", { name: "Excellent" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Add asset" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: /^Projector/ }).click();
    await dialog.getByLabel("Notes").fill("Added offline");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(assetCard(page, "Added offline")).toBeVisible();

    await expect(syncStatus(page)).toHaveText("Offline: 3 changes waiting");

    await context.setOffline(false);
    await expect(syncStatus(page)).toBeHidden({ timeout: 15_000 });

    await page.reload();
    await expect(assetCard(page, "Added offline")).toBeVisible();
    await expect(page.getByRole("article").first().getByRole("button", { name: "Excellent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("a queued write survives a reload while the API is unreachable, then syncs", async ({ page }) => {
    await openRoom(page, SAMPLE.room101);
    const card = assetCard(page, "Student Desk");
    await expect(card.getByRole("button", { name: "Good" })).toHaveAttribute("aria-pressed", "true");

    // The browser still says "online" (flaky Wi-Fi): requests just fail.
    await page.route(API, (route) => route.abort());
    await card.getByRole("button", { name: "Poor" }).click();
    await expect(syncStatus(page)).toContainText("1 change waiting");
    await expect.poll(() => queuedWrites(page)).toBe(1);

    // Reload with the API still unreachable: session, tree, room and the queued write all come from the device.
    await page.reload();
    const restored = assetCard(page, "Student Desk");
    await expect(restored.getByRole("button", { name: "Poor" })).toHaveAttribute("aria-pressed", "true");
    await expect(syncStatus(page)).toContainText("1 change waiting");

    await page.unroute(API);
    await expect(syncStatus(page)).toBeHidden({ timeout: 15_000 });

    await page.reload();
    await expect(assetCard(page, "Student Desk").getByRole("button", { name: "Poor" })).toHaveAttribute("aria-pressed", "true");
  });
});
