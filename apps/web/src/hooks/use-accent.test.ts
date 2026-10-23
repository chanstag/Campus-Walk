// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "campus-walk:accent";

async function load() {
  vi.resetModules();
  return import("./use-accent");
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.accent;
});

describe("accent store", () => {
  it("leaves data-accent unset for the default", async () => {
    const { initAccent } = await load();
    initAccent();
    expect(document.documentElement.dataset.accent).toBeUndefined();
  });

  it("applies a stored accent on init and ignores unknown ids", async () => {
    localStorage.setItem(KEY, "sage");
    let mod = await load();
    mod.initAccent();
    expect(document.documentElement.dataset.accent).toBe("sage");

    localStorage.setItem(KEY, "neon-pink");
    delete document.documentElement.dataset.accent;
    mod = await load();
    mod.initAccent();
    expect(document.documentElement.dataset.accent).toBeUndefined();
  });

  it("setAccent writes the attribute, persists, and clears on default", async () => {
    const { setAccent } = await load();
    setAccent("cool-steel");
    expect(document.documentElement.dataset.accent).toBe("cool-steel");
    expect(localStorage.getItem(KEY)).toBe("cool-steel");
    setAccent("default");
    expect(document.documentElement.dataset.accent).toBeUndefined();
    expect(localStorage.getItem(KEY)).toBe("default");
  });

  it("every ACCENTS id has a label", async () => {
    const { ACCENTS } = await load();
    expect(ACCENTS.every((a) => a.id.length > 0 && a.label.length > 0)).toBe(true);
  });
});
