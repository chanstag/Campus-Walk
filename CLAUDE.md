# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Campus Walk: a full-stack TypeScript app for walking a school campus and recording what is in every room (field use), plus per-campus summary views (office use). Hierarchy is Campus → Building → Floor → Room → Asset. See `README.md` for the product brief, draft ER diagram, and open design questions.

The repo root for code is this `Campus Walk/` directory. The parent directory holds `images/` (VLK campus photography and favicons) used as brand/reference material, not app assets.

## Commands

pnpm workspace (`apps/*`). Node >= 20, pnpm 10. Run from this directory unless noted.

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
```

There is no test runner or linter configured yet. `pnpm typecheck` is the only verification step.

The API port is 3001 (not 3000) because 3000 is taken by another service on the dev machine. The Vite dev server proxies `/trpc` to 3001, so the browser always talks to one origin.

## Architecture

**End-to-end typing via tRPC.** `apps/api/src/router.ts` exports `AppRouter`. The web app imports that type directly from the api workspace (`import type { AppRouter } from "api/src/router"` in `apps/web/src/trpc.ts`), so `api` is a `workspace:*` devDependency of `web`. Changing a procedure's input/output in the router is immediately reflected in web type errors. Never duplicate request/response types on the client.

**API (`apps/api`)** is Fastify 5 with `@trpc/server`'s fastify adapter mounted at `/trpc`, plus a plain `/health` route. `src/trpc.ts` builds the tRPC context (`{ req, res, db }`) and exports `router` / `publicProcedure`; `src/db/client.ts` creates the Drizzle client over `@neondatabase/serverless` HTTP and throws at import time if `DATABASE_URL` is unset. API tsconfig uses `NodeNext`, so intra-api imports need `.js` extensions (`./router.js`). Inputs are validated with zod v4.

**Web (`apps/web`)** is Vite 8 + React 19. `src/main.tsx` wires TanStack Query + `@trpc/tanstack-react-query` (`createTRPCContext`, `useTRPC()` then `useQuery(trpc.x.queryOptions(...))`). There is no router yet; `main.tsx` does a hardcoded pathname check to serve `/design`. `@/` aliases `src/`.

**Design system.** shadcn (style `base-nova`, built on `@base-ui/react`, not Radix) + Tailwind v4. Components are generated into `src/components/ui/`; add more with the shadcn CLI, not by hand. `src/palette.css` holds raw VLK brand color ramps (`--color-<name>-<step>`); `src/index.css` maps them to semantic tokens (`--primary`, `--background`, …) with a `.dark` variant and `[data-accent]` overrides. `src/design/DesignPage.tsx` is a living style guide at `/design` that renders every token and component. When changing tokens, edit `index.css` and check `/design` in both modes.

**Database.** Drizzle + Neon Postgres. `apps/api/src/db/schema.ts` is intentionally empty: the data model (and whether Assessment/Finding are separate entities from Room/Asset) is not settled. Define `pgTable`s there, then `db:generate` + `db:migrate`. `scripts/setup-neon.mjs` uses `npx neonctl` non-interactively; env knobs `NEON_PROJECT_NAME`, `NEON_REGION`, `NEON_ORG_ID`, `NEON_API_KEY`.

## Planned but not yet present

From the README: BetterAuth for auth/sessions, roles `field` and `admin` with a hybrid RBAC/ABAC permission layer that also drives UI visibility, photos and notes on assets, offline capability. None of this exists in code yet; do not assume helpers for it.
