-- ============================================================
-- FDgolf EPIC-0005: Round Tracking — soft claim + shot accuracy
-- Story: US-0035..US-0048 | Decision D3, AC-0181
-- Depends on: 20260612000003_round_tracking (rounds, shots)
-- Append-only. Existing EPIC-0006 RLS on rounds/shots already covers these columns
-- (rounds_update_* and shots_insert_* policies). No new tables, no new policies.
-- ============================================================

-- Soft-claim columns (D3): one active recorder per round via recorded_by + heartbeat.
ALTER TABLE rounds
  ADD COLUMN recorded_by           UUID        REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN recording_expires_at  TIMESTAMPTZ;

-- AC-0181: GPS accuracy (metres) captured with each shot when available.
ALTER TABLE shots
  ADD COLUMN accuracy_m DOUBLE PRECISION;
