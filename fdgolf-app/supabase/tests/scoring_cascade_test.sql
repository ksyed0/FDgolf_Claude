BEGIN;
SELECT plan(4);

SELECT tournament_id AS t, team_id AS tm FROM tests.seed_tournament(2) \gset
SELECT tests.add_member(:'t', :'tm', 'Alice') AS alice \gset
SELECT tests.add_member(:'t', :'tm', 'Bob')   AS bob   \gset

-- A single shot insert must cascade all the way to team_hole_scores.
SELECT tests.add_shot(:'t', :'alice', 1, 'sunk', 1, 1);  -- Alice gross 1, final
SELECT tests.add_shot(:'t', :'bob',   1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'bob',   1, 'sunk',    1, 2);  -- Bob gross 2, final

SELECT is(
  (SELECT best_ball_score FROM team_hole_scores WHERE team_id = :'tm' AND hole_number = 1),
  1, 'cascade: team_hole_scores best_ball_score is the team minimum (1)');

SELECT is(
  (SELECT contributing_player_id FROM team_hole_scores WHERE team_id = :'tm' AND hole_number = 1),
  :'alice'::uuid, 'cascade: contributing player recorded on team_hole_scores');

SELECT is(
  (SELECT status::text FROM team_hole_scores WHERE team_id = :'tm' AND hole_number = 1),
  'final', 'cascade: team hole final when both members final');

-- Editing Alice down to a worse score re-runs the cascade.
DELETE FROM shots WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 1;
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'alice', 1, 'sunk',    1, 3);  -- Alice now gross 3
SELECT is(
  (SELECT best_ball_score FROM team_hole_scores WHERE team_id = :'tm' AND hole_number = 1),
  2, 'cascade: re-recomputes to Bob (2) after Alice worsens to 3');

SELECT * FROM finish();
ROLLBACK;
