#!/usr/bin/env bash
#
# cleanup-worktree.sh — Tear down a feature worktree created by create-worktree.sh.
#
# What it does (in order):
#   1. Resolves the target worktree + branch from a branch name OR a directory path.
#   2. Guards: refuses to touch the main repo, the current dir, or protected branches (main, master).
#   3. Warns about uncommitted changes / unpushed commits (needs --force to proceed).
#   4. Removes the git worktree and deletes the local branch.
#   5. Deletes the matching Neon DB branch if it still exists (--keep-db to skip).
#   6. Optionally deletes the remote branch (--delete-remote; asks first).
#
# Usage:
#   .claude/scripts/cleanup-worktree.sh feat/room-photos                 # by branch name
#   .claude/scripts/cleanup-worktree.sh "../Campus Walk-feat-room-photos" # by directory
#   .claude/scripts/cleanup-worktree.sh feat/room-photos --yes           # skip confirmation
#   .claude/scripts/cleanup-worktree.sh feat/room-photos --force         # remove even if dirty/unmerged
#   .claude/scripts/cleanup-worktree.sh feat/room-photos --keep-db       # leave the Neon DB branch
#   .claude/scripts/cleanup-worktree.sh feat/room-photos --delete-remote # also delete origin branch
#
# Requirements: git, jq, neonctl (global or via npx) for DB cleanup.
# The Neon project is found via NEON_PROJECT_ID (env, the worktree's apps/api/.env, or the main
# repo's apps/api/.env) or by name (NEON_PROJECT_NAME, default "campus-walk").

set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_neon.sh"

# ── args ────────────────────────────────────────────────────────────────────
DO_DB=true
DELETE_LOCAL=true
DELETE_REMOTE=false
FORCE=false
ASSUME_YES=false
POSITIONAL=()

while [ $# -gt 0 ]; do
  case "$1" in
    --keep-db)        DO_DB=false; shift;;
    --keep-branch)    DELETE_LOCAL=false; shift;;
    --delete-remote)  DELETE_REMOTE=true; shift;;
    --force)          FORCE=true; shift;;
    --yes|-y)         ASSUME_YES=true; shift;;
    -h|--help)        grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    -*)               die "Unknown flag: $1";;
    *)                POSITIONAL+=("$1"); shift;;
  esac
done

[ ${#POSITIONAL[@]} -ge 1 ] || die "Need a branch or worktree path. e.g. cleanup-worktree.sh feat/room-photos"
INPUT="${POSITIONAL[0]}"

# ── locate main repo ──────────────────────────────────────────────────────────
MAIN_REPO="$(git worktree list --porcelain | sed -n '1s/^worktree //p')"
[ -n "$MAIN_REPO" ] || die "Could not determine main repo from 'git worktree list'."
MAIN_REPO="$(cd "$MAIN_REPO" && pwd -P)"
CURRENT_DIR="$(pwd -P)"

# ── resolve the target worktree (path + branch) from a branch name or dir ─────
INPUT_ABS=""
if [ -d "$INPUT" ]; then
  INPUT_ABS="$(cd "$INPUT" && pwd -P)"
fi

WT_PATH=""; WT_BRANCH=""; cur_path=""; cur_branch=""
while IFS= read -r line; do
  case "$line" in
    "worktree "*) cur_path="${line#worktree }";;
    "branch "*)   cur_branch="${line#branch refs/heads/}";;
    "")
      [ -z "$cur_path" ] && continue
      cur_path_abs="$(cd "$cur_path" 2>/dev/null && pwd -P || echo "$cur_path")"
      if [ "$cur_branch" = "$INPUT" ] || { [ -n "$INPUT_ABS" ] && [ "$cur_path_abs" = "$INPUT_ABS" ]; }; then
        WT_PATH="$cur_path_abs"; WT_BRANCH="$cur_branch"
      fi
      cur_path=""; cur_branch="";;
  esac
done < <(git worktree list --porcelain; echo)

[ -n "$WT_PATH" ] || die "No worktree found matching '$INPUT'. Run 'git worktree list' to see them."

echo
info "Worktree:  $WT_PATH"
info "Branch:    ${GREEN}${WT_BRANCH:-<detached>}${NC}"
echo

