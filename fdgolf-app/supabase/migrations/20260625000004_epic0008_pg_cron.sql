CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Flag rounds with no shot activity for >10 min.
-- COALESCE handles rounds with zero shots (MAX returns NULL) by falling back to started_at.
SELECT cron.schedule(
  'sync-detect-flag',
  '*/5 * * * *',
  $$
    UPDATE rounds
    SET sync_issue = true
    WHERE status = 'in_progress'
      AND sync_issue = false
      AND started_at < now() - INTERVAL '10 minutes'
      AND COALESCE(
        (SELECT MAX(created_at) FROM shots WHERE shots.round_id = rounds.id),
        rounds.started_at
      ) < now() - INTERVAL '10 minutes'
  $$
);

-- Clear flag when shots resume (prevents stale flags after connectivity restores).
SELECT cron.schedule(
  'sync-detect-clear',
  '*/5 * * * *',
  $$
    UPDATE rounds
    SET sync_issue = false
    WHERE status = 'in_progress'
      AND sync_issue = true
      AND (SELECT MAX(created_at) FROM shots WHERE shots.round_id = rounds.id)
          > now() - INTERVAL '10 minutes'
  $$
);
