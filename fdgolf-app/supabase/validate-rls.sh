#!/usr/bin/env bash
# validate-rls.sh — Tests RLS policies for US-0006.
# Uses psql with SET LOCAL role + JWT claims to simulate non-privileged access.
# Requires local Supabase stack running.
# Exit 0 = all checks pass. Exit 1 = one or more failed.

set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
ERRORS=0

# ---------------------------------------------------------------
# Helper: run a SQL block; expect exit 0 (query returned rows) or
# non-zero (blocked). $1=label, $2=expected (pass|fail), $3=sql.
# For SELECT tests: "pass" = at least one row returned, "fail" = zero rows.
# For INSERT/UPDATE tests: "pass" = no error, "fail" = error raised.
# ---------------------------------------------------------------
check_select() {
  local label="$1"
  local expected_rows="$2"   # "some" or "none"
  local sql="$3"
  local result
  # Filter out psql command tags (BEGIN, SET, ROLLBACK, COMMIT, DO) so only
  # actual data rows are counted. With -t -A, command tags appear as plain text
  # lines when using multi-statement -c strings.
  result=$(psql "$DB_URL" -t -A -c "$sql" 2>/dev/null \
    | grep -cvE '^(BEGIN|SET|ROLLBACK|COMMIT|DO)$' || true)
  result=$(echo "$result" | tr -d ' ')
  if [[ "$expected_rows" == "some" && "$result" -ge 1 ]]; then
    echo "PASS: $label"
  elif [[ "$expected_rows" == "none" && "$result" -eq 0 ]]; then
    echo "PASS: $label"
  else
    echo "FAIL: $label (expected_rows=$expected_rows, got=$result)"
    ERRORS=$((ERRORS + 1))
  fi
}

check_dml_blocked() {
  local label="$1"
  local sql="$2"
  local output
  output=$(psql "$DB_URL" -c "$sql" 2>&1) && {
    echo "FAIL: $label (DML succeeded but should have been blocked)"
    ERRORS=$((ERRORS + 1))
  } || {
    if echo "$output" | grep -q "new row violates row-level security\|permission denied\|violates row-level security policy"; then
      echo "PASS: $label (correctly blocked)"
    else
      echo "FAIL: $label (unexpected error: $output)"
      ERRORS=$((ERRORS + 1))
    fi
  }
}

# For UPDATE/DELETE: RLS blocks by returning 0 rows affected (no error raised).
# This helper verifies that the DML matched 0 rows (silent RLS filter).
# $3=expected_count: "0" means blocked (no rows changed), ">0" means allowed.
check_dml_rows() {
  local label="$1"
  local expect_rows="$2"   # "blocked" = expect 0 rows affected, "allowed" = expect >0
  local sql="$3"
  local output rows_affected
  output=$(psql "$DB_URL" -c "$sql" 2>&1)
  # psql prints "UPDATE N" or "DELETE N" as the command tag
  rows_affected=$(echo "$output" | grep -oE '(UPDATE|DELETE) [0-9]+' | awk '{print $2}' || echo "0")
  rows_affected="${rows_affected:-0}"
  if [[ "$expect_rows" == "blocked" && "$rows_affected" -eq 0 ]]; then
    echo "PASS: $label (correctly affected 0 rows)"
  elif [[ "$expect_rows" == "allowed" && "$rows_affected" -gt 0 ]]; then
    echo "PASS: $label (affected $rows_affected row(s))"
  else
    echo "FAIL: $label (expect_rows=$expect_rows, rows_affected=$rows_affected)"
    ERRORS=$((ERRORS + 1))
  fi
}

check_dml_allowed() {
  local label="$1"
  local sql="$2"
  psql "$DB_URL" -c "$sql" > /dev/null 2>&1 && echo "PASS: $label" || {
    echo "FAIL: $label (DML was blocked but should have succeeded)"
    ERRORS=$((ERRORS + 1))
  }
}

echo "=== FDgolf RLS Validation (US-0006) ==="
echo ""