# ── guards ────────────────────────────────────────────────────────────────────
[ "$WT_PATH" = "$MAIN_REPO" ] && die "Refusing to remove the MAIN repo worktree."
case "$CURRENT_DIR" in
  "$WT_PATH"|"$WT_PATH"/*) die "Refusing to remove the worktree you're standing in. cd elsewhere (e.g. \"$MAIN_REPO\") first.";;
esac
case "$WT_BRANCH" in
  main|master) die "Refusing to remove protected branch worktree '$WT_BRANCH'.";;
esac

# ── candidate Neon branch names ───────────────────────────────────────────────
# The Neon branch is named after the git branch the worktree was CREATED with. A worktree
# can outlive that branch (finish feat/x, reuse the dir for fix/y), so also recover the
# original name from the directory: create-worktree.sh names the dir
# "<repo>-<type>-<desc>" for branch "<type>/<desc>".
NEON_CANDIDATES=()
[ -n "$WT_BRANCH" ] && NEON_CANDIDATES+=("$WT_BRANCH")

WT_DIRNAME="$(basename "$WT_PATH")"
REPO_BASENAME="$(basename "$MAIN_REPO")"
case "$WT_DIRNAME" in
  "$REPO_BASENAME"-*)
    SUFFIX="${WT_DIRNAME#"$REPO_BASENAME"-}"
    case "$SUFFIX" in
      feat-*|fix-*|chore-*|refactor-*|docs-*)
        ORIGINAL_BRANCH="${SUFFIX/-//}"
        if [ "$ORIGINAL_BRANCH" != "$WT_BRANCH" ]; then
          if git worktree list --porcelain | grep -qx "branch refs/heads/$ORIGINAL_BRANCH"; then
            warn "Directory implies '$ORIGINAL_BRANCH', but that branch is checked out in another worktree — leaving its DB branch alone."
          else
            info "Worktree was created as '$ORIGINAL_BRANCH' (now on '${WT_BRANCH:-detached}') — will check both for a DB branch."
            NEON_CANDIDATES+=("$ORIGINAL_BRANCH")
          fi
        fi;;
    esac;;
esac

# ── resolve NEON_PROJECT_ID BEFORE removing the worktree (its .env may hold it) ─
PROJECT_ID=""
if [ "$DO_DB" = true ] && [ ${#NEON_CANDIDATES[@]} -gt 0 ]; then
  PROJECT_ID="$(resolve_neon_project_id "$WT_PATH/$ENV_REL" "$MAIN_REPO/$ENV_REL")"
fi

# ── pre-flight warnings: dirty tree / unpushed commits ────────────────────────
if [ -n "$(git -C "$WT_PATH" status --porcelain 2>/dev/null)" ]; then
  warn "Worktree has UNCOMMITTED changes."
  [ "$FORCE" = true ] || die "Pass --force to discard them, or commit/stash first."
fi
if [ -n "$WT_BRANCH" ] && git -C "$WT_PATH" rev-parse --verify --quiet "@{upstream}" >/dev/null 2>&1; then
  unpushed="$(git -C "$WT_PATH" rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo 0)"
  [ "$unpushed" -gt 0 ] && warn "Branch has $unpushed commit(s) not pushed to its upstream."
elif [ -n "$WT_BRANCH" ]; then
  warn "Branch '$WT_BRANCH' has no upstream (never pushed)."
fi

# ── confirm ───────────────────────────────────────────────────────────────────
if [ "$ASSUME_YES" != true ]; then
  echo
  warn "This will remove the worktree$([ "$DELETE_LOCAL" = true ] && echo ", delete local branch '$WT_BRANCH'")$([ "$DO_DB" = true ] && [ -n "$PROJECT_ID" ] && echo ", and delete the Neon DB branch")."
  read -r -p "$(echo -e "${YELLOW}Proceed? (y/n) ${NC}")" -n 1 reply; echo
  [[ "$reply" =~ ^[Yy]$ ]] || die "Aborted."
fi

# ── warn about live processes rooted in the worktree ──────────────────────────
# A dev server left running here keeps writing (Vite cache, tsc output) and can
# re-create the directory after git deletes it. Named, not killed.
if command -v lsof >/dev/null 2>&1; then
  ROOTED_PIDS="$(lsof -a -d cwd -t -- "$WT_PATH" 2>/dev/null || true)"
  if [ -n "$ROOTED_PIDS" ]; then
    warn "Processes are still running in this worktree:"
    ps -o pid=,command= -p "$(echo "$ROOTED_PIDS" | tr '\n' ',' | sed 's/,$//')" 2>/dev/null \
      | cut -c1-110 | sed 's/^/    /'
    warn "They will keep writing here. Kill them first if the directory keeps coming back."
  fi
fi

# ── 1. remove the worktree ────────────────────────────────────────────────────
info "Removing worktree..."
if [ "$FORCE" = true ]; then
  git -C "$MAIN_REPO" worktree remove --force "$WT_PATH" 2>&1 | sed 's/^/    /' || true
else
  git -C "$MAIN_REPO" worktree remove "$WT_PATH" 2>&1 | sed 's/^/    /'
fi

nuke_dir() {
  case "$WT_PATH" in
    /|"$MAIN_REPO"|"$CURRENT_DIR"|*/) die "Refusing to rm -rf '$WT_PATH'.";;
  esac
  rm -rf "$WT_PATH"
}

