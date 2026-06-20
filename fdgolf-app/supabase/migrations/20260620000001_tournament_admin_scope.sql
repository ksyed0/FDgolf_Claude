-- ── Tournament Admin Scope ────────────────────────────────────────────────────
-- Adds fdgolf_has_any_admin_access() for the admin layout guard, enforces that
-- tournament_organizer roles must always be scoped to a specific tournament.
-- DB-level RLS for organizer access was already wired via fdgolf_is_organizer_for()
-- in initial_schema + rls_policies migrations; this migration fills the app-layer gap.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Check constraint: tournament_organizer must have tournament_id
--    (admin and player roles remain un-scoped)
ALTER TABLE user_roles
  ADD CONSTRAINT chk_organizer_requires_tournament
  CHECK (
    role <> 'tournament_organizer'
    OR tournament_id IS NOT NULL
  );

-- 2. Helper function used by admin layout to allow either system admins
--    or any tournament organizer past the top-level /admin/ guard.
CREATE OR REPLACE FUNCTION fdgolf_has_any_admin_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   user_roles
    WHERE  user_id = auth.uid()
      AND  role    IN ('admin', 'tournament_organizer')
  );
$$;
