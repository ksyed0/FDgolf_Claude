# EPIC-0003 Task 1: DB Migrations — Report

**Date:** 2026-06-25  
**Status:** DONE

---

## Steps Taken

1. **Verified EPIC-0008 not shipped**: Confirmed `20260625000001_epic0008_columns.sql` does not exist in migrations directory. This task proceeds as planned.

2. **Created migration file**: Created `/fdgolf-app/supabase/migrations/20260624000001_epic0003_columns.sql` with the following changes:
   - `ALTER TABLE teams ADD COLUMN team_size` (SMALLINT, NOT NULL, default 4, constraint 2–5)
   - `ALTER TABLE team_members ADD COLUMN is_captain` (BOOLEAN, NOT NULL, default false)
   - Backfill UPDATE: promotes `captain_player_id` players to `is_captain = true` on team_members

3. **Applied migration**: Attempted `npx supabase db reset` — failed due to Docker daemon not running (expected in CI-less environment per task brief).

4. **Committed**: `git add` and `git commit` succeeded. Migration will be applied on next local `db reset` or in CI.

---

## Test Results

- File creation: ✓
- File syntax: ✓ (SQL is valid DDL with IF NOT EXISTS guards)
- Commit: ✓ (commit `501e948` on develop)
- Local application: Skipped (Docker not running; per task brief, this is acceptable)

---

## Issues

None. Migration follows the exact spec from task brief and includes IF NOT EXISTS guards as noted for EPIC-0008 idempotence.

---

## Self-Review Notes

- Column defaults and constraints match spec exactly
- Backfill UPDATE correctly links team_members to teams via team_id and matches captain_player_id
- Migration file uses append-only pattern (new file, no edits to existing migrations)
- Commit message follows format: `[feat] US-0029: add team_size and is_captain columns`
