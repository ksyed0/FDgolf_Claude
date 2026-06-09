#!/usr/bin/env bash
# Validates that all 15 standard clubs from US-0008 exist in the local Supabase DB
# with correct club_type, default_loft_degrees, display_order, and is_active values.
# Requires the local Supabase stack to be running (supabase start via OrbStack/Docker).
# Exit 0 = all checks pass. Exit 1 = one or more checks failed.

set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
ERRORS=0

psql_query() {
  psql "$DB_URL" -t -A -c "$1" 2>/dev/null
}

check_club() {
  local display_name="$1"
  local club_type="$2"
  local expected_loft="$3"   # pass "NULL" as string to check for null
  local display_order="$4"
  local is_active="$5"

  # Check row exists with correct club_type
  local type_result
  type_result=$(psql_query "SELECT COUNT(*) FROM clubs WHERE display_name = '${display_name}' AND club_type = '${club_type}';")
  if [[ "$type_result" == "1" ]]; then
    echo "PASS: '${display_name}' exists with club_type='${club_type}'"
  else
    echo "FAIL: '${display_name}' missing or wrong club_type (expected '${club_type}')"
    ERRORS=$((ERRORS + 1))
  fi

  # Check loft
  if [[ "$expected_loft" == "NULL" ]]; then
    local loft_result
    loft_result=$(psql_query "SELECT COUNT(*) FROM clubs WHERE display_name = '${display_name}' AND default_loft_degrees IS NULL;")
    if [[ "$loft_result" == "1" ]]; then
      echo "PASS: '${display_name}' has NULL loft (correct for Putter)"
    else
      echo "FAIL: '${display_name}' expected NULL loft but got a value"
      ERRORS=$((ERRORS + 1))
    fi
  else
    local loft_result
    loft_result=$(psql_query "SELECT COUNT(*) FROM clubs WHERE display_name = '${display_name}' AND default_loft_degrees = ${expected_loft};")
    if [[ "$loft_result" == "1" ]]; then
      echo "PASS: '${display_name}' has default_loft_degrees=${expected_loft}"
    else
      local actual_loft
      actual_loft=$(psql_query "SELECT default_loft_degrees FROM clubs WHERE display_name = '${display_name}';")
      echo "FAIL: '${display_name}' expected loft=${expected_loft}, got '${actual_loft}'"
      ERRORS=$((ERRORS + 1))
    fi
  fi

  # Check display_order
  local order_result
  order_result=$(psql_query "SELECT COUNT(*) FROM clubs WHERE display_name = '${display_name}' AND display_order = ${display_order};")
  if [[ "$order_result" == "1" ]]; then
    echo "PASS: '${display_name}' has display_order=${display_order}"
  else
    local actual_order
    actual_order=$(psql_query "SELECT display_order FROM clubs WHERE display_name = '${display_name}';")
    echo "FAIL: '${display_name}' expected display_order=${display_order}, got '${actual_order}'"
    ERRORS=$((ERRORS + 1))
  fi

  # Check is_active
  local active_result
  active_result=$(psql_query "SELECT COUNT(*) FROM clubs WHERE display_name = '${display_name}' AND is_active = ${is_active};")
  if [[ "$active_result" == "1" ]]; then
    echo "PASS: '${display_name}' has is_active=${is_active}"
  else
    echo "FAIL: '${display_name}' expected is_active=${is_active}"
    ERRORS=$((ERRORS + 1))
  fi

  echo ""
}

echo "=== FDgolf Club Seed Validation (US-0008) ==="
echo ""

# Check total count first
TOTAL=$(psql_query "SELECT COUNT(*) FROM clubs;")
if [[ "$TOTAL" -ge "15" ]]; then
  echo "PASS: clubs table has ${TOTAL} row(s) (>= 15 required)"
else
  echo "FAIL: clubs table has ${TOTAL} row(s), expected at least 15"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check unique constraint on display_name exists (AC-0043 infrastructure)
