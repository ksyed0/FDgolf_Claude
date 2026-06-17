BEGIN;
SELECT plan(5);

-- Seed one team with one member who has a known company + email (PII).
SELECT tournament_id AS t, team_id AS tm FROM tests.seed_tournament(2) \gset
SELECT tests.add_member(:'t', :'tm', 'Pat Public') AS solo \gset
SELECT tests.add_shot(:'t', :'solo', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'solo', 1, 'sunk',    1, 2);

-- Switch to the anon Data API role (what an unauthenticated visitor uses).
SET LOCAL ROLE anon;

-- (1) anon CAN read team_standings
SELECT isnt(
  (SELECT count(*) FROM team_standings WHERE team_id = :'tm')::int, 0,
  'anon reads team_standings');

-- (2) anon CAN read team_hole_vs_par
SELECT isnt(
  (SELECT count(*) FROM team_hole_vs_par WHERE team_id = :'tm')::int, 0,
  'anon reads team_hole_vs_par');

-- (3) anon CAN read public_team_roster
SELECT isnt(
  (SELECT count(*) FROM public_team_roster WHERE team_id = :'tm')::int, 0,
  'anon reads public_team_roster');

-- (4) anon is DENIED on base players (RLS yields zero rows; no email leaks)
SELECT is(
  (SELECT count(*) FROM players)::int, 0,
  'anon cannot read base players table (RLS denies all rows)');

-- (5) public_team_roster exposes ONLY name + company columns for members
SELECT is(
  (SELECT string_agg(column_name, ',' ORDER BY column_name)
     FROM information_schema.columns
    WHERE table_name = 'public_team_roster'
      AND column_name IN ('email','phone','handicap','title','user_id')),
  NULL,
  'public_team_roster has no PII columns (email/phone/handicap/title/user_id)');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
