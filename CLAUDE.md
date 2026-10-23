# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Campus Walk: a full-stack TypeScript app for walking a school campus and recording what is in every room (field use), plus per-campus summary views (office use). Hierarchy is Campus → Building → Floor → Room → Asset. See `README.md` for the product brief, draft ER diagram, and open design questions.

The repo root for code is this `Campus Walk/` directory. The parent directory holds `images/` (VLK campus photography and favicons) used as brand/reference material, not app assets.

## Commands

pnpm workspace (`apps/*`). Node >= 20, pnpm 10. Run from this directory unless noted. Root `package.json` pins `@types/react` via `pnpm.overrides` because log4brains drags in v17 types, which otherwise get hoisted and break JSX typing for `@trpc/tanstack-react-query`.

```bash
pnpm install
pnpm db:setup                    # one-time Neon provisioning; writes apps/api/.env (idempotent)
pnpm dev                         # API http://localhost:3001 + web http://localhost:5173, in parallel
pnpm typecheck                   # tsc --noEmit in both apps and e2e/
pnpm build                       # web: tsc + vite build; api: tsc to dist/
pnpm test                        # Vitest: api router tests (test DB) + web unit tests; see Testing
pnpm test:e2e                    # Playwright against the test DB on its own ports; see Testing

pnpm --filter api dev            # one app only (likewise --filter web)
pnpm --filter api db:generate    # drizzle-kit: migration from src/db/schema.ts into apps/api/drizzle/
pnpm --filter api db:migrate
pnpm --filter api db:studio
pnpm db:seed                     # TRUNCATES the campus tables (not users), then loads sample_data/campus_walk_sample_data
pnpm --filter api auth:create-admin --email you@x.com --name "You" --password '...'   # first admin; everyone else is invited
pnpm db:setup:test               # one-time: Neon branch "test" → apps/api/.env.test, then migrate + seed it
```

Manual verification of mutations writes to the dev Neon database; `pnpm db:seed` puts it back to the sample. Automated tests never touch it (see Testing).

There is no linter configured. Verification is `pnpm typecheck`, `pnpm test` and `pnpm test:e2e`.

The API port is 3001 (not 3000) because 3000 is taken by another service on the dev machine. The Vite dev server proxies `/trpc` and `/api/auth` to 3001, so the browser always talks to one origin and session cookies are first-party.

`apps/api/.env` needs `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `APP_URL` (web origin, default `http://localhost:5173`) and `API_URL` (default `http://localhost:3001`); see `.env.example`. `src/env.ts` validates them at startup.

## Testing

Two layers, and every feature ships with both.

```bash
pnpm db:setup:test                  # one-time: creates Neon branch "test", writes apps/api/.env.test, migrates + seeds it
pnpm exec playwright install chromium   # one-time
pnpm test                           # Vitest, both apps (~10 s; each api file reseeds)
pnpm test:watch
pnpm test:e2e                       # Playwright; starts API on 3101 + Vite on 5174 itself, coexists with pnpm dev
pnpm test:e2e:ui
pnpm --filter api db:migrate:test   # after adding a migration
pnpm --filter api db:seed:test      # reset the test branch by hand
```

**The rule for new work.** A feature adds or extends one Playwright spec, `e2e/<feature>.spec.ts` (walk and office changes extend `walk-*.spec.ts` / `office.spec.ts`), plus Vitest tests for every new tRPC procedure (colocated `apps/api/src/routers/<name>.test.ts`) and for new pure logic (colocated `*.test.ts`). No React Testing Library: component behaviour is proven in the browser.

**Database.** Both suites use the Neon `test` branch named in `apps/api/.env.test` (git-ignored; `.env.test.example` shows the shape), never `.env`. Three guards: `apps/api/vitest.config.ts` refuses to start if `.env.test` is missing, lacks `CAMPUS_WALK_TEST=1`, or has the same `DATABASE_URL` as `.env`; `src/test/seed.ts` refuses without that marker; `scripts/setup-test-db.sh` refuses to write a URL equal to the dev one. Isolation is reseed-per-file: `reseed()` in `beforeAll` (Vitest) or `test.beforeAll` (Playwright specs that write). There is no per-test rollback (the Neon HTTP driver has no transactions) and a reseed costs 1–3 s, so tests within a file share state and look rows up by room number or asset tag (`findRoomByNumber`, `findAssetByTag`, `findAssetType` in `src/test/db.ts`), never by sample id. The test seed also creates two fixed accounts (`src/test/users.ts`: an admin and a field user); the sample truncate leaves users alone.

