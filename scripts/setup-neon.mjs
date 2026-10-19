#!/usr/bin/env node
// Idempotent Neon provisioning for local development.
//
//   pnpm db:setup
//
// 1. If apps/api/.env already has DATABASE_URL, do nothing.
// 2. Ensure the Neon CLI is logged in (opens a browser once; honors NEON_API_KEY / NEON_PROFILE).
// 3. Resolve the organization (NEON_ORG_ID, or the only org on the account).
// 4. Find or create a Neon project named NEON_PROJECT_NAME (default "campus-walk").
// 5. Fetch the connection string for its default branch and write it to apps/api/.env.
//
// Uses only Node built-ins and `npx -y neonctl`, so there is nothing to install first.
// Every neonctl call is non-interactive; anything that would prompt is resolved here instead.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = resolve(ROOT, "apps/api/.env");
const PROJECT_NAME = process.env.NEON_PROJECT_NAME ?? "campus-walk";
const REGION = process.env.NEON_REGION; // optional, e.g. aws-us-east-2
const ORG_ID_OVERRIDE = process.env.NEON_ORG_ID; // optional, needed only if the account has several orgs
const API_PORT = "3001";
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
const COMMON_FLAGS = ["--no-analytics", "--no-color"];

function log(msg) {
  console.log(`[db:setup] ${msg}`);
}

function readEnv() {
  if (!existsSync(ENV_PATH)) return "";
  return readFileSync(ENV_PATH, "utf8");
}

function envValue(contents, key) {
  const m = contents.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

function upsertEnv(contents, key, value) {
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=`, "m").test(contents)) {
    return contents.replace(new RegExp(`^${key}=.*$`, "m"), line);
  }
  const sep = contents.length === 0 || contents.endsWith("\n") ? "" : "\n";
  return `${contents}${sep}${line}\n`;
}

/** Run neonctl non-interactively and capture stdout. Throws with stderr on failure. */
function neon(args, { quiet = false } = {}) {
  const r = spawnSync(NPX, ["-y", "neonctl", ...args, ...COMMON_FLAGS], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.status !== 0) {
    if (!quiet) process.stderr.write(r.stderr ?? "");
    throw new Error(`neonctl ${args.slice(0, 2).join(" ")} failed (exit ${r.status})`);
  }
  return r.stdout.trim();
}

/** Run neonctl with the terminal attached, for the one-time browser login. */
function neonInteractive(args) {
  const r = spawnSync(NPX, ["-y", "neonctl", ...args, ...COMMON_FLAGS], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`neonctl ${args[0]} failed (exit ${r.status})`);
}

function neonJson(args) {
  const out = neon([...args, "--output", "json"]);
  const start = Math.min(...["{", "["].map((c) => out.indexOf(c)).filter((i) => i >= 0));
  if (!Number.isFinite(start)) {
    throw new Error(
      `neonctl ${args.slice(0, 2).join(" ")} did not return JSON (it probably tried to prompt). Output began: ${out.slice(0, 80)}`,
    );
  }
  try {
    return JSON.parse(out.slice(start));
  } catch {
    throw new Error(`neonctl ${args.slice(0, 2).join(" ")} returned unparseable JSON. Output began: ${out.slice(0, 80)}`);
  }
}

function ensureLoggedIn() {
  try {
    const me = neonJson(["me"]);
    log(`Logged in to Neon as ${me.email ?? me.login ?? "(unknown)"}.`);
  } catch {
    log("Not logged in to Neon. Opening a browser to sign in (one time)...");
    log("If no browser opens, copy the URL that neonctl prints into one. Or set NEON_API_KEY to skip this.");
    neonInteractive(["login"]);
  }
}

function resolveOrgId() {
  if (ORG_ID_OVERRIDE) {
    log(`Using organization ${ORG_ID_OVERRIDE} from NEON_ORG_ID.`);
    return ORG_ID_OVERRIDE;
  }
  const listed = neonJson(["orgs", "list"]);
  const orgs = Array.isArray(listed) ? listed : (listed.organizations ?? []);
  if (orgs.length === 1) {
    log(`Using organization "${orgs[0].name}" (${orgs[0].id}).`);
    return orgs[0].id;
  }
  if (orgs.length === 0) {
    throw new Error("No Neon organizations found for this account. Create one at https://console.neon.tech first.");
  }
  const choices = orgs.map((o) => `  ${o.id}  ${o.name}`).join("\n");
  throw new Error(`This account has several Neon organizations. Set NEON_ORG_ID to one of:\n${choices}`);
}

function findOrCreateProject(orgId) {
  const listed = neonJson(["projects", "list", "--org-id", orgId]);
  const projects = Array.isArray(listed) ? listed : (listed.projects ?? []);
  const existing = projects.find((p) => p.name === PROJECT_NAME);
  if (existing) {
    log(`Found existing Neon project "${PROJECT_NAME}" (${existing.id}).`);
    return { project: existing, connectionString: "" };
  }

  log(`Creating Neon project "${PROJECT_NAME}"...`);
  const createArgs = ["projects", "create", "--name", PROJECT_NAME, "--org-id", orgId];
  if (REGION) createArgs.push("--region-id", REGION);
  const created = neonJson(createArgs);
  const project = created.project ?? created;
  const connectionString = created.connection_uris?.[0]?.connection_uri ?? "";
  log(`Created project ${project.id}.`);
  return { project, connectionString };
}

function main() {
  const existing = readEnv();
  if (envValue(existing, "DATABASE_URL")) {
    log(`DATABASE_URL already configured in ${ENV_PATH}; nothing to do.`);
    return;
  }

  ensureLoggedIn();
  const orgId = resolveOrgId();
  let { project, connectionString } = findOrCreateProject(orgId);

  if (!connectionString) {
    connectionString = neon(["connection-string", "--project-id", project.id]);
  }
  if (!/^postgres(ql)?:\/\//.test(connectionString)) {
    throw new Error(`Unexpected connection string from neonctl: ${connectionString.slice(0, 40)}...`);
  }

  let next = upsertEnv(existing, "DATABASE_URL", connectionString);
  if (!envValue(next, "PORT")) next = upsertEnv(next, "PORT", API_PORT);
  writeFileSync(ENV_PATH, next, { mode: 0o600 });
  log(`Wrote DATABASE_URL to ${ENV_PATH} (git-ignored).`);
  log(`Neon project: ${project.id}  https://console.neon.tech/app/projects/${project.id}`);
}

try {
  main();
} catch (err) {
  console.error(`[db:setup] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