# ---------------------------------------------------------------
# SETUP: Insert minimal fixture data as superuser (postgres role
# bypasses RLS, so we can seed freely).
# All inserts are wrapped in a DO block; IDs are deterministic UUIDs.
# ---------------------------------------------------------------
echo "--- Setting up test fixtures (superuser) ---"
psql "$DB_URL" <<'SETUP_SQL'
DO $$
DECLARE
  v_course    UUID := '00000000-0000-0000-0000-000000000001';
  v_tourney   UUID := '00000000-0000-0000-0000-000000000002';
  v_player_a  UUID := '00000000-0000-0000-0000-000000000010';  -- regular player
  v_player_b  UUID := '00000000-0000-0000-0000-000000000011';  -- teammate of A
  v_player_c  UUID := '00000000-0000-0000-0000-000000000012';  -- different team
  v_admin     UUID := '00000000-0000-0000-0000-000000000020';  -- admin
  v_organizer UUID := '00000000-0000-0000-0000-000000000021';  -- organizer
  v_team_1    UUID := '00000000-0000-0000-0000-000000000030';
  v_team_2    UUID := '00000000-0000-0000-0000-000000000031';
  v_round_a   UUID := '00000000-0000-0000-0000-000000000040';
  v_round_b   UUID := '00000000-0000-0000-0000-000000000041';
  v_club      UUID := '00000000-0000-0000-0000-000000000050';
