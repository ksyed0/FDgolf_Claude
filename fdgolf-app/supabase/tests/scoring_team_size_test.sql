BEGIN;
SELECT plan(4);

-- For each team size 2..5, the team hole is final only when ALL members are final,
-- and best_ball is the minimum across exactly that many members. Each size is an
-- explicit block (not a loop) so the TAP output names the failing size directly.

-- Size 2
SELECT tournament_id AS t2, team_id AS tm2 FROM tests.seed_tournament(2) \gset
SELECT tests.add_member(:'t2', :'tm2', 'A2') AS a2 \gset
SELECT tests.add_member(:'t2', :'tm2', 'B2') AS b2 \gset
SELECT tests.add_shot(:'t2', :'a2', 1, 'sunk', 1, 1);          -- gross 1 final
SELECT tests.add_shot(:'t2', :'b2', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t2', :'b2', 1, 'sunk',    1, 2);       -- gross 2 final
SELECT is(
  (SELECT best_ball_score || ':' || status::text
     FROM team_hole_scores WHERE team_id = :'tm2' AND hole_number = 1),
  '1:final', 'size 2: min 1, final when both members final');

-- Size 3 (one member still provisional → team provisional)
SELECT tournament_id AS t3, team_id AS tm3 FROM tests.seed_tournament(3) \gset
SELECT tests.add_member(:'t3', :'tm3', 'A3') AS a3 \gset
SELECT tests.add_member(:'t3', :'tm3', 'B3') AS b3 \gset
SELECT tests.add_member(:'t3', :'tm3', 'C3') AS c3 \gset
SELECT tests.add_shot(:'t3', :'a3', 1, 'sunk', 1, 1);          -- final
SELECT tests.add_shot(:'t3', :'b3', 1, 'sunk', 1, 1);          -- final
SELECT tests.add_shot(:'t3', :'c3', 1, 'in_play', 1, 1);       -- provisional (no sunk)
SELECT is(
  (SELECT status::text FROM team_hole_scores WHERE team_id = :'tm3' AND hole_number = 1),
  'provisional', 'size 3: team provisional while one member is unfinished');

-- Size 4
SELECT tournament_id AS t4, team_id AS tm4 FROM tests.seed_tournament(4) \gset
SELECT tests.add_member(:'t4', :'tm4', 'A4') AS a4 \gset
SELECT tests.add_member(:'t4', :'tm4', 'B4') AS b4 \gset
SELECT tests.add_member(:'t4', :'tm4', 'C4') AS c4 \gset
SELECT tests.add_member(:'t4', :'tm4', 'D4') AS d4 \gset
SELECT tests.add_shot(:'t4', :'a4', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t4', :'a4', 1, 'sunk',    1, 2);       -- gross 2
SELECT tests.add_shot(:'t4', :'b4', 1, 'sunk', 1, 1);          -- gross 1 (best)
SELECT tests.add_shot(:'t4', :'c4', 1, 'sunk', 1, 1);          -- gross 1
SELECT tests.add_shot(:'t4', :'d4', 1, 'sunk', 1, 1);          -- gross 1
SELECT is(
  (SELECT best_ball_score FROM team_hole_scores WHERE team_id = :'tm4' AND hole_number = 1),
  1, 'size 4: best ball is the minimum across all four (1)');

-- Size 5
SELECT tournament_id AS t5, team_id AS tm5 FROM tests.seed_tournament(5) \gset
SELECT tests.add_member(:'t5', :'tm5', 'A5') AS a5 \gset
SELECT tests.add_member(:'t5', :'tm5', 'B5') AS b5 \gset
SELECT tests.add_member(:'t5', :'tm5', 'C5') AS c5 \gset
SELECT tests.add_member(:'t5', :'tm5', 'D5') AS d5 \gset
SELECT tests.add_member(:'t5', :'tm5', 'E5') AS e5 \gset
SELECT tests.add_shot(:'t5', :'a5', 1, 'sunk', 1, 1);
SELECT tests.add_shot(:'t5', :'b5', 1, 'sunk', 1, 1);
SELECT tests.add_shot(:'t5', :'c5', 1, 'sunk', 1, 1);
SELECT tests.add_shot(:'t5', :'d5', 1, 'sunk', 1, 1);
SELECT tests.add_shot(:'t5', :'e5', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t5', :'e5', 1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t5', :'e5', 1, 'sunk',    1, 3);       -- gross 3
SELECT is(
  (SELECT best_ball_score || ':' || status::text
     FROM team_hole_scores WHERE team_id = :'tm5' AND hole_number = 1),
  '1:final', 'size 5: min 1, final when all five members final');

SELECT * FROM finish();
ROLLBACK;