UNIQUE_CNT=$(psql_query "SELECT COUNT(*) FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.table_schema = 'public' AND tc.table_name = 'clubs' AND tc.constraint_type = 'UNIQUE' AND kcu.column_name = 'display_name';")
if [[ "$UNIQUE_CNT" -ge "1" ]]; then
  echo "PASS: clubs.display_name has a UNIQUE constraint (idempotency foundation)"
else
  echo "FAIL: clubs.display_name missing UNIQUE constraint — idempotency (AC-0043) not guaranteed"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "--- Per-club checks (AC-0040, AC-0041, AC-0042) ---"
echo ""
#               display_name      club_type  loft    display_order  is_active
check_club      "Driver"          "wood"     "10.5"  "1"            "true"
check_club      "3-Wood"          "wood"     "15"    "2"            "true"
check_club      "5-Wood"          "wood"     "18"    "3"            "true"
check_club      "3-Hybrid"        "hybrid"   "19"    "4"            "true"
check_club      "4-Iron"          "iron"     "20"    "5"            "true"
check_club      "5-Iron"          "iron"     "24"    "6"            "true"
check_club      "6-Iron"          "iron"     "28"    "7"            "true"
check_club      "7-Iron"          "iron"     "32"    "8"            "true"
check_club      "8-Iron"          "iron"     "37"    "9"            "true"
check_club      "9-Iron"          "iron"     "42"    "10"           "true"
check_club      "Pitching Wedge"  "wedge"    "46"    "11"           "true"
check_club      "Gap Wedge"       "wedge"    "50"    "12"           "true"
check_club      "Sand Wedge"      "wedge"    "55"    "13"           "true"
check_club      "Lob Wedge"       "wedge"    "60"    "14"           "true"
check_club      "Putter"          "putter"   "NULL"  "15"           "true"

# Idempotency check: run the insert SQL again and verify count stays the same
echo "--- Idempotency check (AC-0043) ---"
echo ""
BEFORE_COUNT=$(psql_query "SELECT COUNT(*) FROM clubs;")
psql "$DB_URL" -c "
  INSERT INTO clubs (display_name, club_type, default_loft_degrees, display_order, is_active) VALUES
    ('Driver',         'wood',   10.5,  1,  true),
    ('3-Wood',         'wood',   15,    2,  true),
    ('5-Wood',         'wood',   18,    3,  true),
    ('3-Hybrid',       'hybrid', 19,    4,  true),
    ('4-Iron',         'iron',   20,    5,  true),
    ('5-Iron',         'iron',   24,    6,  true),
    ('6-Iron',         'iron',   28,    7,  true),
    ('7-Iron',         'iron',   32,    8,  true),
    ('8-Iron',         'iron',   37,    9,  true),
    ('9-Iron',         'iron',   42,    10, true),
    ('Pitching Wedge', 'wedge',  46,    11, true),
    ('Gap Wedge',      'wedge',  50,    12, true),
    ('Sand Wedge',     'wedge',  55,    13, true),
    ('Lob Wedge',      'wedge',  60,    14, true),
    ('Putter',         'putter', NULL,  15, true)
  ON CONFLICT (display_name) DO NOTHING;
" > /dev/null 2>&1
AFTER_COUNT=$(psql_query "SELECT COUNT(*) FROM clubs;")
if [[ "$BEFORE_COUNT" == "$AFTER_COUNT" ]]; then
  echo "PASS: re-running INSERT did not create duplicates (before=${BEFORE_COUNT}, after=${AFTER_COUNT})"
else
  echo "FAIL: re-running INSERT changed count from ${BEFORE_COUNT} to ${AFTER_COUNT} — seed is NOT idempotent"
  ERRORS=$((ERRORS + 1))
fi
echo ""

if [[ $ERRORS -gt 0 ]]; then
  echo "RESULT: $ERRORS check(s) FAILED."
  exit 1
fi

echo "RESULT: All checks passed. US-0008 ACs AC-0040 through AC-0043 satisfied."
exit 0
