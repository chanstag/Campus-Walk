import path from "node:path";
import { defineProject } from "vitest/config";

// Pure functions and stores only; no React Testing Library. Component behaviour is covered by
// the Playwright specs in /e2e. Files that need a DOM opt in with `// @vitest-environment jsdom`.
export default defineProject({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    name: "web",
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
