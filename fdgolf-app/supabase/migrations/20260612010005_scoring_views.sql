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
