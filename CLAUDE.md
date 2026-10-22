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
pnpm typecheck                   # tsc --noEmit in both apps
pnpm build                       # web: tsc + vite build; api: tsc to dist/

pnpm --filter api dev            # one app only (likewise --filter web)
pnpm --filter api db:generate    # drizzle-kit: migration from src/db/schema.ts into apps/api/drizzle/
pnpm --filter api db:migrate
pnpm --filter api db:studio
pnpm db:seed                     # TRUNCATES all tables, then loads sample_data/campus_walk_sample_data
```

Manual verification of mutations writes to the dev Neon database; `pnpm db:seed` puts it back to the sample.

There is no test runner or linter configured yet. `pnpm typecheck` is the only verification step.

The API port is 3001 (not 3000) because 3000 is taken by another service on the dev machine. The Vite dev server proxies `/trpc` to 3001, so the browser always talks to one origin.

## Architecture

**End-to-end typing via tRPC.** `apps/api/src/router.ts` exports `AppRouter`. The web app imports that type directly from the api workspace (`import type { AppRouter } from "api/src/router"` in `apps/web/src/trpc.ts`), so `api` is a `workspace:*` devDependency of `web`. Changing a procedure's input/output in the router is immediately reflected in web type errors. Never duplicate request/response types on the client.

**API (`apps/api`)** is Fastify 5 with `@trpc/server`'s fastify adapter mounted at `/trpc`, plus a plain `/health` route. `src/trpc.ts` builds the tRPC context (`{ req, res, db }`), sets superjson as the transformer (so `Date` columns arrive on the client as `Date`, and GET inputs in curl are wrapped as `{"json": {...}}`), and exports `router` / `publicProcedure`. Procedures live in `src/routers/`, one file per hierarchy level (`campus.ts`, `room.ts`, `asset.ts`, `assetType.ts`) plus the view-specific `office.ts` (quantity-weighted aggregates: per-campus summary and campus detail), merged in `src/router.ts`, which also exports `RouterOutputs` for the web app. Mutations: `asset.create` (building derived from the room), `asset.update` (descriptive fields; undefined = untouched, null = cleared), `asset.assess` (condition + notes, sets `assessed_at`), `asset.remove`, `room.finish` (sets the room's `assessed_at`, condition, notes; returns the unrated-asset count but never rejects). `assessed_by` is left null until BetterAuth lands. Reads use Drizzle's relational query API (`ctx.db.query.campus.findFirst({ with: ... })`); the `relations()` definitions are at the bottom of `src/db/schema.ts`. RQB v1 cannot order by a related table's column, so sort in JS after the fetch. `src/db/client.ts` creates the Drizzle client over `@neondatabase/serverless` HTTP and throws at import time if `DATABASE_URL` is unset. API tsconfig uses `NodeNext`, so intra-api imports need `.js` extensions (`./router.js`). Inputs are validated with zod v4 (`z.uuid()`).

**Fetch shape for the field UI.** `campus.tree` returns one campus → buildings → floors → rooms in a single call, without assets. Assets load lazily: `asset.byRoom` for a room, `asset.byBuilding` for a building's room-less assets (building systems and unplaced equipment, split client-side on `assetType.typicallyBuildingLevel`).

**Web (`apps/web`)** is Vite 8 + React 19. `src/main.tsx` wires React Router (v8, declarative: `BrowserRouter` + `Routes`), the nuqs react-router adapter, TanStack Query + `@trpc/tanstack-react-query` (`createTRPCContext`, `useTRPC()` then `useQuery(trpc.x.queryOptions(...))`, `useMutation(trpc.x.mutationOptions(...))`). Routes: `/` → `/walk`, `/walk`, `/office`, `/design` (dev style guide). Every page renders inside `src/app/PageShell.tsx` (sidebar with brand + `AppNav` + an optional page slot, header with breadcrumbs and theme toggle); `AppNav` highlights the current route with `NavLink` + `useLocation`. `@/` aliases `src/`. Shared output types come from `RouterOutputs` in `api/src/router` (type-only import); `src/walk/types.ts` names the tree node types.

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
- **Assessment is current state, not history.** `condition`, `notes`, `assessed_at`, `assessed_by` sit directly on `room` and `asset`. A room is "walked" when `room.assessed_at` is set (via `room.finish`); an asset is "rated" when `asset.condition` is set. Finishing a room with unrated assets is allowed, so the office view reports unrated items separately. `assessed_by` is free text until BetterAuth adds a user table. Per-walk history (an observation table per walk) is a planned later migration: create the table, backfill one row per entity from these columns, drop them.
- **Every building has at least one floor**, even single-story ones. `room.floor_id` is required.
- **Sample ids are not stored.** The seed maps `C-100` / `B-101` / `R-101-101` / `A-00001` to fresh UUIDs in memory. Room numbers and asset tags are the human-readable identifiers.

## Planned but not yet present

From the README: BetterAuth for auth/sessions, roles `field` and `admin` with a hybrid RBAC/ABAC permission layer that also drives UI visibility, photos on rooms and assets, per-walk assessment history, offline capability. None of this exists in code yet; do not assume helpers for it.
