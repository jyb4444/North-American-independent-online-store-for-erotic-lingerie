-- ============================================================
-- API role privileges the app relies on
--
-- Supabase projects created before the "Data API secure by default" change grant
-- anon/authenticated/service_role full table privileges in `public` and rely on RLS
-- policies to decide what each role can see. The hosted project uses that model, and
-- the app depends on it (e.g. the browser writes wishlists/addresses directly).
-- Newer local stacks no longer do this, so declare it explicitly here, before any
-- table is created, so every environment starts from the same baseline.
--
-- On the hosted project this is a no-op (these defaults are already in place).
-- Later migrations narrow privileges per table where RLS alone is not enough.
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
