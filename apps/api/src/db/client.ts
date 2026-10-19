import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Run `pnpm db:setup` from the repo root to provision a Neon project and write apps/api/.env.",
  );
}

export const db = drizzle(neon(url), { schema });
export type Db = typeof db;
