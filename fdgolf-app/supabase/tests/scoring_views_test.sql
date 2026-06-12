BEGIN;
SELECT plan(3);

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

SELECT * FROM finish();
ROLLBACK;
