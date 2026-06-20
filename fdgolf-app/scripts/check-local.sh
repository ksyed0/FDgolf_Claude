#!/usr/bin/env bash
# Pre-flight validator. Exit 0 = all clear, 1 = hard blocker, 2 = warnings only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/.."
WARNINGS=0
ERRORS=0

pass() { echo "✓ $1"; }
warn() { echo "⚠ $1"; WARNINGS=$((WARNINGS+1)); }
fail() { echo "✗ $1"; ERRORS=$((ERRORS+1)); }

# 1. Required binaries
for bin in node npm curl psql jq; do
  if command -v "$bin" &>/dev/null; then
    pass "$bin $(command -v $bin)"
  else
    fail "$bin not found — install via Homebrew: brew install $bin"
  fi
done

# 2. .env.local
ENV_LOCAL="$APP_DIR/.env.local"
if [[ ! -f "$ENV_LOCAL" ]]; then
  fail ".env.local not found — copy .env.local.example and fill in values"
else
  for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_MAPBOX_TOKEN; do
    if grep -q "^${key}=.\+" "$ENV_LOCAL" 2>/dev/null; then
      pass ".env.local — $key present"
    else
      fail ".env.local — $key missing or empty"
    fi
  done
fi

# 3. .env.test
ENV_TEST="$APP_DIR/.env.test"
if [[ ! -f "$ENV_TEST" ]]; then
  warn ".env.test not found — E2E tests will fail. Copy .env.test.example and fill in values."
else
  for key in NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY TEST_ADMIN_EMAIL TEST_ADMIN_PASSWORD E2E_PLAYER_EMAIL E2E_PLAYER_PASSWORD; do
    if grep -q "^${key}=.\+" "$ENV_TEST" 2>/dev/null; then
      pass ".env.test — $key present"
    else
      warn ".env.test — $key missing (E2E tests will fail)"
    fi
  done
fi

# 4. Supabase running
if curl -sf http://127.0.0.1:54321/health &>/dev/null; then
  pass "Supabase running (http://127.0.0.1:54321)"
else
  fail "Supabase not running — run: npm run supabase:start"
fi

# 5. Migrations applied (expect ≥15 tables)
if command -v psql &>/dev/null; then
  TABLE_COUNT=$(psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
    --quiet --no-psqlrc -t \
    -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null | tr -d ' ')
  if [[ "$TABLE_COUNT" -ge 15 ]] 2>/dev/null; then
    pass "Migrations applied ($TABLE_COUNT tables)"
  else
    fail "Migrations not applied (found $TABLE_COUNT tables, expected ≥15) — run: npm run db:reset"
  fi
fi

# 6. Playwright
if npx playwright --version &>/dev/null 2>&1; then
  PW_VER=$(npx playwright --version 2>/dev/null)
  pass "Playwright $PW_VER"
else
  warn "Playwright not installed — run: npx playwright install chromium"
fi

# 7. tsx
if npx tsx --version &>/dev/null 2>&1; then
  TSX_VER=$(npx tsx --version 2>/dev/null)
  pass "tsx $TSX_VER"
else
  warn "tsx not available — run: npm install -D tsx"
fi

# 8. Dev server (soft check)
if curl -sf http://localhost:3000 &>/dev/null; then
  pass "Next.js dev server running on :3000"
else
  warn "Next.js dev server not detected on :3000 — run 'npm run dev' before e2e tests"
fi

echo ""
if [[ $ERRORS -gt 0 ]]; then
  echo "✗ $ERRORS error(s) found — fix before running tests."
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo "⚠ All checks passed with $WARNINGS warning(s)."
  exit 2
else
  echo "✓ All checks passed."
  exit 0
fi
