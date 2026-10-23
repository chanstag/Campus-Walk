import { defineConfig } from "vitest/config";

// One Vitest run covers both apps; each has its own vitest.config.ts with its environment.
export default defineConfig({
  test: {
    projects: ["apps/api", "apps/web"],
  },
});
