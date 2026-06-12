-- ============================================================
-- FDgolf: recompute_team_hole_score + hole_scores trigger
-- Story: US-0050 | ACs: AC-0186, AC-0187, AC-0188
-- ============================================================

-- Upsert (or delete) a team_hole_scores row from calc_best_ball_for_hole.
CREATE OR REPLACE FUNCTION recompute_team_hole_score(p_team_id uuid, p_hole_number int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v record;
BEGIN
  SELECT * INTO v FROM calc_best_ball_for_hole(p_team_id, p_hole_number);

  IF v.best_score IS NULL THEN
    DELETE FROM team_hole_scores WHERE team_id = p_team_id AND hole_number = p_hole_number;
    RETURN;
  END IF;

  INSERT INTO team_hole_scores (team_id, hole_number, best_ball_score, contributing_player_id, status)
    VALUES (p_team_id, p_hole_number, v.best_score, v.contributing_player_id, v.status)
  ON CONFLICT (team_id, hole_number) DO UPDATE
    SET best_ball_score        = EXCLUDED.best_ball_score,
        contributing_player_id = EXCLUDED.contributing_player_id,
        status                 = EXCLUDED.status,
        updated_at             = now();
END;
$$;

-- Trigger wrapper: resolve the team from the round, then recompute the team hole.
CREATE OR REPLACE FUNCTION fdgolf_hole_scores_recompute_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT team_id INTO v_team FROM rounds WHERE id = OLD.round_id;
    IF v_team IS NOT NULL THEN
      PERFORM recompute_team_hole_score(v_team, OLD.hole_number);
    END IF;
    RETURN OLD;
  END IF;

  SELECT team_id INTO v_team FROM rounds WHERE id = NEW.round_id;
  IF v_team IS NOT NULL THEN
    PERFORM recompute_team_hole_score(v_team, NEW.hole_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hole_scores_recompute ON hole_scores;
CREATE TRIGGER trg_hole_scores_recompute
  AFTER INSERT OR UPDATE OR DELETE ON hole_scores
  FOR EACH ROW EXECUTE FUNCTION fdgolf_hole_scores_recompute_trigger();
