-- Explicitly retire verified JSON-era snapshots and migration metadata.
-- No CASCADE: unexpected external dependencies must abort this migration.
DROP TABLE IF EXISTS public.app_state_archives;
DROP TABLE IF EXISTS public.app_state;
DROP TABLE IF EXISTS public.app_migrations;
DROP FUNCTION IF EXISTS public.reject_legacy_state_write();
