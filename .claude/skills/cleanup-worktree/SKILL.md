---
name: cleanup-worktree
description: Tear down a feature worktree created by create-worktree, including its local branch and Neon database branch. Use this skill when the user asks to remove a worktree, clean up a worktree, delete a feature worktree, tear down an isolated environment, or get rid of a finished/merged feature branch's worktree. Apply when the user mentions "remove worktree", "clean up worktree", "delete worktree", or finishing/abandoning work that was set up in its own worktree.
---

## When to use this skill

- The user finished (merged or abandoned) a feature that lived in its own worktree and wants it torn down
- The user asks to "remove / clean up / delete a worktree" or "get rid of that feature branch's worktree"
- This is the counterpart to the `create-worktree` skill

## What it does

Resolves the target worktree (by branch name or directory), removes the git worktree, deletes the local
branch, and deletes the matching Neon DB branch if it still exists. Hard guards refuse the main repo,
the current directory, and protected branches (`main`, `master`).

The logic lives in `.claude/scripts/cleanup-worktree.sh` (committed to the repo).

## Procedure

1. **Confirm which worktree** to tear down. Accepts either the branch name or the directory path:
   ```bash
   .claude/scripts/cleanup-worktree.sh feat/room-photos
   .claude/scripts/cleanup-worktree.sh "../Campus Walk-feat-room-photos"
   ```

2. **Run from outside the target worktree** — typically the main `Campus Walk` worktree. The script
   refuses to remove the worktree you're standing in.

3. **It confirms before destroying anything** (interactive `Proceed? (y/n)`). Since Claude cannot answer
   an interactive prompt, either have the user run it, or pass `--yes` once the user has confirmed what
   should be removed.

4. **Dirty / unmerged safety:** if the worktree has uncommitted changes or the branch isn't fully merged,
   the script stops and tells you to use `--force`. Don't reach for `--force` without confirming the user
   is OK discarding that work.

## Flags

| Flag | Effect |
|---|---|
| `--keep-db` | Don't delete the Neon DB branch |
| `--keep-branch` | Remove the worktree but keep the local git branch |
| `--delete-remote` | Also delete `origin/<branch>` (asks first) |
| `--force` | Remove even with uncommitted changes / delete an unmerged branch |
| `--yes` / `-y` | Skip all confirmation prompts |

## Requirements / gotchas

- **neonctl** (via npx or global) + **jq** are needed to delete the Neon DB branch. The project id comes
  from `NEON_PROJECT_ID` in the environment, the worktree's `apps/api/.env`, or the main repo's
  `apps/api/.env`, else by project name (`NEON_PROJECT_NAME`, default `campus-walk`). If it can't be
  resolved, the script skips DB cleanup and says so.
- **Neon branch naming:** the DB branch has the same name as the git branch (git `feat/x` → Neon
  `feat/x`). If the worktree was later switched to a different branch, the script also recovers the
  original name from the directory (`Campus Walk-feat-x` → `feat/x`) and checks both.
- A worktree created with `--no-neon` has no DB branch; the script reports "no Neon DB branch found" and
  carries on.
- Protected branches (`main`, `master`), the main repo worktree, and the current directory are always
  refused — this skill only removes feature worktrees.
