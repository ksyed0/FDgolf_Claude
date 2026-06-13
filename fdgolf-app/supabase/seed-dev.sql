-- Dev seed: test users + master data for EPIC-0003 manual testing
-- Run via: npm run db:reset

-- ── Auth users (Supabase auth.users) ──────────────────────────────────
-- Admin user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@fdgolf.dev',
  crypt('Admin1234!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}'
) ON CONFLICT (id) DO NOTHING;

-- Player 1
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'alice@example.com',
  crypt('Player123!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}'
) ON CONFLICT (id) DO NOTHING;

-- Player 2
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'bob@example.com',
  crypt('Player123!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}'
) ON CONFLICT (id) DO NOTHING;

-- ── Admin role ─────────────────────────────────────────────────────────
INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin')
ON CONFLICT DO NOTHING;

-- ── Players table ──────────────────────────────────────────────────────
INSERT INTO players (id, user_id, email, full_name, phone, handicap, company, title)
VALUES
  ('p0000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'alice@example.com', 'Alice Smith', '416-555-0001', 12.5, 'Acme Corp', 'VP Sales'),
  ('p0000001-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
   'bob@example.com', 'Bob Jones', '416-555-0002', 8.0, 'Acme Corp', 'Director'),
  ('p0000001-0000-0000-0000-000000000003', NULL,
   'charlie@example.com', 'Charlie Brown', NULL, 18.0, 'TechCo', 'Engineer')
ON CONFLICT (email) DO NOTHING;

-- ── Sample tournament (registration_open) ─────────────────────────────
-- BUG-0017/0018: tournaments has no club_id column (clubs are linked via the
-- tournament_clubs many-to-many table, US-0015). The stale club_id reference
-- was removed here rather than adding an unused column no app code writes.
INSERT INTO tournaments (id, name, slug, status)
VALUES (
  '00000000-0000-0000-0000-000000000099',
  'CIBC ARC Golf 2026 (Dev)',
  'cibc-arc-2026-dev',
  'registration_open'
)
ON CONFLICT (slug) DO NOTHING;

-- ── Sample team + members ──────────────────────────────────────────────
INSERT INTO teams (id, tournament_id, name, captain_player_id, join_code)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000099',
  'Eagles',
  'p0000001-0000-0000-0000-000000000001',
  'EAGL01'
) ON CONFLICT DO NOTHING;

INSERT INTO team_members (team_id, player_id)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'p0000001-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000010', 'p0000001-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO tournament_registrations (tournament_id, player_id, status, registered_at)
VALUES
  ('00000000-0000-0000-0000-000000000099', 'p0000001-0000-0000-0000-000000000001', 'registered', now()),
  ('00000000-0000-0000-0000-000000000099', 'p0000001-0000-0000-0000-000000000002', 'registered', now()),
  ('00000000-0000-0000-0000-000000000099', 'p0000001-0000-0000-0000-000000000003', 'invited', NULL)
ON CONFLICT DO NOTHING;
