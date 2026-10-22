#!/usr/bin/env bash
#
# _neon.sh — shared helpers for create-worktree.sh / cleanup-worktree.sh. Source it; don't run it.
#
#   . "$(dirname "$0")/_neon.sh"
#
# Provides colored log helpers, a `neon` wrapper (global neonctl if installed, else `npx -y neonctl`,
# always non-interactive), and `resolve_neon_project_id`, which finds the Neon project for this repo.

if [ -z "${_WT_COLORS_SET:-}" ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
  _WT_COLORS_SET=1
fi
info()    { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✗${NC}  $*" >&2; }
die()     { error "$*"; exit 1; }

# Where the API's .env lives, relative to a worktree root. This is the only .env in the repo.
ENV_REL="apps/api/.env"

# Run neonctl non-interactively. Mirrors scripts/setup-neon.mjs, which uses `npx -y neonctl`
# so nothing has to be installed globally.
neon() {
  if command -v neonctl >/dev/null 2>&1; then
    neonctl "$@" --no-analytics --no-color
  else
    npx -y neonctl "$@" --no-analytics --no-color
  fi
}

# Read KEY from an env file (first match, quotes stripped). Prints nothing if absent.
env_value() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" | sed -n "1s/^${key}=//p" | tr -d "\"'"
}

# Insert-or-replace KEY=VALUE in an env file.
env_upsert() {
  local file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp)"
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    awk -v k="$key" -v v="$value" 'index($0, k"=")==1 {print k"="v; next} {print}' "$file" > "$tmp"
  else
    cat "$file" > "$tmp" 2>/dev/null || true
    [ -s "$tmp" ] && [ -n "$(tail -c1 "$tmp")" ] && echo >> "$tmp"
    echo "${key}=${value}" >> "$tmp"
  fi
  cat "$tmp" > "$file"; rm -f "$tmp"
}

# Resolve the Neon project id, in order:
#   1. $NEON_PROJECT_ID in the environment
#   2. NEON_PROJECT_ID= in any env file passed as arguments
#   3. Look up the project named $NEON_PROJECT_NAME (default "campus-walk", same as
#      scripts/setup-neon.mjs) across every org the logged-in account can see.
# Prints the id, or nothing if it could not be found.
resolve_neon_project_id() {
  local id="${NEON_PROJECT_ID:-}" f name="${NEON_PROJECT_NAME:-campus-walk}" orgs org listed
  for f in "$@"; do
    [ -n "$id" ] && break
    id="$(env_value "$f" NEON_PROJECT_ID)"
  done
  if [ -z "$id" ]; then
    orgs="$(neon orgs list --output json 2>/dev/null | jq -r '(.organizations? // .)[].id' 2>/dev/null || true)"
    for org in $orgs; do
      listed="$(neon projects list --org-id "$org" --output json 2>/dev/null || true)"
      id="$(printf '%s' "$listed" | jq -r --arg n "$name" '(.projects? // .)[] | select(.name == $n) | .id' 2>/dev/null | sed -n '1p')"
      [ -n "$id" ] && break
    done
  fi
  printf '%s' "$id"
}
