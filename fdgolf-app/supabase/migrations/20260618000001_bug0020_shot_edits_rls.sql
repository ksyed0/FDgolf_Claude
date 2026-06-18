-- BUG-0020: Allow the round's recording player (in addition to admins) to INSERT shot edits.
-- Drops the admin-only INSERT policy and replaces it with a broader one.

DROP POLICY "shot_edits_insert_admin_only" ON shot_edits;

CREATE POLICY "shot_edits_insert_admin_or_round_member"
  ON shot_edits FOR INSERT
  WITH CHECK (
    fdgolf_is_admin()
    OR EXISTS (
      SELECT 1
      FROM   shots s
      JOIN   rounds r ON r.id = s.round_id
      WHERE  s.id = shot_edits.shot_id
        AND  r.player_id IN (
               SELECT id FROM players WHERE user_id = auth.uid()
             )
    )
  );
