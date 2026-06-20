#!/usr/bin/env bash
# Seeds 16 players + Lionhead Golf & Country Club tournament for testing.
# Idempotent — safe to re-run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.local not found at $ENV_FILE" >&2; exit 1
fi

while IFS='=' read -r key value; do
  [[ "$key" =~ ^\s*# ]] && continue
  [[ -z "$key" ]] && continue
  export "$key"="${value}"
done < <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:54321}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

create_user() {
  local email="$1" password="$2"
  local response uid
  response=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\",\"email_confirm\":true}")
  uid=$(echo "$response" | jq -r '.id // empty')
  if [[ -z "$uid" ]]; then
    uid=$(curl -s "${SUPABASE_URL}/auth/v1/admin/users?per_page=200" \
      -H "apikey: ${SERVICE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_KEY}" \
      | jq -r --arg e "$email" '.users[] | select(.email==$e) | .id // empty')
  fi
  [[ -z "$uid" ]] && { echo "ERROR: could not create or find user $email" >&2; exit 1; }
  echo "$uid"
}

run_sql() { psql "$DB_URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 "$@"; }

echo "→ Creating auth users…"
ADMIN_ID=$(create_user  "ksyed0+admin@gmail.com"          "GolfAdmin1!")
JAMES_ID=$(create_user  "ksyed0+jameswilson@gmail.com"    "GolfTest1!")
SARAH_ID=$(create_user  "ksyed0+sarahchen@gmail.com"      "GolfTest1!")
MIKE_ID=$(create_user   "ksyed0+michaelbrown@gmail.com"   "GolfTest1!")
EMILY_ID=$(create_user  "ksyed0+emilypark@gmail.com"      "GolfTest1!")
DAVID_ID=$(create_user  "ksyed0+davidlee@gmail.com"       "GolfTest1!")
JESS_ID=$(create_user   "ksyed0+jessicataylor@gmail.com"  "GolfTest1!")
CHRIS_ID=$(create_user  "ksyed0+chrismartin@gmail.com"    "GolfTest1!")
LAURA_ID=$(create_user  "ksyed0+lauradavis@gmail.com"     "GolfTest1!")
KEVIN_ID=$(create_user  "ksyed0+kevinmiller@gmail.com"    "GolfTest1!")
AMANDA_ID=$(create_user "ksyed0+amandawhite@gmail.com"    "GolfTest1!")
ROBERT_ID=$(create_user "ksyed0+robertjones@gmail.com"    "GolfTest1!")
STEPH_ID=$(create_user  "ksyed0+stephaniekim@gmail.com"   "GolfTest1!")
THOMAS_ID=$(create_user "ksyed0+thomasgarcia@gmail.com"   "GolfTest1!")
RACHEL_ID=$(create_user "ksyed0+rachelmoor@gmail.com"     "GolfTest1!")
BRIAN_ID=$(create_user  "ksyed0+brianclark@gmail.com"     "GolfTest1!")
NATALIA_ID=$(create_user "ksyed0+natalialopez@gmail.com"  "GolfTest1!")

echo "→ Seeding database…"
run_sql <<SQL
-- Players
INSERT INTO players (user_id, email, full_name) VALUES
  ('$ADMIN_ID',  'ksyed0+admin@gmail.com',          'Admin'),
  ('$JAMES_ID',  'ksyed0+jameswilson@gmail.com',    'James Wilson'),
  ('$SARAH_ID',  'ksyed0+sarahchen@gmail.com',      'Sarah Chen'),
  ('$MIKE_ID',   'ksyed0+michaelbrown@gmail.com',   'Michael Brown'),
  ('$EMILY_ID',  'ksyed0+emilypark@gmail.com',      'Emily Park'),
  ('$DAVID_ID',  'ksyed0+davidlee@gmail.com',       'David Lee'),
  ('$JESS_ID',   'ksyed0+jessicataylor@gmail.com',  'Jessica Taylor'),
  ('$CHRIS_ID',  'ksyed0+chrismartin@gmail.com',    'Chris Martin'),
  ('$LAURA_ID',  'ksyed0+lauradavis@gmail.com',     'Laura Davis'),
  ('$KEVIN_ID',  'ksyed0+kevinmiller@gmail.com',    'Kevin Miller'),
  ('$AMANDA_ID', 'ksyed0+amandawhite@gmail.com',    'Amanda White'),
  ('$ROBERT_ID', 'ksyed0+robertjones@gmail.com',    'Robert Jones'),
  ('$STEPH_ID',  'ksyed0+stephaniekim@gmail.com',   'Stephanie Kim'),
  ('$THOMAS_ID', 'ksyed0+thomasgarcia@gmail.com',   'Thomas Garcia'),
  ('$RACHEL_ID', 'ksyed0+rachelmoor@gmail.com',     'Rachel Moore'),
  ('$BRIAN_ID',  'ksyed0+brianclark@gmail.com',     'Brian Clark'),
  ('$NATALIA_ID','ksyed0+natalialopez@gmail.com',   'Natalia Lopez')
ON CONFLICT (email) DO NOTHING;

-- Resolve player UUIDs (random, not auth UUIDs)
DO \$\$
DECLARE
  v_admin  UUID := (SELECT id FROM players WHERE email='ksyed0+admin@gmail.com');
  v_james  UUID := (SELECT id FROM players WHERE email='ksyed0+jameswilson@gmail.com');
  v_sarah  UUID := (SELECT id FROM players WHERE email='ksyed0+sarahchen@gmail.com');
  v_mike   UUID := (SELECT id FROM players WHERE email='ksyed0+michaelbrown@gmail.com');
  v_emily  UUID := (SELECT id FROM players WHERE email='ksyed0+emilypark@gmail.com');
  v_david  UUID := (SELECT id FROM players WHERE email='ksyed0+davidlee@gmail.com');
  v_jess   UUID := (SELECT id FROM players WHERE email='ksyed0+jessicataylor@gmail.com');
  v_chris  UUID := (SELECT id FROM players WHERE email='ksyed0+chrismartin@gmail.com');
  v_laura  UUID := (SELECT id FROM players WHERE email='ksyed0+lauradavis@gmail.com');
  v_kevin  UUID := (SELECT id FROM players WHERE email='ksyed0+kevinmiller@gmail.com');
  v_amanda UUID := (SELECT id FROM players WHERE email='ksyed0+amandawhite@gmail.com');
  v_robert UUID := (SELECT id FROM players WHERE email='ksyed0+robertjones@gmail.com');
  v_steph  UUID := (SELECT id FROM players WHERE email='ksyed0+stephaniekim@gmail.com');
  v_thomas UUID := (SELECT id FROM players WHERE email='ksyed0+thomasgarcia@gmail.com');
  v_rachel UUID := (SELECT id FROM players WHERE email='ksyed0+rachelmoor@gmail.com');
  v_brian  UUID := (SELECT id FROM players WHERE email='ksyed0+brianclark@gmail.com');
  v_natalia UUID := (SELECT id FROM players WHERE email='ksyed0+natalialopez@gmail.com');
  v_venue  UUID;
  v_course UUID;
  v_tourn  UUID;
  v_t1 UUID; v_t2 UUID; v_t3 UUID; v_t4 UUID;
BEGIN

-- Roles
INSERT INTO user_roles (user_id, role) VALUES ('$ADMIN_ID', 'admin') ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role) VALUES ('$JAMES_ID', 'organizer') ON CONFLICT DO NOTHING;