# git unregisters the worktree even when it then fails to delete the directory
# (node_modules being rewritten under it mid-walk). Finish the job so the path
# does not block the next create-worktree.
if [ -d "$WT_PATH" ]; then
  warn "git left '$WT_PATH' behind — removing it."
  nuke_dir
  [ -d "$WT_PATH" ] && die "Could not remove '$WT_PATH' — delete it by hand, then re-run."
fi
git -C "$MAIN_REPO" worktree prune

sleep 1
if [ -d "$WT_PATH" ]; then
  warn "'$WT_PATH' came back after removal — something is still writing to it."
  find "$WT_PATH" -mindepth 1 -maxdepth 2 2>/dev/null | head -5 | sed 's/^/    /'
  nuke_dir
  [ -d "$WT_PATH" ] && die "'$WT_PATH' keeps reappearing. Find the writer with: lsof +D '$WT_PATH'"
  success "Removed again — check for stray dev servers if this recurs."
fi
success "Worktree removed: $WT_PATH"

# ── 2. delete local branch ────────────────────────────────────────────────────
if [ "$DELETE_LOCAL" = true ] && [ -n "$WT_BRANCH" ]; then
  if [ "$FORCE" = true ]; then
    git -C "$MAIN_REPO" branch -D "$WT_BRANCH" 2>&1 | sed 's/^/    /' || true
  else
    if ! git -C "$MAIN_REPO" branch -d "$WT_BRANCH" 2>/dev/null; then
      warn "Local branch '$WT_BRANCH' is not fully merged — kept it. Use --force to delete anyway."
    fi
  fi
  git -C "$MAIN_REPO" show-ref --verify --quiet "refs/heads/$WT_BRANCH" || success "Deleted local branch '$WT_BRANCH'"
fi

# ── 3. delete Neon DB branch ──────────────────────────────────────────────────
if [ "$DO_DB" = true ] && [ ${#NEON_CANDIDATES[@]} -gt 0 ]; then
  if ! command -v jq >/dev/null 2>&1; then
    warn "jq not found — skipping Neon cleanup."
  elif [ -z "$PROJECT_ID" ]; then
    warn "Could not resolve the Neon project — skipping Neon cleanup. Delete the DB branch in the Neon console if it exists."
  else
    NEON_LIST="$(neon branches list --project-id "$PROJECT_ID" --output json 2>/dev/null || true)"
    FOUND_ANY=false
    for cand in "${NEON_CANDIDATES[@]}"; do
      NEON_BRANCH="$(printf '%s' "$NEON_LIST" \
        | jq -r --arg b "$cand" '(.branches? // .)[] | select(.name == $b) | .name' 2>/dev/null | sed -n '1p')"
      [ -n "$NEON_BRANCH" ] || continue
      FOUND_ANY=true
      info "Deleting Neon DB branch '$NEON_BRANCH'..."
      if neon branches delete "$NEON_BRANCH" --project-id "$PROJECT_ID" --output json >/dev/null 2>&1; then
        success "Deleted Neon DB branch '$NEON_BRANCH'"
      else
        warn "Failed to delete Neon branch '$NEON_BRANCH' — remove it manually in the Neon console."
      fi
    done
    if [ "$FOUND_ANY" = false ]; then
      info "No Neon DB branch found — looked for: $(printf "'%s' " "${NEON_CANDIDATES[@]}")— already cleaned up, or created with --no-neon."
    fi
  fi
fi

# ── 4. delete remote branch (gated) ───────────────────────────────────────────
if [ "$DELETE_REMOTE" = true ] && [ -n "$WT_BRANCH" ]; then
  if [ "$ASSUME_YES" != true ]; then
    warn "About to delete REMOTE branch origin/$WT_BRANCH."
    read -r -p "$(echo -e "${YELLOW}Delete remote? (y/n) ${NC}")" -n 1 reply; echo
    [[ "$reply" =~ ^[Yy]$ ]] || DELETE_REMOTE=false
  fi
  if [ "$DELETE_REMOTE" = true ]; then
    git -C "$MAIN_REPO" push origin --delete "$WT_BRANCH" 2>&1 | sed 's/^/    /' \
      && success "Deleted origin/$WT_BRANCH" || warn "Could not delete remote (already gone?)."
  fi
fi

# ── 5. prune ──────────────────────────────────────────────────────────────────
git -C "$MAIN_REPO" worktree prune
echo
success "Cleanup complete."
