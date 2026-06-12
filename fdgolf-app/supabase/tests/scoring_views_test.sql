BEGIN;
SELECT plan(9);

-- Use team_size=2 minimum; only add one member to test vs-par with a single scorer.
SELECT tournament_id AS t, team_id AS tm FROM tests.seed_tournament(2) \gset
SELECT tests.add_member(:'t', :'tm', 'Solo') AS solo \gset

-- Make hole 1 a par 3 so vs-par is non-trivial; holes 2..18 stay par 4.
SELECT tests.set_hole_par(:'t', 1, 3);

-- Hole 1: gross 4 on a par 3 → +1.   Hole 2: gross 3 on a par 4 → -1.
SELECT tests.add_shot(:'t', :'solo', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'solo', 1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'solo', 1, 'in_play', 1, 3);
SELECT tests.add_shot(:'t', :'solo', 1, 'sunk',    1, 4);
SELECT tests.add_shot(:'t', :'solo', 2, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'solo', 2, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'solo', 2, 'sunk',    1, 3);

SELECT is(
  (SELECT hole_vs_par FROM team_hole_vs_par WHERE team_id = :'tm' AND hole_number = 1),
  1, 'hole 1: gross 4 on par 3 is +1');

SELECT is(
  (SELECT hole_vs_par FROM team_hole_vs_par WHERE team_id = :'tm' AND hole_number = 2),
  -1, 'hole 2: gross 3 on par 4 is -1');

SELECT is(
  (SELECT cumulative_vs_par::int FROM team_hole_vs_par WHERE team_id = :'tm' AND hole_number = 2),
  0, 'cumulative through hole 2 is even (+1 then -1)');

-- Standings: build a second and third team in the same tournament to test ranking + ties.
-- seed_tournament created only team_number 1, so add teams 2 and 3 here.
-- team_size=2 is the minimum allowed by the schema CHECK constraint.
INSERT INTO teams (tournament_id, team_number, team_size) VALUES (:'t', 2, 2) RETURNING id AS tm2 \gset
INSERT INTO teams (tournament_id, team_number, team_size) VALUES (:'t', 3, 2) RETURNING id AS tm3 \gset

SELECT tests.add_member(:'t', :'tm2', 'Two')   AS p2 \gset
SELECT tests.add_member(:'t', :'tm3', 'Three') AS p3 \gset

-- Team 1 (Solo) is at even par thru 2 (from earlier). Team 2: -1 thru 1. Team 3: -1 thru 1 (tie).
SELECT tests.add_shot(:'t', :'p2', 2, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'p2', 2, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'p2', 2, 'sunk',    1, 3);  -- par 4, gross 3 → -1
SELECT tests.add_shot(:'t', :'p3', 2, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'p3', 2, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'p3', 2, 'sunk',    1, 3);  -- par 4, gross 3 → -1

SELECT is(
  (SELECT rank::int FROM team_standings WHERE team_id = :'tm2'),
  1, 'team 2 at -1 ranks 1');

SELECT is(
  (SELECT rank::int FROM team_standings WHERE team_id = :'tm3'),
  1, 'team 3 tied at -1 also ranks 1 (T1, standard competition ranking)');

SELECT is(
  (SELECT rank::int FROM team_standings WHERE team_id = :'tm'),
  3, 'team 1 at even par ranks 3 (tie skips rank 2)');

SELECT is(
  (SELECT total_vs_par::int FROM team_standings WHERE team_id = :'tm'),
  0, 'team 1 total_vs_par is even');

SELECT is(
  (SELECT thru::int FROM team_standings WHERE team_id = :'tm2'),
  1, 'team 2 is thru 1 hole');

-- A team with NO scores still appears (LEFT JOIN), at even par.
INSERT INTO teams (tournament_id, team_number, team_size) VALUES (:'t', 4, 2) RETURNING id AS tm4 \gset
SELECT is(
  (SELECT total_vs_par::int FROM team_standings WHERE team_id = :'tm4'),
  0, 'a team with no scores still appears at even par (all-teams LEFT JOIN)');

SELECT * FROM finish();
ROLLBACK;
