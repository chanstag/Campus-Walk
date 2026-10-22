// Server env. Loaded by `import "dotenv/config"` in the entrypoints; validated here once so
// a missing key fails at startup with a message instead of deep inside Better Auth.
function required(key: string, hint: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set. ${hint}`);
  return value;
}

export const env = {
  /** Public origin of the web app; used for trusted origins and invite links. */
  APP_URL: process.env.APP_URL ?? "http://localhost:5173",
  /** Origin the API itself is reachable at; Better Auth derives cookie/URL settings from it. */
  API_URL: process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3001}`,
  BETTER_AUTH_SECRET: required(
    "BETTER_AUTH_SECRET",
    "Add a random 32+ char string to apps/api/.env (e.g. `openssl rand -base64 32`).",
  ),
};