**API tests** (`apps/api/src/routers/*.test.ts`) call procedures in-process through `appRouter.createCaller` with a hand-built session: `callerFor("admin" | "field")`, or `anonymousCaller()` to assert UNAUTHORIZED. No HTTP, no cookies. `users.*` is not covered this way because it round-trips through Better Auth with the caller's headers. Vitest runs api files one at a time (`fileParallelism: false`).

**Web tests** are pure functions and stores only (`src/lib/condition.test.ts`, `src/hooks/use-*.test.ts`). `environment: node` by default; add `// @vitest-environment jsdom` per file when `localStorage` or `document` is needed. Module-level stores are re-imported per test with `vi.resetModules()` + dynamic `import()`.

**E2E** (`e2e/`, root `playwright.config.ts`) runs Chromium against the real stack on its own ports (API 3101 via the api `dev:test` script, which loads `.env.test`; Vite 5174 via the web `dev:test` script; `API_PORT` drives the Vite proxy target). One worker. `e2e/setup.ts` reseeds and signs in through the login page once, saving the cookies to `e2e/.auth/admin.json` for every spec. Helpers in `e2e/fixtures.ts`: `openRoom`, `assetCard`, `treeRoom`, `reseed`, and `SAMPLE` targets (room 101: walked, 7 rated assets; P101 in Portable P-1: unwalked, all unrated). Prefer `getByRole` / `getByLabel`; add `data-testid` only when there is no accessible name.

**CI** (`.github/workflows/ci.yml`) needs the secrets `TEST_DATABASE_URL` (the `test` branch) and `TEST_BETTER_AUTH_SECRET`, and serialises runs with a concurrency group because they share that branch.

`apps/api/tsconfig.json` excludes tests from `build`; its `typecheck` uses `tsconfig.test.json`. Root `typecheck` also checks `e2e/`.

## Git workflow: one worktree per feature

Every feature, fix, or chore gets its own git worktree in a sibling directory, branched from `origin/main`, with its own Neon database branch. The main `Campus Walk/` checkout stays on `main` and is the place to run the worktree scripts from; do not develop features directly in it.

**Layout.** Worktrees are siblings of the main repo, named `<repo>-<type>-<description>`: branch `feat/room-photos` lives in `../Campus Walk-feat-room-photos`. `git worktree list` from the main repo shows the exact paths on the current machine. Each worktree has its own `node_modules` and its own `apps/api/.env`, whose `DATABASE_URL` points at a Neon branch named after the git branch (`feat/room-photos`). Migrations, `db:seed`, and manual mutation testing inside a worktree therefore never touch the main database.

**Branch naming.** `<type>/<short-description>` with `feat/`, `fix/`, `chore/`, `refactor/`, `docs/`. Features merge to `main` through a PR with a squash merge. Never commit directly to `main`.

**Rebase, never merge, to update a branch.** Bring a branch up to date with `git fetch origin && git rebase origin/main`. Never `git merge main` into a feature branch, and never create merge commits on a branch. After rebasing a branch that is already pushed, push with `git push --force-with-lease` (never plain `--force`).

**Starting work.** Use the `create-worktree` skill, which runs `.claude/scripts/create-worktree.sh` from the main repo:

```bash
.claude/scripts/create-worktree.sh feat room-photos          # branch feat/room-photos
.claude/scripts/create-worktree.sh fix tree-sort --no-neon   # share main's DB (UI-only work)
```

It fetches, creates the worktree off `origin/main`, copies `apps/api/.env`, creates the Neon branch and rewrites `DATABASE_URL` (keeping `.env.bak`), and runs `pnpm install`. It does not push; `--push` is opt-in and asks first. Neon branch creation needs `neonctl` logged in (via `npx`, as in `pnpm db:setup`) and `jq`; the project is found by `NEON_PROJECT_ID` in `.env` or by name (`campus-walk`).

**Finishing work.** Use the `cleanup-worktree` skill (`.claude/scripts/cleanup-worktree.sh <branch-or-dir>`) from the main repo. It removes the worktree, deletes the local branch, and deletes the Neon branch. It refuses the main repo, the current directory, `main`/`master`, and dirty or unmerged work without `--force`.

