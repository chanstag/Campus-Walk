import { defineConfig, devices } from "@playwright/test";

// End-to-end: the real Vite app against the real Fastify API, both started here on their own
// ports (API 3101, web 5174) so a run can coexist with `pnpm dev` on 3001/5173. The API reads
// apps/api/.env.test (Neon `test` branch); the Vite proxy follows API_PORT.
//
// Files run one at a time: there is one shared database. The `setup` project reseeds it and
// signs in once; every spec then starts from that saved session.

export const API_PORT = 3101;
export const WEB_PORT = 5174;
export const STORAGE_STATE = "e2e/.auth/admin.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /setup\.ts$/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      testMatch: /.*\.spec\.ts$/,
    },
  ],
  // Both are package scripts (`dev:test`) so pnpm does not try to parse their flags itself.
  webServer: [
    {
      command: "pnpm --filter api dev:test", // tsx --env-file=.env.test src/index.ts  (PORT=3101 from .env.test)
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "pnpm --filter web dev:test", // vite --port 5174 --strictPort
      url: `http://localhost:${WEB_PORT}`,
      env: { API_PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