-- Venue
INSERT INTO venues (id, name, address1, city, state_province, zip_postal)
VALUES ('a0000000-0000-0000-0000-000000000001',
        'Lionhead Golf & Country Club',
        '8525 Mississauga Rd', 'Brampton', 'ON', 'L6Y 0C1')
ON CONFLICT (id) DO NOTHING;
v_venue := 'a0000000-0000-0000-0000-000000000001';

-- Course
INSERT INTO courses (id, name, venue_id)
VALUES ('a0000000-0000-0000-0000-000000000002', 'Lionhead Links Course', v_venue)
ON CONFLICT (id) DO NOTHING;
v_course := 'a0000000-0000-0000-0000-000000000002';

-- Holes (18 holes using canonical schema: handicap, tees JSONB, pin_lat, pin_lng)
INSERT INTO holes (course_id, number, par, handicap, pin_lat, pin_lng, tees) VALUES
  (v_course,  1, 4,  7, 43.6823, -79.8901, '[{"colour":"Blue","yardage":398},{"colour":"White","yardage":376},{"colour":"Red","yardage":342}]'),
  (v_course,  2, 5,  1, 43.6858, -79.8862, '[{"colour":"Blue","yardage":521},{"colour":"White","yardage":498},{"colour":"Red","yardage":460}]'),
  (v_course,  3, 3, 15, 43.6875, -79.8841, '[{"colour":"Blue","yardage":168},{"colour":"White","yardage":150},{"colour":"Red","yardage":125}]'),
  (v_course,  4, 4,  5, 43.6903, -79.8808, '[{"colour":"Blue","yardage":412},{"colour":"White","yardage":390},{"colour":"Red","yardage":355}]'),
  (v_course,  5, 5,  3, 43.6942, -79.8770, '[{"colour":"Blue","yardage":538},{"colour":"White","yardage":512},{"colour":"Red","yardage":476}]'),
  (v_course,  6, 4, 11, 43.6966, -79.8741, '[{"colour":"Blue","yardage":386},{"colour":"White","yardage":365},{"colour":"Red","yardage":330}]'),
  (v_course,  7, 3, 17, 43.6980, -79.8722, '[{"colour":"Blue","yardage":152},{"colour":"White","yardage":138},{"colour":"Red","yardage":110}]'),
  (v_course,  8, 4,  9, 43.7006, -79.8690, '[{"colour":"Blue","yardage":405},{"colour":"White","yardage":383},{"colour":"Red","yardage":348}]'),
  (v_course,  9, 4, 13, 43.7033, -79.8658, '[{"colour":"Blue","yardage":423},{"colour":"White","yardage":400},{"colour":"Red","yardage":365}]'),
  (v_course, 10, 4,  8, 43.7055, -79.8630, '[{"colour":"Blue","yardage":371},{"colour":"White","yardage":350},{"colour":"Red","yardage":318}]'),
  (v_course, 11, 5,  2, 43.7090, -79.8590, '[{"colour":"Blue","yardage":512},{"colour":"White","yardage":488},{"colour":"Red","yardage":450}]'),
  (v_course, 12, 3, 16, 43.7105, -79.8570, '[{"colour":"Blue","yardage":178},{"colour":"White","yardage":160},{"colour":"Red","yardage":132}]'),
  (v_course, 13, 4,  4, 43.7132, -79.8537, '[{"colour":"Blue","yardage":431},{"colour":"White","yardage":408},{"colour":"Red","yardage":372}]'),
  (v_course, 14, 4, 12, 43.7156, -79.8508, '[{"colour":"Blue","yardage":368},{"colour":"White","yardage":348},{"colour":"Red","yardage":315}]'),
  (v_course, 15, 5,  6, 43.7191, -79.8468, '[{"colour":"Blue","yardage":528},{"colour":"White","yardage":503},{"colour":"Red","yardage":465}]'),
  (v_course, 16, 4, 10, 43.7215, -79.8438, '[{"colour":"Blue","yardage":389},{"colour":"White","yardage":368},{"colour":"Red","yardage":334}]'),
  (v_course, 17, 3, 18, 43.7229, -79.8419, '[{"colour":"Blue","yardage":161},{"colour":"White","yardage":145},{"colour":"Red","yardage":118}]'),
  (v_course, 18, 4, 14, 43.7255, -79.8385, '[{"colour":"Blue","yardage":415},{"colour":"White","yardage":393},{"colour":"Red","yardage":358}]')
