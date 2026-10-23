// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "campus-walk:theme";

/** The store is module-level state, so each test gets a fresh copy of the module. */
async function load() {
  vi.resetModules();
  return import("./use-theme");
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

describe("theme store", () => {
  it("defaults to light when nothing is stored (jsdom has no matchMedia)", async () => {
    const { initTheme } = await load();
    initTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("applies a stored choice on init", async () => {
    localStorage.setItem(KEY, "dark");
    const { initTheme } = await load();
    initTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("ignores a corrupt stored value", async () => {
    localStorage.setItem(KEY, "sepia");
    const { initTheme } = await load();
    initTheme();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setTheme toggles the html class and persists", async () => {
    const { setTheme } = await load();
    setTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(KEY)).toBe("dark");
    setTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("light");
  });
});
