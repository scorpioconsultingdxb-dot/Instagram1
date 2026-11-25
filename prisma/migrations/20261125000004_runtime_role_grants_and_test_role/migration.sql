-- ============================================================================
-- Viewora — Migration 4: Least-Privilege Runtime Role Grants (Main + Test)
-- Ensures both `viewora_app` (main runtime) and `viewora_test_app` (isolated
-- integration test runtime) receive identical least-privilege table, sequence,
-- schema, and RLS helper function permissions without hardcoding a single role.
-- Fully compatible with PostgreSQL 14, 15, and 16.
-- ============================================================================

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['viewora_app', 'viewora_test_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
      EXECUTE format('GRANT USAGE ON SCHEMA app TO %I', r);
      EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO %I', r);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', r);
      EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT EXECUTE ON FUNCTIONS TO %I', r);
    END IF;
  END LOOP;
END
$$;
