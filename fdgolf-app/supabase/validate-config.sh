#!/usr/bin/env bash
# Validates that supabase/config.toml contains the required auth keys for US-0002 AC-0010.
# Exit 0 = all checks pass. Exit 1 = one or more checks failed.

set -euo pipefail

CONFIG="$(dirname "$0")/config.toml"

if [[ ! -f "$CONFIG" ]]; then
  echo "FAIL: config.toml not found at $CONFIG"
  exit 1
fi

ERRORS=0

check() {
  local label="$1"
  local pattern="$2"
  if grep -qE "$pattern" "$CONFIG"; then
    echo "PASS: $label"
  else
    echo "FAIL: $label (pattern: $pattern)"
    ERRORS=$((ERRORS + 1))
  fi
}

check "project_id is set (non-empty)"         '^project_id\s*=\s*"[^"]+'
check "[auth] section exists"                  '^\[auth\]'
check "auth.enabled = true"                    '^enabled\s*=\s*true'
check "auth.site_url = localhost:3000"          '^site_url\s*=\s*"http://localhost:3000"'
check "[auth.email] section exists"            '^\[auth\.email\]'
check "auth.email.enable_signup = true"        '^enable_signup\s*=\s*true'
check "auth.email.double_confirm_changes = true" '^double_confirm_changes\s*=\s*true'
check "auth.email.enable_confirmations = false" '^enable_confirmations\s*=\s*false'

if [[ $ERRORS -gt 0 ]]; then
  echo ""
  echo "RESULT: $ERRORS check(s) failed."
  exit 1
fi

echo ""
echo "RESULT: All checks passed. AC-0010 config requirements met."
exit 0
