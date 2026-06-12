-- ============================================================
-- FDgolf: calc_best_ball_for_hole
-- Story: US-0049 | ACs: AC-0182, AC-0183, AC-0184, AC-0199
-- ============================================================

-- Returns the Best Ball result for one team on one hole:
--   best_score             = MIN gross across non-withdrawn members who have a score
--   contributing_player_id = holder of the MIN, broken by:
--       (1) final preferred over provisional,
--       (2) earliest updated_at as a best-effort recency hint
--           (note: updated_at is rewritten on every recompute by trigger_set_updated_at,
--            so this tier is heuristic only and is NOT stable across re-edits),
--       (3) lowest player_id as the deterministic backstop that guarantees a stable,
--           well-defined winner
--   status = final only when every active (non-withdrawn) member has a final hole_score.
-- Returns NO ROW when no active member has a score for the hole (caller deletes the team row).
CREATE OR REPLACE FUNCTION calc_best_ball_for_hole(p_team_id uuid, p_hole_number int)
RETURNS TABLE (best_score int, contributing_player_id uuid, status hole_score_status)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active int;
  v_finals int;
  v_best   int;
  v_player uuid;
BEGIN
  -- Active roster size = non-withdrawn registrations for the team.
  SELECT count(*) INTO v_active
    FROM tournament_registrations tr
   WHERE tr.team_id = p_team_id
     AND tr.status <> 'withdrawn';

  -- Member scores for this hole, restricted to non-withdrawn members.
  -- Note: ms_status alias avoids ambiguity with the OUT parameter 'status'.
  WITH member_scores AS (
    SELECT hs.gross_score,
           hs.status    AS ms_status,
           hs.updated_at,
           r.player_id
      FROM hole_scores hs
      JOIN rounds r
        ON r.id = hs.round_id
      JOIN tournament_registrations tr
        ON tr.player_id = r.player_id
       AND tr.tournament_id = r.tournament_id
     WHERE r.team_id = p_team_id
       AND tr.status <> 'withdrawn'
       AND hs.hole_number = p_hole_number
  )
  SELECT
    (SELECT gross_score FROM member_scores
       ORDER BY gross_score ASC,
                (ms_status = 'final') DESC,
                updated_at ASC,
                player_id ASC
       LIMIT 1),
    (SELECT player_id FROM member_scores
       ORDER BY gross_score ASC,
                (ms_status = 'final') DESC,
                updated_at ASC,
                player_id ASC
       LIMIT 1),
    (SELECT count(*) FILTER (WHERE ms_status = 'final') FROM member_scores)
  INTO v_best, v_player, v_finals;

  IF v_best IS NULL THEN
    RETURN;  -- no row
  END IF;

  best_score := v_best;
  contributing_player_id := v_player;
  status := CASE WHEN v_active > 0 AND v_finals = v_active
                 THEN 'final'::hole_score_status
                 ELSE 'provisional'::hole_score_status END;
  RETURN NEXT;
END;
$$;
