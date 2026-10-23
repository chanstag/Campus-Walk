#!/usr/bin/env bash
#
# setup-test-db.sh — Point the test suites at their own Neon branch.
#
#   pnpm db:setup:test            # from the repo root
#   pnpm db:setup:test --no-seed  # only write .env.test; skip migrate + seed
#
# 1. Finds the Neon project (NEON_PROJECT_ID in apps/api/.env, or by name "campus-walk").
# 2. Creates a Neon branch named "test" (TEST_NEON_BRANCH to override) if it does not exist.
# 3. Writes apps/api/.env.test: the branch's DATABASE_URL, the E2E ports (API 3101, web 5174),
#    the Better Auth secret from .env, and CAMPUS_WALK_TEST=1 (the marker the test runner and the
#    test seed check before truncating anything).
# 4. Runs the migrations and the test seed against it.
#
# Idempotent: rerun it after adding migrations or to refresh the file. Requires jq and neonctl
# (global or via npx, logged in), the same as .claude/scripts/create-worktree.sh.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
. "$ROOT/.claude/scripts/_neon.sh"

DO_SEED=true
for arg in "$@"; do
  case "$arg" in
    --no-seed) DO_SEED=false;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) die "Unknown flag: $arg";;
  esac
done

ENV_FILE="$ROOT/apps/api/.env"
TEST_ENV="$ROOT/apps/api/.env.test"
BRANCH="${TEST_NEON_BRANCH:-test}"

[ -f "$ENV_FILE" ] || die "apps/api/.env not found. Run 'pnpm db:setup' first."
command -v jq >/dev/null 2>&1 || die "jq is required."

info "Resolving Neon project..."
PROJECT_ID="$(resolve_neon_project_id "$ENV_FILE")"
[ -n "$PROJECT_ID" ] || die "Could not find the Neon project (not logged in? run 'npx neonctl auth')."
info "Neon project: $PROJECT_ID"

EXISTING="$(neon branches list --project-id "$PROJECT_ID" --output json 2>/dev/null \
  | jq -r --arg b "$BRANCH" '(.branches? // .)[] | select(.name == $b) | .name' 2>/dev/null | sed -n '1p')"
if [ -n "$EXISTING" ]; then
  info "Neon branch '$BRANCH' already exists; reusing it."
else
  info "Creating Neon branch '$BRANCH' (parent: default branch)..."
  neon branches create --project-id "$PROJECT_ID" --name "$BRANCH" --output json >/dev/null \
    || die "Neon branch creation failed (branch limit reached?). Free a slot with .claude/scripts/cleanup-worktree.sh and retry."
  success "Created Neon branch '$BRANCH'"
fi

CONN="$(neon connection-string "$BRANCH" --project-id "$PROJECT_ID" 2>/dev/null || true)"
[[ "$CONN" =~ ^postgres(ql)?:// ]] || die "Could not fetch a connection string for Neon branch '$BRANCH'."

DEV_URL="$(env_value "$ENV_FILE" DATABASE_URL)"
[ "$CONN" != "$DEV_URL" ] || die "The '$BRANCH' branch resolves to the same URL as .env. Refusing to write .env.test."

SECRET="$(env_value "$ENV_FILE" BETTER_AUTH_SECRET)"
[ -n "$SECRET" ] || SECRET="$(openssl rand -base64 32)"

touch "$TEST_ENV"
env_upsert "$TEST_ENV" CAMPUS_WALK_TEST "1"
env_upsert "$TEST_ENV" DATABASE_URL "$CONN"
env_upsert "$TEST_ENV" PORT "3101"
env_upsert "$TEST_ENV" APP_URL "http://localhost:5174"
env_upsert "$TEST_ENV" API_URL "http://localhost:3101"
env_upsert "$TEST_ENV" BETTER_AUTH_SECRET "$SECRET"
env_upsert "$TEST_ENV" NEON_PROJECT_ID "$PROJECT_ID"
chmod 600 "$TEST_ENV"
success "Wrote $TEST_ENV → Neon branch '$BRANCH'"

if [ "$DO_SEED" = true ]; then
  info "Applying migrations to the test branch..."
  ( cd "$ROOT" && pnpm --filter api db:migrate:test ) 2>&1 | sed 's/^/    /'
  info "Seeding the test branch..."
  ( cd "$ROOT" && pnpm --filter api db:seed:test ) 2>&1 | sed 's/^/    /'
  success "Test database ready."
fi

echo
echo -e "  Next:"
echo -e "    pnpm test        ${BLUE}# Vitest: api routers + web units${NC}"
echo -e "    pnpm test:e2e    ${BLUE}# Playwright (first time: pnpm exec playwright install chromium)${NC}"
