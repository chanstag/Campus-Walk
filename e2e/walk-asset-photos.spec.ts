import path from "node:path";
import { expect, test } from "@playwright/test";
import { openRoom, reseed, SAMPLE } from "./fixtures";

const PHOTO = path.resolve(import.meta.dirname, "files/asset-photo.png");

test.describe("walk: asset photos", () => {
  test.beforeAll(() => reseed());

  test("a photo can be added to an asset, survives a reload, opens full size and can be deleted", async ({ page }) => {
    await openRoom(page, SAMPLE.room101);
    const card = page.getByRole("article").first();

    const chooser = page.waitForEvent("filechooser");
    await card.getByRole("button", { name: /^Add photo of / }).click();
    await (await chooser).setFiles(PHOTO);

    const thumb = card.getByRole("button", { name: /^Open photo 1 of / });
    await expect(thumb).toBeVisible();
    // The thumbnail is served from a signed blob-store URL and actually decodes.
    const img = thumb.locator("img");
    await expect(img).toHaveAttribute("src", /^\/files\/assets\/.+\?exp=\d+&sig=/);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByRole("article").first().getByRole("button", { name: /^Open photo 1 of / })).toBeVisible();

    await page.getByRole("article").first().getByRole("button", { name: /^Open photo 1 of / }).click();
    const viewer = page.getByRole("dialog");
    await expect(viewer.getByRole("img", { name: /^Photo of / })).toBeVisible();
    await viewer.getByRole("button", { name: "Delete photo" }).click();
    await expect(viewer).toBeHidden();
    await expect(page.getByRole("article").first().getByRole("button", { name: /^Open photo/ })).toHaveCount(0);
  });

  test("a tampered photo URL is refused", async ({ page, request }) => {
    await openRoom(page, SAMPLE.room101);
    const card = page.getByRole("article").first();
    const chooser = page.waitForEvent("filechooser");
    await card.getByRole("button", { name: /^Add photo of / }).click();
    await (await chooser).setFiles(PHOTO);
    const src = await card.getByRole("button", { name: /^Open photo 1 of / }).locator("img").getAttribute("src");
    expect((await request.get(src!)).status()).toBe(200);
    expect((await request.get(src!.replace(/sig=./, "sig=X"))).status()).toBe(403);
  });
});
