-- ============================================================
-- FDgolf: recompute_hole_score + shots trigger
-- Story: US-0049, US-0053 | ACs: AC-0194, AC-0197, AC-0198
-- ============================================================

-- Recompute one player's hole_scores row from their shots on a hole.
-- gross = SUM(stroke_count); status final when any sunk shot OR > 8 shots.
-- Deletes the row when no shots remain.
CREATE OR REPLACE FUNCTION recompute_hole_score(p_round_id uuid, p_hole_number int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gross    int;
  v_count    int;
  v_has_sunk boolean;
  v_status   hole_score_status;
BEGIN
  SELECT COALESCE(SUM(stroke_count), 0),
         COUNT(*),
         bool_or(outcome = 'sunk')
    INTO v_gross, v_count, v_has_sunk
    FROM shots
   WHERE round_id = p_round_id
     AND hole_number = p_hole_number;

  IF v_count = 0 THEN
    DELETE FROM hole_scores WHERE round_id = p_round_id AND hole_number = p_hole_number;
    RETURN;
  END IF;

  v_status := CASE WHEN COALESCE(v_has_sunk, false) OR v_count > 8
                   THEN 'final'::hole_score_status
                   ELSE 'provisional'::hole_score_status END;

  INSERT INTO hole_scores (round_id, hole_number, gross_score, status)
    VALUES (p_round_id, p_hole_number, v_gross, v_status)
  ON CONFLICT (round_id, hole_number) DO UPDATE
    SET gross_score = EXCLUDED.gross_score,
        status      = EXCLUDED.status,
        updated_at  = now();
END;
$$;

-- Trigger wrapper: recompute the affected (round, hole) on any shot change.
CREATE OR REPLACE FUNCTION fdgolf_shots_recompute_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_hole_score(OLD.round_id, OLD.hole_number);
    RETURN OLD;
  END IF;

  -- On an UPDATE that moves the shot to a different round/hole, recompute the origin too.
  IF TG_OP = 'UPDATE'
     AND (OLD.round_id <> NEW.round_id OR OLD.hole_number <> NEW.hole_number) THEN
    PERFORM recompute_hole_score(OLD.round_id, OLD.hole_number);
  END IF;

  PERFORM recompute_hole_score(NEW.round_id, NEW.hole_number);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shots_recompute ON shots;
CREATE TRIGGER trg_shots_recompute
  AFTER INSERT OR UPDATE OR DELETE ON shots
  FOR EACH ROW EXECUTE FUNCTION fdgolf_shots_recompute_trigger();
