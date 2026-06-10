#!/usr/bin/env bash
# seed-dev.sh — Populate local Supabase with dev fixtures.
#
# Creates 5 users, a tournament, course (Granite Ridge GC), 18 holes,
# 2 teams, and registers all non-admin players.
#
# Usage (from fdgolf-app/):
#   bash scripts/seed-dev.sh
#
# Requires: curl, psql, jq, local Supabase running (npm run supabase:start)

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.local not found at $ENV_FILE" >&2
  exit 1
fi

# Load .env.local (skip comments and blank lines)
while IFS='=' read -r key value; do
  [[ "$key" =~ ^\s*# ]] && continue
  [[ -z "$key" ]] && continue
  export "$key"="$value"
done < <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:54321}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

if [[ -z "$SERVICE_KEY" ]]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY not set in .env.local" >&2
  exit 1
fi

# ── Helpers ──────────────────────────────────────────────────────────────────

create_user() {
  local email="$1" password="$2"
  local response
  response=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${email}\", \"password\": \"${password}\", \"email_confirm\": true}")

  local uid
  uid=$(echo "$response" | jq -r '.id // empty')

  if [[ -z "$uid" ]]; then
    # Already exists — fetch existing user id
    uid=$(curl -s "${SUPABASE_URL}/auth/v1/admin/users?per_page=50" \
      -H "apikey: ${SERVICE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_KEY}" \
      | jq -r --arg email "$email" '.users[] | select(.email == $email) | .id // empty')
  fi

  if [[ -z "$uid" ]]; then
    echo "ERROR: could not create or find user $email" >&2
    exit 1
  fi

  echo "$uid"
}

run_sql() {
  psql "$DB_URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 "$@"
}

# ── Create auth users ────────────────────────────────────────────────────────

echo "→ Creating auth users…"
ADMIN_ID=$(create_user "admin@fdgolf.local"  "Password1!")
ALICE_ID=$(create_user "alice@fdgolf.local"  "Password1!")
JOHN_ID=$(create_user  "john@fdgolf.local"   "Password1!")
BOB_ID=$(create_user   "bob@fdgolf.local"    "Password1!")
JANE_ID=$(create_user  "jane@fdgolf.local"   "Password1!")

echo "   admin → $ADMIN_ID"
echo "   alice → $ALICE_ID"
echo "   john  → $JOHN_ID"
echo "   bob   → $BOB_ID"
echo "   jane  → $JANE_ID"

# ── Seed database ────────────────────────────────────────────────────────────

echo "→ Seeding database…"

run_sql <<SQL
-- ── Players ────────────────────────────────────────────────────────────────
INSERT INTO players (id, name, email) VALUES
  ('$ADMIN_ID', 'Admin',       'admin@fdgolf.local'),
  ('$ALICE_ID', 'Alice',       'alice@fdgolf.local'),
  ('$JOHN_ID',  'John',        'john@fdgolf.local'),
  ('$BOB_ID',   'Bob',         'bob@fdgolf.local'),
  ('$JANE_ID',  'Jane',        'jane@fdgolf.local')
ON CONFLICT (id) DO NOTHING;

-- ── Admin role ─────────────────────────────────────────────────────────────
INSERT INTO user_roles (player_id, role)
VALUES ('$ADMIN_ID', 'admin')
ON CONFLICT DO NOTHING;

-- ── Course ─────────────────────────────────────────────────────────────────
INSERT INTO courses (id, name, venue, par_total)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Granite Ridge GC',
  'Granite Ridge Golf Club',
  72
)
ON CONFLICT DO NOTHING;

-- ── Tournament ─────────────────────────────────────────────────────────────
INSERT INTO tournaments (id, name, slug, venue, starts_at, format, start_style, holes_count, status, course_id, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'CIBC ARC Golf 2026',
  'cibc-granite-ridge-2026',
  'Granite Ridge Golf Club',
  '2026-06-22 09:00:00+00',
  'best_ball',
  'shotgun',
  18,
  'draft',
  '00000000-0000-0000-0000-000000000001',
  '$ADMIN_ID'
)
ON CONFLICT (slug) DO NOTHING;

-- ── Holes (Granite Ridge GC — par 72) ──────────────────────────────────────
-- Front 9: par 36  |  Back 9: par 36
INSERT INTO holes (course_id, number, par, yardage, stroke_index) VALUES
  ('00000000-0000-0000-0000-000000000001',  1, 4, 385,  5),
  ('00000000-0000-0000-0000-000000000001',  2, 5, 510,  1),
  ('00000000-0000-0000-0000-000000000001',  3, 3, 165, 15),
  ('00000000-0000-0000-0000-000000000001',  4, 4, 420,  3),
  ('00000000-0000-0000-0000-000000000001',  5, 4, 355, 11),
  ('00000000-0000-0000-0000-000000000001',  6, 5, 520,  7),
  ('00000000-0000-0000-0000-000000000001',  7, 3, 140, 17),
  ('00000000-0000-0000-0000-000000000001',  8, 4, 395,  9),
  ('00000000-0000-0000-0000-000000000001',  9, 4, 430, 13),
  ('00000000-0000-0000-0000-000000000001', 10, 4, 370,  6),
  ('00000000-0000-0000-0000-000000000001', 11, 4, 405,  2),
  ('00000000-0000-0000-0000-000000000001', 12, 3, 175, 16),
  ('00000000-0000-0000-0000-000000000001', 13, 5, 535,  4),
  ('00000000-0000-0000-0000-000000000001', 14, 4, 345, 12),
  ('00000000-0000-0000-0000-000000000001', 15, 4, 390,  8),
  ('00000000-0000-0000-0000-000000000001', 16, 3, 155, 18),
  ('00000000-0000-0000-0000-000000000001', 17, 5, 495, 10),
  ('00000000-0000-0000-0000-000000000001', 18, 4, 410, 14)
ON CONFLICT (course_id, number) DO NOTHING;

-- ── Teams ──────────────────────────────────────────────────────────────────
INSERT INTO teams (id, tournament_id, team_number, team_size, captain_player_id) VALUES
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 1, 2, '$ALICE_ID'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 2, 2, '$BOB_ID')
ON CONFLICT DO NOTHING;

-- ── Registrations ──────────────────────────────────────────────────────────
INSERT INTO tournament_registrations (tournament_id, player_id, team_id, status) VALUES
  ('00000000-0000-0000-0000-000000000002', '$ALICE_ID', '00000000-0000-0000-0000-000000000003', 'registered'),
  ('00000000-0000-0000-0000-000000000002', '$JOHN_ID',  '00000000-0000-0000-0000-000000000003', 'registered'),
  ('00000000-0000-0000-0000-000000000002', '$BOB_ID',   '00000000-0000-0000-0000-000000000004', 'registered'),
  ('00000000-0000-0000-0000-000000000002', '$JANE_ID',  '00000000-0000-0000-0000-000000000004', 'registered')
ON CONFLICT (tournament_id, player_id) DO NOTHING;
SQL

echo ""
echo "✓ Dev seed complete."
echo ""
echo "  Email                 Password    Access"
echo "  ───────────────────── ─────────── ────────────────────────────────────"
echo "  admin@fdgolf.local    Password1!  Admin dashboard (/admin)"
echo "  alice@fdgolf.local    Password1!  Team Alpha captain → round scoring"
echo "  john@fdgolf.local     Password1!  Team Alpha player"
echo "  bob@fdgolf.local      Password1!  Team Bravo captain"
echo "  jane@fdgolf.local     Password1!  Team Bravo player"
echo ""
echo "  Tournament: http://localhost:3000/admin/tournaments/cibc-granite-ridge-2026"