**Gotchas.** Both dev servers bind fixed ports (API 3001, Vite 5173), so only one worktree can run `pnpm dev` at a time unless you set `PORT` and change the Vite proxy target. Neon's free plan caps branches per project; clean up finished features to free slots. A Neon branch is a snapshot of `main`'s data at creation time, so run `pnpm --filter api db:migrate` in the worktree after adding migrations. Before any `db:seed` or `db:migrate`, check which worktree you are in (`git rev-parse --show-toplevel`) and which `DATABASE_URL` its `.env` holds.

## Architecture

**End-to-end typing via tRPC.** `apps/api/src/router.ts` exports `AppRouter`. The web app imports that type directly from the api workspace (`import type { AppRouter } from "api/src/router"` in `apps/web/src/trpc.ts`), so `api` is a `workspace:*` devDependency of `web`. Changing a procedure's input/output in the router is immediately reflected in web type errors. Never duplicate request/response types on the client.

**API (`apps/api`)** is Fastify 5 with `@trpc/server`'s fastify adapter mounted at `/trpc`, Better Auth's handler on `/api/auth/*` (see Auth below), plus a plain `/health` route. `src/trpc.ts` builds the tRPC context (`{ req, res, db, session }`; `session` is Better Auth's `{ session, user } | null`), sets superjson as the transformer (so `Date` columns arrive on the client as `Date`, and GET inputs in curl are wrapped as `{"json": {...}}`), and exports `router`, `publicProcedure` (only `invite.*` uses it), `protectedProcedure` (any signed-in user; narrows `ctx.user`) and `adminProcedure`. Procedures live in `src/routers/`, one file per hierarchy level (`campus.ts`, `room.ts`, `asset.ts`, `assetType.ts`) plus the view-specific `office.ts` (quantity-weighted aggregates: per-campus summary and campus detail), merged in `src/router.ts`, which also exports `RouterOutputs` for the web app. Mutations: `asset.create` (building derived from the room), `asset.update` (descriptive fields; undefined = untouched, null = cleared), `asset.assess` (condition + notes, sets `assessed_at`), `asset.remove`, `room.finish` (sets the room's `assessed_at`, condition, notes; returns the unrated-asset count but never rejects). `assessed_by` is still left null (writing the user id is a follow-up). Reads use Drizzle's relational query API (`ctx.db.query.campus.findFirst({ with: ... })`); the `relations()` definitions are at the bottom of `src/db/schema.ts`. RQB v1 cannot order by a related table's column, so sort in JS after the fetch. `src/db/client.ts` creates the Drizzle client over `@neondatabase/serverless` HTTP and throws at import time if `DATABASE_URL` is unset. API tsconfig uses `NodeNext`, so intra-api imports need `.js` extensions (`./router.js`). Inputs are validated with zod v4 (`z.uuid()`).

**Auth (`apps/api/src/auth/`).** Better Auth 1.7 with email + password, cookie sessions (no cookie cache, so ban/remove/role changes apply on the next request), the `admin` plugin, Drizzle adapter over the same Neon HTTP client (the adapter's `transaction` option defaults to off, which the HTTP driver needs). `auth.ts` is the instance; `roles.ts` holds the role NAMES only (`admin`, `office`, `field`, as `ROLES` / `ROLE_LABELS` / `isAdmin`) and is imported at runtime by the web app through the `api` workspace link, so it must stay browser-safe (nothing from drizzle, node or `./db`). Application permissions are deliberately not in code: a DB-driven ABAC layer (role → actions on resources, admin-editable) is the next piece of work and will replace `adminProcedure` / `RequireAuth adminOnly`. The admin plugin rejects unknown role values, so `roles.ts` registers the three names with empty statements (`admin` carries only Better Auth's own user-management statements so its endpoints run). Public sign-up is disabled; accounts come from `auth:create-admin` or an invitation. Better Auth tables (`user`, `session`, `account`, `verification`) are generated into `src/db/auth-schema.ts` by `npx auth@latest generate --config src/auth/auth.ts --output src/db/auth-schema.ts` (re-run after changing plugins; text ids, not uuid) and re-exported from `schema.ts`; `drizzle.config.ts` lists both files. `@opentelemetry/api` is pinned in `apps/api` because the root `log4brains` dependency hoists a 0.14 version that crashes Better Auth's tracing.

