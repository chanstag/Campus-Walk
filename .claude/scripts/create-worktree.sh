#!/usr/bin/env bash
#
# create-worktree.sh — Create a new feature worktree wired to its own Neon DB branch.
#
# What it does (in order):
#   1. Fetches origin and creates a sibling worktree off latest origin/<base> (default: main)
#      with a new feature branch (e.g. feat/room-photos) checked out in it.
#   2. Copies the current worktree's apps/api/.env into the new worktree (your local secrets).
#   3. Creates a Neon DB branch named after the git branch (parent: the project's default branch),
#      and rewrites DATABASE_URL in the new worktree's apps/api/.env to point at it
#      (an .env.bak backup is kept). Migrations and db:seed in the worktree then never touch main's DB.
#   4. Runs `pnpm install` in the new worktree (pnpm's shared store makes this quick).
#   5. Optionally pushes the branch (`--push`; asks first unless --yes). Nothing depends on the push.
#
# Usage:
#   .claude/scripts/create-worktree.sh feat room-photos            # type + description
#   .claude/scripts/create-worktree.sh feat/room-photos            # full branch name
#   .claude/scripts/create-worktree.sh fix tree-sort --no-neon     # share main's database (no DB branch)
#   .claude/scripts/create-worktree.sh chore deps --no-install     # skip pnpm install
#   .claude/scripts/create-worktree.sh feat reports --push --yes   # also push -u origin, no prompt
#   .claude/scripts/create-worktree.sh feat reports --base main    # branch off a different base
#
# Requirements: git, jq, neonctl (global or via npx; must be logged in — `npx neonctl auth`).
# The Neon project is found via NEON_PROJECT_ID (env or apps/api/.env) or by name
# (NEON_PROJECT_NAME, default "campus-walk"). The resolved id is written into the new .env.

set -euo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_neon.sh"

# ── args ────────────────────────────────────────────────────────────────────
BASE_BRANCH="main"
DO_PUSH=false
DO_NEON=true
DO_INSTALL=true
ASSUME_YES=false
POSITIONAL=()

while [ $# -gt 0 ]; do
  case "$1" in
    --base)        BASE_BRANCH="$2"; shift 2;;
    --push)        DO_PUSH=true; shift;;
    --no-push)     DO_PUSH=false; shift;;
    --no-neon)     DO_NEON=false; shift;;
    --install)     DO_INSTALL=true; shift;;
    --no-install)  DO_INSTALL=false; shift;;
    --yes|-y)      ASSUME_YES=true; shift;;
    -h|--help)     grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    -*)            die "Unknown flag: $1";;
    *)             POSITIONAL+=("$1"); shift;;
  esac
done

