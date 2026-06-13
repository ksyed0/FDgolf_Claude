-- ============================================================
-- FDgolf: Scoring read views
-- Stories: US-0051, US-0052, US-0055
-- ACs: AC-0189, AC-0190, AC-0191, AC-0192, AC-0193, AC-0200, AC-0201
-- ============================================================

-- Per-hole and cumulative team score-vs-par. Par is reached through
-- teams -> tournaments -> courses -> holes (team_hole_scores keys on team_id).
CREATE OR REPLACE VIEW team_hole_vs_par AS
SELECT
  ths.team_id,
  t.tournament_id,
  ths.hole_number,
  ths.best_ball_score,
  h.par,
  ths.best_ball_score - h.par                                   AS hole_vs_par,
  SUM(ths.best_ball_score - h.par) OVER (
    PARTITION BY ths.team_id ORDER BY ths.hole_number)          AS cumulative_vs_par,
  ths.status
FROM team_hole_scores ths
JOIN teams       t  ON t.id = ths.team_id
JOIN tournaments tn ON tn.id = t.tournament_id
JOIN holes       h  ON h.course_id = tn.course_id
                   AND h.number    = ths.hole_number;

-- One row per team (LEFT JOIN from teams so all registered teams appear).
-- Ranked by TO-PAR (total_vs_par), not raw strokes, so teams thru different
-- hole counts are comparable and not-yet-started teams sit at even par.
CREATE OR REPLACE VIEW team_standings AS
-- BUG-0017: epic0003 teams has `name` (no team_number); ranking/grouping use t.name.
SELECT
  t.id              AS team_id,
  t.tournament_id,
  t.name            AS team_name,
  COALESCE(SUM(ths.best_ball_score), 0)                          AS total_score,
  COALESCE(SUM(ths.best_ball_score - h.par), 0)                  AS total_vs_par,
  COUNT(DISTINCT ths.hole_number)                                AS thru,
  COALESCE(bool_or(ths.status = 'provisional'), false)           AS has_provisional,
  RANK() OVER (
    PARTITION BY t.tournament_id
    ORDER BY COALESCE(SUM(ths.best_ball_score - h.par), 0) ASC)  AS rank
FROM teams t
JOIN tournaments tn        ON tn.id = t.tournament_id
LEFT JOIN team_hole_scores ths ON ths.team_id = t.id
LEFT JOIN holes h          ON h.course_id = tn.course_id
                          AND h.number    = ths.hole_number
GROUP BY t.id, t.tournament_id, t.name;

-- The public leaderboard (EPIC-0007) reads through these views; row visibility
-- for anon is governed by RLS on the base tables and validated in EPIC-0007.
GRANT SELECT ON team_hole_vs_par, team_standings TO anon, authenticated;
