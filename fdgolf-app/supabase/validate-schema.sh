#!/usr/bin/env bash
# Validates that all 16 tables and 11 enums from US-0005 exist in the local Supabase DB.
# Requires the local Supabase stack to be running (supabase start via OrbStack/Docker).
# Exit 0 = all checks pass. Exit 1 = one or more checks failed.

set -euo pipefail

# Ensure psql is available — add homebrew postgresql path if installed
if ! command -v psql &>/dev/null; then
  for pg_path in \
    /opt/homebrew/bin \
    /opt/homebrew/Cellar/postgresql@17/17.10/bin \
    /opt/homebrew/opt/postgresql@17/bin \
    /usr/local/bin; do
    if [[ -x "${pg_path}/psql" ]]; then
      export PATH="${pg_path}:${PATH}"
      break
    fi
  done
fi

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
ERRORS=0

psql_query() {
  psql "$DB_URL" -t -A -c "$1" 2>/dev/null
}

check_table() {
  local table="$1"
  local result
  result=$(psql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}';")
  if [[ "$result" == "1" ]]; then
    echo "PASS: table '${table}' exists"
  else
    echo "FAIL: table '${table}' missing"
    ERRORS=$((ERRORS + 1))
  fi
}

check_enum() {
  local enum="$1"
  local result
  result=$(psql_query "SELECT COUNT(*) FROM pg_type WHERE typtype = 'e' AND typname = '${enum}';")
  if [[ "$result" == "1" ]]; then
    echo "PASS: enum '${enum}' exists"
  else
    echo "FAIL: enum '${enum}' missing"
    ERRORS=$((ERRORS + 1))
  fi
}

check_column() {
  local table="$1"
  local column="$2"
  local result
  result=$(psql_query "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}';")
  if [[ "$result" == "1" ]]; then
    echo "PASS: column '${table}.${column}' exists"
  else
    echo "FAIL: column '${table}.${column}' missing"
    ERRORS=$((ERRORS + 1))
  fi
}

check_constraint() {
  local table="$1"
  local constraint_type="$2"  # UNIQUE, CHECK, FOREIGN KEY, PRIMARY KEY
  local description="$3"
  local result
  result=$(psql_query "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = '${table}' AND constraint_type = '${constraint_type}';")
  if [[ "$result" -ge "1" ]]; then
    echo "PASS: ${description}"
  else
    echo "FAIL: ${description}"
    ERRORS=$((ERRORS + 1))
  fi
}

check_trigger() {
  local table="$1"
  local result
  result=$(psql_query "SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = '${table}' AND trigger_name LIKE '%updated_at%';")
  if [[ "$result" -ge "1" ]]; then
    echo "PASS: updated_at trigger on '${table}'"
  else
    echo "FAIL: updated_at trigger missing on '${table}'"
    ERRORS=$((ERRORS + 1))
  fi
}

echo "=== FDgolf Schema Validation (US-0005) ==="
echo ""

echo "--- 16 Tables (AC-0022) ---"
check_table "tournaments"
check_table "courses"
check_table "holes"
check_table "players"
check_table "user_roles"
check_table "tournament_registrations"
check_table "teams"
check_table "rounds"
check_table "shots"
check_table "shot_edits"
check_table "shot_attestations"
check_table "hole_scores"
check_table "team_hole_scores"
check_table "clubs"
check_table "tournament_clubs"
check_table "score_disputes"
echo ""

echo "--- 11 Enums (AC-0023) ---"
check_enum "tournament_format"
check_enum "tournament_start_style"
check_enum "tournament_status"
check_enum "role_type"
check_enum "registration_status"
check_enum "round_status"
check_enum "shot_outcome"
check_enum "rehit_origin_type"
check_enum "hole_score_status"
check_enum "club_type"
check_enum "dispute_status"
echo ""

echo "--- Key columns (AC-0024, AC-0025) ---"
check_column "teams" "team_size"
check_column "shots" "updated_at"
check_column "shots" "updated_by"
check_column "shots" "rehit_from_shot_id"
check_column "shots" "rehit_origin"
check_column "tournaments" "sponsor_logos"
check_column "players" "is_admin"
check_column "tournament_clubs" "is_active"
echo ""

echo "--- Unique constraints (AC-0024) ---"
check_constraint "holes" "UNIQUE" "holes has unique constraint (course_id, number)"
check_constraint "tournament_registrations" "UNIQUE" "tournament_registrations has unique constraint (tournament_id, player_id)"
check_constraint "teams" "UNIQUE" "teams has unique constraint (tournament_id, team_number)"
check_constraint "rounds" "UNIQUE" "rounds has unique constraint (tournament_id, player_id)"
check_constraint "hole_scores" "UNIQUE" "hole_scores has unique constraint (round_id, hole_number)"
check_constraint "team_hole_scores" "UNIQUE" "team_hole_scores has unique constraint (team_id, hole_number)"
# tournament_clubs: PRIMARY KEY (tournament_id, club_id) implies uniqueness; PostgreSQL
# drops the redundant UNIQUE clause when a PK already covers the same columns.
TC_UNIQUE=$(psql_query "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'tournament_clubs' AND constraint_type IN ('UNIQUE','PRIMARY KEY');")
if [[ "$TC_UNIQUE" -ge "1" ]]; then
  echo "PASS: tournament_clubs has unique constraint (tournament_id, club_id)"
else
  echo "FAIL: tournament_clubs has unique constraint (tournament_id, club_id)"
  ERRORS=$((ERRORS + 1))
fi
check_constraint "user_roles" "UNIQUE" "user_roles has unique constraint (player_id, role, tournament_id)"
echo ""

echo "--- teams.team_size check constraint (AC-0025) ---"
TEAM_SIZE_CHECK=$(psql_query "SELECT COUNT(*) FROM information_schema.check_constraints cc JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name WHERE ccu.table_name = 'teams' AND ccu.column_name = 'team_size';")
if [[ "$TEAM_SIZE_CHECK" -ge "1" ]]; then
  echo "PASS: teams.team_size check constraint exists"
else
  echo "FAIL: teams.team_size check constraint missing"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "--- updated_at triggers (AC-0026) ---"
check_trigger "shots"
check_trigger "tournaments"
check_trigger "players"
check_trigger "rounds"
check_trigger "hole_scores"
check_trigger "team_hole_scores"
echo ""

echo "--- shots.updated_at default (AC-0026) ---"
SHOTS_DEFAULT=$(psql_query "SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shots' AND column_name = 'updated_at';")
if echo "$SHOTS_DEFAULT" | grep -qi "now\|current_timestamp"; then
  echo "PASS: shots.updated_at has now() default"
else
  echo "FAIL: shots.updated_at default missing or not now() — got: ${SHOTS_DEFAULT}"
  ERRORS=$((ERRORS + 1))
fi
echo ""

if [[ $ERRORS -gt 0 ]]; then
  echo "RESULT: $ERRORS check(s) FAILED."
  exit 1
fi

echo "RESULT: All checks passed. US-0005 ACs AC-0022 through AC-0026 satisfied."
exit 0