[ ${#POSITIONAL[@]} -ge 1 ] || die "Need a branch. e.g. create-worktree.sh feat room-photos  (or feat/room-photos)"

# Build the branch name. Accept "<type> <desc>" or a single "<type>/<desc>" / "<branch>".
if [ ${#POSITIONAL[@]} -ge 2 ]; then
  TYPE="${POSITIONAL[0]}"
  DESC="${POSITIONAL[*]:1}"
  BRANCH="${TYPE}/$(echo "$DESC" | tr ' ' '-' | tr -cd '[:alnum:]/_-')"
else
  BRANCH="${POSITIONAL[0]}"
fi
BRANCH="$(echo "$BRANCH" | tr '[:upper:]' '[:lower:]')"
[[ "$BRANCH" == */* ]] || warn "Branch '$BRANCH' has no type prefix (feat/, fix/, chore/, ...). Continuing anyway."

# ── locate main repo + derive worktree dir ───────────────────────────────────
# `| head -1` here would SIGPIPE git once the porcelain listing outgrows the pipe
# buffer, and pipefail turns that into a silent exit 141. sed -n drains the stream.
MAIN_REPO="$(git worktree list --porcelain | sed -n '1s/^worktree //p')"
[ -n "$MAIN_REPO" ] || die "Could not determine main repo from 'git worktree list'."
CURRENT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WT_SUFFIX="$(echo "$BRANCH" | tr '/' '-')"
WT_DIR="$(dirname "$MAIN_REPO")/$(basename "$MAIN_REPO")-${WT_SUFFIX}"

echo
info "Branch:         ${GREEN}${BRANCH}${NC}"
info "Base:           origin/${BASE_BRANCH}"
info "Worktree dir:   ${WT_DIR}"
info "Copy .env from: ${CURRENT_DIR}/${ENV_REL}"
echo

[ -e "$WT_DIR" ] && die "Target directory already exists: $WT_DIR"
git show-ref --verify --quiet "refs/heads/$BRANCH" && die "Local branch '$BRANCH' already exists."

# ── 1. fetch + create worktree ────────────────────────────────────────────────
info "Fetching origin..."
git -C "$MAIN_REPO" fetch origin --quiet
git show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH" \
  || die "origin/$BASE_BRANCH not found. Fetch it or pick another --base."

info "Creating worktree..."
git -C "$MAIN_REPO" worktree add --no-track -b "$BRANCH" "$WT_DIR" "origin/$BASE_BRANCH" 2>&1 | sed 's/^/    /'
success "Worktree created at $WT_DIR on $BRANCH"

# ── 2. copy .env ──────────────────────────────────────────────────────────────
SRC_ENV="$CURRENT_DIR/$ENV_REL"
NEW_ENV="$WT_DIR/$ENV_REL"
if [ -f "$SRC_ENV" ]; then
  mkdir -p "$(dirname "$NEW_ENV")"
  cp "$SRC_ENV" "$NEW_ENV"
  success "Copied $ENV_REL into the new worktree"
else
  warn "No $ENV_REL in $CURRENT_DIR — nothing to copy. Run 'pnpm db:setup' there first, or in the new worktree."
  DO_NEON=false
fi

# ── 3. Neon: create DB branch + rewrite DATABASE_URL ─────────────────────────
if [ "$DO_NEON" = true ]; then
  command -v jq >/dev/null 2>&1 || { warn "jq not found — skipping DB wiring."; DO_NEON=false; }
fi
if [ "$DO_NEON" = true ]; then
  info "Resolving Neon project..."
  PROJECT_ID="$(resolve_neon_project_id "$NEW_ENV")"
  if [ -z "$PROJECT_ID" ]; then
    warn "Could not find the Neon project (not logged in? run 'npx neonctl auth'). Skipping DB wiring."
    warn "The new worktree still points at the SAME database as $CURRENT_DIR."
  else
    info "Neon project: $PROJECT_ID"
    env_upsert "$NEW_ENV" NEON_PROJECT_ID "$PROJECT_ID"

    EXISTING="$(neon branches list --project-id "$PROJECT_ID" --output json 2>/dev/null \
      | jq -r --arg b "$BRANCH" '(.branches? // .)[] | select(.name == $b) | .name' 2>/dev/null | sed -n '1p')"
    if [ -n "$EXISTING" ]; then
      warn "Neon branch '$BRANCH' already exists — reusing it."
    else
      info "Creating Neon branch '$BRANCH' (parent: default branch)..."
      if ! neon branches create --project-id "$PROJECT_ID" --name "$BRANCH" --output json >/dev/null 2>&1; then
        warn "Neon branch creation failed (branch limit reached? name taken?). Create it in the console, then:"
        echo "    neonctl connection-string \"$BRANCH\" --project-id \"$PROJECT_ID\"   # paste into DATABASE_URL in $NEW_ENV"
        DO_NEON=false
      else
        success "Created Neon branch '$BRANCH'"
      fi
    fi
  fi
fi
if [ "$DO_NEON" = true ]; then
  CONN="$(neon connection-string "$BRANCH" --project-id "$PROJECT_ID" 2>/dev/null || true)"
  if [[ ! "$CONN" =~ ^postgres(ql)?:// ]]; then
    warn "Could not fetch a connection string for Neon branch '$BRANCH'. Run:"
    echo "    neonctl connection-string \"$BRANCH\" --project-id \"$PROJECT_ID\"   # paste into DATABASE_URL in $NEW_ENV"
  else
    cp "$NEW_ENV" "$NEW_ENV.bak"
    env_upsert "$NEW_ENV" DATABASE_URL "$CONN"
    success "Rewrote DATABASE_URL in $NEW_ENV (backup: .env.bak) → Neon branch '$BRANCH'"
  fi
fi

# ── 4. install ────────────────────────────────────────────────────────────────
if [ "$DO_INSTALL" = true ]; then
  info "Running pnpm install in the new worktree..."
  ( cd "$WT_DIR" && pnpm install --silent ) 2>&1 | sed 's/^/    /'
  success "Dependencies installed"
fi

# ── 5. push (opt-in, gated) ───────────────────────────────────────────────────
if [ "$DO_PUSH" = true ] && [ "$ASSUME_YES" != true ]; then
  echo
  warn "About to PUSH '$BRANCH' to origin."
  read -r -p "$(echo -e "${YELLOW}Push now? (y/n) ${NC}")" -n 1 reply; echo
  [[ "$reply" =~ ^[Yy]$ ]] || { warn "Skipped push. Push later with:"; echo "    cd \"$WT_DIR\" && git push -u origin \"$BRANCH\""; DO_PUSH=false; }
fi
if [ "$DO_PUSH" = true ]; then
  info "Pushing $BRANCH..."
  git -C "$WT_DIR" push -u origin "$BRANCH" 2>&1 | sed 's/^/    /'
  success "Pushed origin/$BRANCH"
fi

# ── done ──────────────────────────────────────────────────────────────────────
echo
success "Feature worktree ready."
echo -e "  Next:"
echo -e "    cd \"$WT_DIR\""
[ "$DO_INSTALL" = true ] || echo -e "    pnpm install"
[ "$DO_NEON" = true ] && echo -e "    pnpm --filter api db:migrate   ${BLUE}# the DB branch is a copy of main's data; apply new migrations here${NC}"
echo -e "    pnpm dev                       ${BLUE}# stop the dev server in the other worktree first (ports 3001/5173)${NC}"
