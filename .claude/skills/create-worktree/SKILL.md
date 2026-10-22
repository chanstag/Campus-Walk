---
name: create-worktree
description: Create a new feature worktree wired to its own Neon database branch. Use this skill when the user asks to start a new feature, spin up a worktree, create a feature branch in a worktree, or set up an isolated environment for new work. Apply when the user mentions "new feature", "new worktree", "branch off main into a worktree", or starting work that should be isolated from the main worktree.
---

## When to use this skill

- The user asks to "start a new feature", "create a worktree", or "spin up a feature branch"
- The user wants new work isolated in its own sibling worktree (not in the main `Campus Walk` worktree)
- The user wants a feature branch with its own Neon DB branch so `db:migrate` / `db:seed` / manual
  mutation testing never touch the main database

## What it does

A sibling worktree is created off the latest `origin/main`, the current worktree's `apps/api/.env` is
copied in, a Neon DB branch named after the git branch is created from the project's default branch,
and `DATABASE_URL` in the new worktree's `apps/api/.env` is rewritten to point at it. Then
`pnpm install` runs in the new worktree. Nothing is pushed unless `--push` is passed.

The logic lives in `.claude/scripts/create-worktree.sh` (committed to the repo, so it survives machine
changes). Shared helpers are in `.claude/scripts/_neon.sh`.

## Procedure

1. **Confirm the branch name** with the user if it's ambiguous. Convention: `<type>/<short-description>`
   (`feat/`, `fix/`, `chore/`, `refactor/`, `docs/`). The worktree dir is derived automatically as a
   sibling of the main repo: `../Campus Walk-<type>-<description>`.

2. **Run from the worktree whose `.env` you want copied** — normally the main `Campus Walk` worktree,
   since that holds the canonical secrets (`DATABASE_URL`, `BETTER_AUTH_SECRET`, …):
   ```bash
   .claude/scripts/create-worktree.sh feat room-photos
   ```
   The script is non-interactive by default (no push), so Claude can run it directly.

3. **Pushing is opt-in and gated.** Nothing in the setup depends on the push (the Neon branch is created
   directly through `neonctl`, not by a Vercel/GitHub integration). Only pass `--push` when the user has
   asked for the branch to be pushed; `--push --yes` skips the interactive confirmation.

4. **After it finishes**, tell the user the worktree path and that the dev server in the other worktree
   must be stopped first (both apps bind fixed ports 3001 / 5173), or run with a different `PORT`.

## Flags

| Flag | Effect |
|---|---|
| `--base <branch>` | Branch off something other than `main` (default) |
| `--no-neon` | Skip the Neon DB branch; the worktree shares the main database (fine for UI-only work) |
| `--no-install` | Skip `pnpm install` in the new worktree (on by default) |
| `--push` | Push the new branch with `-u origin` (asks first) |
| `--yes` / `-y` | Skip the push confirmation (only with `--push`, and only after explicit approval) |

## Requirements / gotchas

- **neonctl** is used via `npx -y neonctl` (same as `pnpm db:setup`), or the global binary if installed.
  It must be logged in (`npx neonctl auth`, or `NEON_API_KEY` set). **jq** must be installed.
- **Project lookup:** `NEON_PROJECT_ID` from the environment or `apps/api/.env` wins; otherwise the
  project named `NEON_PROJECT_NAME` (default `campus-walk`) is found across the account's orgs. The
  resolved id is written into the new worktree's `.env` so `cleanup-worktree` finds it later.
- The main worktree must have `apps/api/.env`. If it does not, the script creates the worktree but skips
  the Neon steps and tells you to run `pnpm db:setup`.
- The script keeps an `apps/api/.env.bak` backup before rewriting `DATABASE_URL`.
- The Neon branch is a copy-on-write snapshot of the default branch's data at creation time. New
  migrations still need `pnpm --filter api db:migrate` inside the worktree.
- Neon's free plan caps the number of branches per project (ten at the time of writing). If creation
  fails, the script says so and leaves the worktree pointing at the main database; tear down a finished
  feature with the **`cleanup-worktree`** skill to free a slot.
- The new branch still needs a PR to `main` when the work is done (see Git workflow in `CLAUDE.md`).
