import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { defineProject } from "vitest/config";

// API tests run procedures in-process against the Neon `test` branch named in .env.test.
// They truncate tables, so this config refuses to run against the dev database in .env.

function readEnvFile(name: string): Record<string, string> {
  const file = resolve(import.meta.dirname, name);
  return existsSync(file) ? parse(readFileSync(file, "utf8")) : {};
}

const testEnv = readEnvFile(".env.test");
const devEnv = readEnvFile(".env");

if (!testEnv.DATABASE_URL) {
  throw new Error("apps/api/.env.test is missing or has no DATABASE_URL. Run `pnpm db:setup:test` from the repo root.");
}
if (testEnv.CAMPUS_WALK_TEST !== "1") {
  throw new Error("apps/api/.env.test must set CAMPUS_WALK_TEST=1 (the marker that it is safe to truncate).");
}
if (testEnv.DATABASE_URL === devEnv.DATABASE_URL) {
  throw new Error(
    "apps/api/.env.test points at the same database as .env. Tests truncate tables; run `pnpm db:setup:test` to create the test branch.",
  );
}

export default defineProject({
  test: {
    name: "api",
    include: ["src/**/*.test.ts"],
    // Applied in the worker before any test file (and therefore db/client.ts) is imported.
    env: testEnv,
    // One shared database: files run one after another, each reseeding in beforeAll.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