ON CONFLICT (course_id, number) DO NOTHING;

-- Tournament
INSERT INTO tournaments (id, name, slug, status, format, start_style, holes_count, starts_at, course_id, venue_id, sponsor_logos)
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'CIBC ARC Lionhead 2026',
  'cibc-lionhead-2026',
  'active', 'best_ball', 'shotgun', 18,
  '2026-06-22 09:00:00+00',
  v_course, v_venue,
  '[{"name":"CIBC","slug":"cibc","url":"/sponsors/cibc.svg"},{"name":"First Derivative","slug":"firstderivative","url":"/sponsors/firstderivative.svg"},{"name":"AI/RUN","slug":"airun","url":"/sponsors/airun.svg"}]'::jsonb
) ON CONFLICT (slug) DO NOTHING;
v_tourn := 'a0000000-0000-0000-0000-000000000003';

-- Teams
INSERT INTO teams (id, tournament_id, name, join_code, captain_player_id, start_hole) VALUES
  ('a0000000-0000-0000-0000-000000000010', v_tourn, 'Fairway Falcons', 'FALC01', v_james, 1),
  ('a0000000-0000-0000-0000-000000000011', v_tourn, 'Iron Eagles',     'IRON02', v_david, 5),
  ('a0000000-0000-0000-0000-000000000012', v_tourn, 'Birdie Brigade',  'BIRD03', v_kevin, 10),
  ('a0000000-0000-0000-0000-000000000013', v_tourn, 'Eagle Chasers',   'EAGL04', v_thomas, 14)
