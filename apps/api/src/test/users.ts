// Fixed accounts the test suites sign in as. Kept free of imports so the Playwright specs at
// /e2e can import it too (anything from ./db would need DATABASE_URL at import time).
// `src/test/seed.ts` creates them in the test database if they are missing.

export const TEST_USERS = {
  admin: {
    email: "admin@test.campuswalk.local",
    name: "Test Admin",
    password: "campus-walk-test-admin",
    role: "admin",
  },
  field: {
    email: "field@test.campuswalk.local",
    name: "Test Field User",
    password: "campus-walk-test-field",
    role: "field",
  },
} as const;

export type TestUserKey = keyof typeof TEST_USERS;
