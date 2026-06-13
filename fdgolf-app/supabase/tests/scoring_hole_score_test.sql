BEGIN;
SELECT plan(7);

-- Fixture: one tournament, one team, one member.
SELECT tournament_id AS t, team_id AS tm FROM tests.seed_tournament(2) \gset
SELECT tests.add_member(:'t', :'tm', 'Alice') AS alice \gset

-- Two in-play shots + a sunk shot on hole 1 → gross 3, final (sunk).
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 1);
SELECT tests.add_shot(:'t', :'alice', 1, 'in_play', 1, 2);
SELECT tests.add_shot(:'t', :'alice', 1, 'sunk',    1, 3);

SELECT is(
  (SELECT gross_score FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 1),
  3, 'in_play + in_play + sunk sums to gross 3');

SELECT is(
  (SELECT status::text FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 1),
  'final', 'a sunk shot finalizes the hole');

-- Mulligan (stroke 0) on hole 2 must not inflate the sum.
SELECT tests.add_shot(:'t', :'alice', 2, 'mulligan', 0, 1);
SELECT tests.add_shot(:'t', :'alice', 2, 'in_play',  1, 2);
SELECT is(
  (SELECT gross_score FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 2),
  1, 'mulligan (stroke_count 0) does not inflate gross');

SELECT is(
  (SELECT status::text FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 2),
  'provisional', 'hole with no sunk and <=8 shots is provisional');

-- OOB (stroke 2 = shot + penalty) on hole 3.
SELECT tests.add_shot(:'t', :'alice', 3, 'out_of_bounds', 2, 1);
SELECT tests.add_shot(:'t', :'alice', 3, 'in_play',       1, 2);
SELECT is(
  (SELECT gross_score FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 3),
  3, 'OOB penalty (stroke_count 2) is included in gross');

-- Blowout: 9 in-play shots, no sunk → auto-final.
SELECT tests.add_shot(:'t', :'alice', 4, 'in_play', 1, g) FROM generate_series(1, 9) AS g;
SELECT is(
  (SELECT status::text FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 4),
  'final', '> 8 shots auto-finalizes the hole (AC-0194)');

-- Deleting all shots on a hole removes the hole_scores row.
DELETE FROM shots WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 2;
SELECT is(
  (SELECT count(*)::int FROM hole_scores
     WHERE round_id = tests.round_of(:'t', :'alice') AND hole_number = 2),
  0, 'removing all shots on a hole deletes its hole_scores row');

SELECT * FROM finish();
ROLLBACK;
