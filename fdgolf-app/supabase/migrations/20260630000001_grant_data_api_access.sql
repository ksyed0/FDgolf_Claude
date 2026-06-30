-- Grant Data API access to public-schema objects for anon/authenticated/service_role.
--
-- Background: as of Supabase CLI 2026-05-30, the `api.auto_expose_new_tables`
-- default flipped from `true` to `false` to match the new cloud default. New
-- public-schema tables no longer auto-grant SELECT/INSERT/UPDATE/DELETE to the
-- Data API roles, which surfaces as `permission denied for table <name>` from
-- PostgREST before RLS evaluation even runs.
--
-- Row-level access is still governed by each table's RLS policies; these GRANTs
-- only open the API surface so the policies have a chance to evaluate.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated, service_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public
  TO anon, authenticated, service_role;

-- Apply the same defaults to anything created in the public schema going forward
-- by the `postgres` role (which is what migrations run as).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