**Invitations.** Our own `invitation` table (`schema.ts`): email, name, role, sha256 of the token, 7-day expiry, `invited_by`, `accepted_at`. `users.invite` returns the link once (`${APP_URL}/invite/<token>`); the admin copies it, nothing is emailed. `invite.get` / `invite.accept` are public: accept calls `auth.api.createUser` server-side with no headers (Better Auth skips the admin-session check in that case) and the web then signs in with the new password. The admin endpoints (`setRole`, `banUser`, `removeUser`, `setUserPassword`) need the caller's headers (`fromNodeHeaders(ctx.req.headers)`); `routers/users.ts` wraps them and maps Better Auth `APIError`s to `BAD_REQUEST`. "Forgot password" is `users.setTemporaryPassword` until email exists. The seed's truncate list names only campus tables, so users survive `db:seed`.

**Fetch shape for the field UI.** `campus.tree` returns one campus → buildings → floors → rooms in a single call, without assets. Assets load lazily: `asset.byRoom` for a room, `asset.byBuilding` for a building's room-less assets (building systems and unplaced equipment, split client-side on `assetType.typicallyBuildingLevel`).

**Web (`apps/web`)** is Vite 8 + React 19. `src/main.tsx` wires React Router (v8, declarative: `BrowserRouter` + `Routes`), the nuqs react-router adapter, TanStack Query + `@trpc/tanstack-react-query` (`createTRPCContext`, `useTRPC()` then `useQuery(trpc.x.queryOptions(...))`, `useMutation(trpc.x.mutationOptions(...))`). Routes: `/login`, `/invite/:token` (signed-out, `src/auth/`), then under the `RequireAuth` layout route `/` → `/walk`, `/walk`, `/office`, and under `RequireAuth adminOnly` `/users` (`src/users/UsersPage.tsx`); `/design` (dev style guide) is unguarded. `src/auth-client.ts` is the Better Auth React client (`useSession`, `signIn`, `signOut`; `adminClient` only for the `role` type). `RequireAuth` redirects to `/login` with `state.from`; the QueryClient in `main.tsx` sends the browser to `/login` on a tRPC `UNAUTHORIZED` (expired session). Every page renders inside `src/app/PageShell.tsx` (sidebar with brand + `AppNav` + an optional page slot + `NavUser` in the footer, header with breadcrumbs and theme toggle); `AppNav` highlights the current route with `NavLink` + `useLocation` and shows Users only to admins. `NavUser` (`src/app/NavUser.tsx`) is the bottom-left account button: avatar initials, name, email; its popup shows the role and signs out, clearing the query cache. `@/` aliases `src/`. Shared output types come from `RouterOutputs` in `api/src/router` (type-only import); `src/walk/types.ts` names the tree node types.

**Walk screen (`src/walk/`).** The field UI: `WalkPage` (`PageShell` with `CampusTree` in the sidebar slot), `CampusTree` (campus → building → floor → room; expansion is local state seeded from the URL, selection is in the URL), `AssetGrid` (room header with "Add asset" / "Finish room", then `asset.byRoom` as cards grouped by category; each card has an inline `ConditionPicker` and an edit/delete menu), `AssetDialog` (create/edit), `FinishRoomDialog` (warns about unrated assets, allows anyway). `mutations.ts` wraps every write and invalidates `asset.byRoom`, `campus.tree` and `office.*`; `asset.assess` is optimistic.

**Office screen (`src/office/OfficePage.tsx`).** `office.summary` as a card per campus (rooms walked, items, poor, not rated, by category); selecting one (`?campus=`, same key as the walk page) loads `office.campusDetail`: items by type, poor-condition items, rooms not yet walked, each linking into `/walk?campus=&floor=&room=`. Selection lives in the URL as `?campus=&floor=&room=` through `useSelection()`, a thin wrapper over nuqs `useQueryStates`; components never import nuqs. Every level is a tree node, so every selection pushes a history entry and back walks the tree in reverse; each setter writes the whole path at once. Ids are not validated by the hook; `WalkPage` renders "not found" states when an id is missing from fetched data. The selected campus's `campus.tree` query is shared between the sidebar branch and the page by query key. On mobile, picking a room closes the sidebar sheet (`useSidebar().setOpenMobile`).