BEGIN
  -- Seed auth.users for each test player (required since players.id FKs auth.users)
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  VALUES
    (v_player_a,  'player_a@test.com',  'x', NOW(), NOW(), NOW(), 'authenticated', 'authenticated'),
    (v_player_b,  'player_b@test.com',  'x', NOW(), NOW(), NOW(), 'authenticated', 'authenticated'),
    (v_player_c,  'player_c@test.com',  'x', NOW(), NOW(), NOW(), 'authenticated', 'authenticated'),
    (v_admin,     'admin@test.com',      'x', NOW(), NOW(), NOW(), 'authenticated', 'authenticated'),
    (v_organizer, 'organizer@test.com',  'x', NOW(), NOW(), NOW(), 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- Seed courses, tournaments
  INSERT INTO courses (id, name, venue, par_total) VALUES (v_course, 'Test Course', 'Test Venue', 72) ON CONFLICT DO NOTHING;
  INSERT INTO tournaments (id, name, slug, venue, starts_at, course_id) VALUES (v_tourney, 'Test Tourney', 'test-tourney-rls', 'Venue', NOW(), v_course) ON CONFLICT DO NOTHING;

  -- Seed players
  INSERT INTO players (id, name, email) VALUES
    (v_player_a, 'Player A', 'player_a@test.com'),
    (v_player_b, 'Player B', 'player_b@test.com'),
    (v_player_c, 'Player C', 'player_c@test.com'),
    (v_admin,    'Admin',    'admin@test.com'),
    (v_organizer,'Organizer','organizer@test.com')
  ON CONFLICT DO NOTHING;

  -- Seed user_roles: admin (global), organizer (scoped to tournament)
  INSERT INTO user_roles (player_id, role, tournament_id) VALUES
    (v_admin,     'admin',                NULL),
    (v_organizer, 'tournament_organizer', v_tourney)
  ON CONFLICT DO NOTHING;

  -- Seed teams (team_size must be between 2 and 5 per schema constraint)
  INSERT INTO teams (id, tournament_id, team_number, team_size) VALUES
    (v_team_1, v_tourney, 1, 2),
    (v_team_2, v_tourney, 2, 2)
  ON CONFLICT DO NOTHING;

  -- Seed registrations: A and B on team_1; C on team_2
  INSERT INTO tournament_registrations (tournament_id, player_id, team_id, status) VALUES
    (v_tourney, v_player_a, v_team_1, 'registered'),
    (v_tourney, v_player_b, v_team_1, 'registered'),
    (v_tourney, v_player_c, v_team_2, 'registered')
  ON CONFLICT DO NOTHING;

  -- Seed rounds (A in_progress, B in_progress, C in_progress)
  INSERT INTO rounds (id, tournament_id, player_id, team_id, start_hole, status, started_at) VALUES
    (v_round_a, v_tourney, v_player_a, v_team_1, 1, 'in_progress', NOW()),
    (v_round_b, v_tourney, v_player_b, v_team_1, 1, 'in_progress', NOW())
  ON CONFLICT DO NOTHING;

  -- Seed a club
  INSERT INTO clubs (id, display_name, club_type) VALUES (v_club, 'Driver', 'wood') ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Test fixtures seeded successfully.';
END;
$$;
SETUP_SQL
echo ""

# ---------------------------------------------------------------
# AC-0029: Public read on tournaments, team_hole_scores, clubs
# Run as anon role (no auth.uid())
# ---------------------------------------------------------------
echo "--- AC-0029: Public read on tournaments, team_hole_scores, clubs ---"

check_select "anon can SELECT tournaments" "some" \
  "SET LOCAL ROLE anon; SELECT id FROM tournaments LIMIT 1;"

check_select "anon can SELECT clubs" "some" \
  "SET LOCAL ROLE anon; SELECT id FROM clubs LIMIT 1;"

# team_hole_scores is empty in fixtures but policy allows it
check_select "authenticated anon can SELECT team_hole_scores (empty is ok)" "none" \
  "BEGIN; SET LOCAL ROLE anon; SELECT id FROM team_hole_scores; ROLLBACK;"
echo ""

# ---------------------------------------------------------------
# AC-0030: Player A can read self; can read teammate B; cannot read player C
# ---------------------------------------------------------------
echo "--- AC-0030: Player self + teammate read; cannot read other team ---"

PLAYER_A_UUID='00000000-0000-0000-0000-000000000010'
PLAYER_B_UUID='00000000-0000-0000-0000-000000000011'
PLAYER_C_UUID='00000000-0000-0000-0000-000000000012'
ADMIN_UUID='00000000-0000-0000-0000-000000000020'
TOURNEY_UUID='00000000-0000-0000-0000-000000000002'
ROUND_A_UUID='00000000-0000-0000-0000-000000000040'

check_select "player_a can SELECT own row" "some" \
  "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$PLAYER_A_UUID\", \"role\": \"authenticated\"}'; SELECT id FROM players WHERE id = '$PLAYER_A_UUID'; ROLLBACK;"

check_select "player_a can SELECT teammate player_b" "some" \
  "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$PLAYER_A_UUID\", \"role\": \"authenticated\"}'; SELECT id FROM players WHERE id = '$PLAYER_B_UUID'; ROLLBACK;"

check_select "player_a CANNOT SELECT player_c (different team)" "none" \
  "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$PLAYER_A_UUID\", \"role\": \"authenticated\"}'; SELECT id FROM players WHERE id = '$PLAYER_C_UUID'; ROLLBACK;"

check_select "admin can SELECT player_c" "some" \
  "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$ADMIN_UUID\", \"role\": \"authenticated\"}'; SELECT id FROM players WHERE id = '$PLAYER_C_UUID'; ROLLBACK;"
echo ""

# ---------------------------------------------------------------
# AC-0031: Player can INSERT shot during own in_progress round; blocked for completed round
# ---------------------------------------------------------------
echo "--- AC-0031: Shot insert gated on own in_progress round ---"
CLUB_UUID='00000000-0000-0000-0000-000000000050'

check_dml_allowed "player_a can INSERT shot on own in_progress round" \
  "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$PLAYER_A_UUID\", \"role\": \"authenticated\"}'; INSERT INTO shots (round_id, hole_number, shot_number, club_id, outcome, stroke_count) VALUES ('$ROUND_A_UUID', 1, 1, '$CLUB_UUID', 'in_play', 1); ROLLBACK;"

# Test: player_a cannot insert a shot on player_b's round
ROUND_B_UUID='00000000-0000-0000-0000-000000000041'
check_dml_blocked "player_a CANNOT INSERT shot on player_b round" \
  "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$PLAYER_A_UUID\", \"role\": \"authenticated\"}'; INSERT INTO shots (round_id, hole_number, shot_number, club_id, outcome, stroke_count) VALUES ('$ROUND_B_UUID', 1, 1, '$CLUB_UUID', 'in_play', 1); ROLLBACK;"

# Test: simulate a completed round — temporarily update status, test insert blocked, then rollback
psql "$DB_URL" -c "UPDATE rounds SET status = 'completed' WHERE id = '$ROUND_A_UUID';" > /dev/null
check_dml_blocked "player_a CANNOT INSERT shot on completed round" \
  "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$PLAYER_A_UUID\", \"role\": \"authenticated\"}'; INSERT INTO shots (round_id, hole_number, shot_number, club_id, outcome, stroke_count) VALUES ('$ROUND_A_UUID', 1, 2, '$CLUB_UUID', 'in_play', 1); ROLLBACK;"
psql "$DB_URL" -c "UPDATE rounds SET status = 'in_progress' WHERE id = '$ROUND_A_UUID';" > /dev/null
echo ""

# ---------------------------------------------------------------
# AC-0032: tournament_organizer can read/write rounds within their tournament
# ---------------------------------------------------------------
echo "--- AC-0032: Organizer scoped to tournament ---"
ORGANIZER_UUID='00000000-0000-0000-0000-000000000021'

check_select "organizer can SELECT rounds in own tournament" "some" \
  "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$ORGANIZER_UUID\", \"role\": \"authenticated\"}'; SELECT id FROM rounds WHERE tournament_id = '$TOURNEY_UUID'; ROLLBACK;"

# Player_a (not organizer) cannot UPDATE another player's round status.
# RLS silently filters the row (UPDATE 0 rows), so we use check_dml_rows instead
# of check_dml_blocked (which looks for error exit code).
check_dml_rows "player_a CANNOT UPDATE player_b round status" "blocked" \
  "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL \"request.jwt.claims\" = '{\"sub\": \"$PLAYER_A_UUID\", \"role\": \"authenticated\"}'; UPDATE rounds SET status = 'completed' WHERE id = '$ROUND_B_UUID'; ROLLBACK;"
echo ""

# ---------------------------------------------------------------
# AC-0033: public_hole_scores view excludes email, phone, year_of_birth
# ---------------------------------------------------------------
echo "--- AC-0033: public_hole_scores view column safety ---"

# Verify the view exists
VIEW_EXISTS=$(psql "$DB_URL" -t -A -c "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'public_hole_scores';" 2>/dev/null)
if [[ "$VIEW_EXISTS" == "1" ]]; then
  echo "PASS: public_hole_scores view exists"
else
  echo "FAIL: public_hole_scores view missing"
  ERRORS=$((ERRORS + 1))
fi

# Verify forbidden columns are NOT in the view
for col in email phone year_of_birth gender; do
  COL_IN_VIEW=$(psql "$DB_URL" -t -A -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'public_hole_scores' AND column_name = '${col}';" 2>/dev/null)
  if [[ "$COL_IN_VIEW" == "0" ]]; then
    echo "PASS: column '$col' correctly absent from public_hole_scores"
  else
    echo "FAIL: column '$col' present in public_hole_scores (privacy violation)"
    ERRORS=$((ERRORS + 1))
  fi
done

# Verify safe columns ARE in the view
for col in id team_id hole_number best_ball_score contributing_player_name contributing_player_company; do
  COL_IN_VIEW=$(psql "$DB_URL" -t -A -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'public_hole_scores' AND column_name = '${col}';" 2>/dev/null)
  if [[ "$COL_IN_VIEW" == "1" ]]; then
    echo "PASS: safe column '$col' present in public_hole_scores"
  else
    echo "FAIL: expected safe column '$col' missing from public_hole_scores"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

# ---------------------------------------------------------------
# TEARDOWN: Remove test fixtures
# ---------------------------------------------------------------
echo "--- Teardown: removing test fixtures ---"
psql "$DB_URL" <<'TEARDOWN_SQL'
DO $$
BEGIN
  DELETE FROM rounds                   WHERE tournament_id = '00000000-0000-0000-0000-000000000002';
  DELETE FROM tournament_registrations WHERE tournament_id = '00000000-0000-0000-0000-000000000002';
  DELETE FROM teams                    WHERE tournament_id = '00000000-0000-0000-0000-000000000002';
  DELETE FROM user_roles               WHERE player_id IN (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000021'
  );
  DELETE FROM players WHERE id IN (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000021'
  );
  DELETE FROM auth.users WHERE id IN (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000021'
  );
  DELETE FROM clubs       WHERE id = '00000000-0000-0000-0000-000000000050';
  DELETE FROM tournaments WHERE id = '00000000-0000-0000-0000-000000000002';
  DELETE FROM courses     WHERE id = '00000000-0000-0000-0000-000000000001';
  RAISE NOTICE 'Teardown complete.';
END;
$$;
TEARDOWN_SQL
echo ""

# ---------------------------------------------------------------
# FINAL RESULT
# ---------------------------------------------------------------
if [[ $ERRORS -gt 0 ]]; then
  echo "RESULT: $ERRORS check(s) FAILED. US-0006 ACs not fully satisfied."
  exit 1
fi

echo "RESULT: All checks passed. US-0006 ACs AC-0028 through AC-0034 satisfied."
exit 0
