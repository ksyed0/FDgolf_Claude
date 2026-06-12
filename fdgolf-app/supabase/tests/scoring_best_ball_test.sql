BEGIN;
SELECT plan(6);

SELECT tournament_id AS t, team_id AS tm FROM tests.seed_tournament(3) \gset
SELECT tests.add_member(:'t', :'tm', 'Alice') AS alice \gset
SELECT tests.add_member(:'t', :'tm', 'Bob')   AS bob   \gset
SELECT tests.add_member(:'t', :'tm', 'Cara')  AS cara  \gset

-- Hole 1: Alice gross 5 (final, sunk), Bob gross 4 (final, sunk), Cara gross 6 (final, sunk).
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 3);
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 4);
SELECT tests.add_shot(:'t', :'alice', 1, 'sunk',    1, 5);
SELECT tests.add_shot(:'t', :'bob',   1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'bob',   1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'bob',   1, 'in_play', 1, 3);
SELECT tests.add_shot(:'t', :'bob',   1, 'sunk',    1, 4);
SELECT tests.add_shot(:'t', :'cara',  1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'cara',  1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'cara',  1, 'in_play', 1, 3);
SELECT tests.add_shot(:'t', :'cara',  1, 'in_play', 1, 4);
SELECT tests.add_shot(:'t', :'cara',  1, 'in_play', 1, 5);
SELECT tests.add_shot(:'t', :'cara',  1, 'sunk',    1, 6);

SELECT is(
  (SELECT best_score FROM calc_best_ball_for_hole(:'tm', 1)),
  4, 'best ball picks the minimum gross (Bob, 4)');

SELECT is(
  (SELECT contributing_player_id FROM calc_best_ball_for_hole(:'tm', 1)),
  :'bob'::uuid, 'contributing player is the holder of the minimum');

SELECT is(
  (SELECT status::text FROM calc_best_ball_for_hole(:'tm', 1)),
  'final', 'team hole is final when all active members are final');

-- Hole 2: Alice provisional 3, Bob not played → team provisional.
SELECT tests.add_shot(:'t', :'alice', 2, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'alice', 2, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'alice', 2, 'in_play', 1, 3);
SELECT is(
  (SELECT status::text FROM calc_best_ball_for_hole(:'tm', 2)),
  'provisional', 'team hole is provisional until every active member is final');

-- Withdrawn member: Dora withdraws but had the lowest score → excluded from best ball.
SELECT tests.add_member(:'t', :'tm', 'Dora', true) AS dora \gset
SELECT tests.add_shot(:'t', :'dora', 1, 'sunk', 1, 1);  -- gross 1, but withdrawn
SELECT is(
  (SELECT best_score FROM calc_best_ball_for_hole(:'tm', 1)),
  4, 'withdrawn members are excluded from best ball even with a lower score');

-- Tie-break: hole 3 Alice and Bob both gross 4.
-- Bob holes out first (shots inserted first with a sleep gap → earlier updated_at).
-- Force Bob's updated_at earlier so the tie-break is deterministic.
SELECT tests.add_shot(:'t', :'bob',   3, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'bob',   3, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'bob',   3, 'in_play', 1, 3);
SELECT tests.add_shot(:'t', :'bob',   3, 'sunk',    1, 4);
-- Backdate Bob's hole_score so it is strictly earlier than Alice's (tie-break test).
UPDATE hole_scores
   SET updated_at = now() - INTERVAL '1 second'
 WHERE round_id = tests.round_of(:'t', :'bob') AND hole_number = 3;
SELECT tests.add_shot(:'t', :'alice', 3, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'alice', 3, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'alice', 3, 'in_play', 1, 3);
SELECT tests.add_shot(:'t', :'alice', 3, 'sunk',    1, 4);
SELECT is(
  (SELECT contributing_player_id FROM calc_best_ball_for_hole(:'tm', 3)),
  :'bob'::uuid, 'tie-break awards the badge to the earlier-finalized member (Bob)');

SELECT * FROM finish();
ROLLBACK;