**Theme and accent.** `src/hooks/use-theme.ts` and `src/hooks/use-accent.ts` share one pattern: module-level store, `init*()` called in `main.tsx` before the first render, `use*()` via `useSyncExternalStore`, persisted in localStorage. Theme toggles the `dark` class; accent sets `data-accent` on `<html>` and each non-default id has an override block in `index.css`. The "(2nd color)" accents keep terracotta as primary and give a cool hue the ring / active row / selected / hover roles; the `sage` ramp at the bottom of `palette.css` exists only for that experiment.

**Condition display.** `src/lib/condition.tsx` holds the web-side 1–5 labels (duplicated from the API's `CONDITION_SCALE` on purpose: importing `schema.ts` at runtime would pull drizzle into the bundle; the `ConditionRating` key type is shared). `conditionTone()` collapses 1–2 / 3 / 4–5 onto `poor` / `fair` / `good`, matching `Icons.condition`. Three tokens `--condition-good|fair|poor` live in `index.css` (light + dark) and show on `/design`; the brand ramps have no green or red, so good/poor are oklch values picked to sit with the warm palette.

**Design system.** shadcn (style `base-nova`, built on `@base-ui/react`, not Radix) + Tailwind v4. Components are generated into `src/components/ui/`; add more with the shadcn CLI, not by hand. `src/palette.css` holds raw VLK brand color ramps (`--color-<name>-<step>`); `src/index.css` maps them to semantic tokens (`--primary`, `--background`, …) with a `.dark` variant and `[data-accent]` overrides. `src/design/DesignPage.tsx` is a living style guide at `/design` that renders every token and component. When changing tokens, edit `index.css` and check `/design` in both modes. Icons come from `src/components/icons.ts` by meaning (`Icons.room`, `Icons.condition.poor`), never from lucide directly.

**Database.** Drizzle + Neon Postgres over the HTTP driver (no interactive transactions; batch inserts instead). Schema in `apps/api/src/db/schema.ts`, migrations in `apps/api/drizzle/`. Edit the schema, then `db:generate` + `db:migrate`. `scripts/setup-neon.mjs` uses `npx neonctl` non-interactively; env knobs `NEON_PROJECT_NAME`, `NEON_REGION`, `NEON_ORG_ID`, `NEON_API_KEY`.

## Data model

`district → campus → building → floor → room → asset`, plus an `asset_type` catalog. UUID primary keys, `created_at`/`updated_at` everywhere, cascading deletes down the hierarchy. Decisions that are easy to get wrong when writing queries or UI:

- **Assets belong to a building, optionally a room.** `asset.building_id` is required; `asset.room_id` is nullable. A null room means either a building-level system (roof, HVAC, boiler) or delivered-but-unplaced equipment. The two are distinguished only by `asset_type.typically_building_level`, not by a column on the asset. Campus and floor of an asset are derived by joining, never stored.
- **Quantity matters.** Bulk furniture is one asset row with `quantity > 1`; tagged equipment is `quantity = 1` with a unique `asset_tag`. Any "items by condition" metric must `sum(quantity)`, not `count(*)`.
- **Condition is a 1–5 smallint** (1 Critical … 5 Excellent) with a check constraint. Labels live in `CONDITION_SCALE` in `schema.ts`, not in a table.
- **Assessment is current state, not history.** `condition`, `notes`, `assessed_at`, `assessed_by` sit directly on `room` and `asset`. A room is "walked" when `room.assessed_at` is set (via `room.finish`); an asset is "rated" when `asset.condition` is set. Finishing a room with unrated assets is allowed, so the office view reports unrated items separately. `assessed_by` is still free text; now that `user` exists it should become a FK to `user.id` (text) written by the mutations. Per-walk history (an observation table per walk) is a planned later migration: create the table, backfill one row per entity from these columns, drop them.
- **Every building has at least one floor**, even single-story ones. `room.floor_id` is required.
- **Sample ids are not stored.** The seed maps `C-100` / `B-101` / `R-101-101` / `A-00001` to fresh UUIDs in memory. Room numbers and asset tags are the human-readable identifiers.

## Planned but not yet present

From the README: a DB-driven ABAC permission layer (roles → actions on resources, admin-editable, also driving UI visibility; replaces `adminProcedure` / `adminOnly`), emailed invites and self-service password reset, `assessed_by` as a user FK, photos on rooms and assets, per-walk assessment history, offline capability. None of this exists in code yet; do not assume helpers for it.