ON CONFLICT DO NOTHING;
v_t1 := 'a0000000-0000-0000-0000-000000000010';
v_t2 := 'a0000000-0000-0000-0000-000000000011';
v_t3 := 'a0000000-0000-0000-0000-000000000012';
v_t4 := 'a0000000-0000-0000-0000-000000000013';

-- Team members
INSERT INTO team_members (team_id, player_id) VALUES
  (v_t1, v_james), (v_t1, v_sarah), (v_t1, v_mike),  (v_t1, v_emily),
  (v_t2, v_david), (v_t2, v_jess),  (v_t2, v_chris), (v_t2, v_laura),
  (v_t3, v_kevin), (v_t3, v_amanda),(v_t3, v_robert),(v_t3, v_steph),
  (v_t4, v_thomas),(v_t4, v_rachel),(v_t4, v_brian), (v_t4, v_natalia)
ON CONFLICT DO NOTHING;

-- Registrations
INSERT INTO tournament_registrations (tournament_id, player_id, status) VALUES
  (v_tourn, v_james, 'registered'), (v_tourn, v_sarah, 'registered'),
  (v_tourn, v_mike,  'registered'), (v_tourn, v_emily, 'registered'),
  (v_tourn, v_david, 'registered'), (v_tourn, v_jess,  'registered'),
  (v_tourn, v_chris, 'registered'), (v_tourn, v_laura, 'registered'),
  (v_tourn, v_kevin, 'registered'), (v_tourn, v_amanda,'registered'),
  (v_tourn, v_robert,'registered'), (v_tourn, v_steph, 'registered'),
  (v_tourn, v_thomas,'registered'), (v_tourn, v_rachel,'registered'),
  (v_tourn, v_brian, 'registered'), (v_tourn, v_natalia,'registered')
ON CONFLICT (tournament_id, player_id) DO NOTHING;

-- tournament_clubs: all 15 clubs active (explicit, per BUG-0002 fix)
INSERT INTO tournament_clubs (tournament_id, club_id, is_active)
SELECT v_tourn, id, true FROM clubs
ON CONFLICT DO NOTHING;

END \$\$;
SQL

echo ""
echo "✓ Lionhead seed complete."
echo ""
echo "  Email                              Password     Team"
echo "  ──────────────────────────────── ──────────── ───────────────────────"
echo "  ksyed0+admin@gmail.com           GolfAdmin1!  Admin"
echo "  ksyed0+jameswilson@gmail.com     GolfTest1!   Fairway Falcons (hole 1)"
echo "  ksyed0+davidlee@gmail.com        GolfTest1!   Iron Eagles (hole 5)"
echo "  ksyed0+kevinmiller@gmail.com     GolfTest1!   Birdie Brigade (hole 10)"
echo "  ksyed0+thomasgarcia@gmail.com    GolfTest1!   Eagle Chasers (hole 14)"
echo "  (12 more players, all GolfTest1!)"
echo ""
echo "  Tournament: http://localhost:3000/admin/tournaments/cibc-lionhead-2026"
echo "  Leaderboard: http://localhost:3000/t/cibc-lionhead-2026/leaderboard"
