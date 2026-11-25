-- ============================================================================
-- Viewora — Migration 5: Database-Enforced Audit Log Immutability & Schema Hardening
-- 1. Revokes UPDATE, DELETE, and TRUNCATE on public.audit_logs from restricted
--    runtime roles (viewora_app, viewora_test_app) so audit_logs is strictly
--    append-only (SELECT + INSERT) at the PostgreSQL privilege layer.
-- 2. Enforces a BEFORE UPDATE OR DELETE trigger on public.audit_logs that blocks
--    all DELETEs and all content/metadata UPDATEs (ERRCODE 42501), permitting
--    ONLY PostgreSQL's ON DELETE SET NULL referential cascade on actor_id when
--    the referenced user row has already been deleted during account deletion
--    (preserving actor_email, action, target_type, target_id, diff, ip_address,
--    and created_at completely untouched).
-- 3. Revokes CREATE on SCHEMA public from PUBLIC (aligning PG 14 with PG 15/16).
-- Fully compatible with PostgreSQL 14, 15, and 16.
-- ============================================================================

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['viewora_app', 'viewora_test_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM %I', r);
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION app.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_logs is append-only; DELETE is prohibited'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Permit exclusively the PostgreSQL ON DELETE SET NULL cascade on actor_id
    -- when a user account is deleted, while guaranteeing every forensic audit
    -- field remains byte-for-byte immutable.
    IF OLD.actor_id IS NOT NULL
      AND NEW.actor_id IS NULL
      AND NEW.id IS NOT DISTINCT FROM OLD.id
      AND NEW.actor_email IS NOT DISTINCT FROM OLD.actor_email
      AND NEW.action IS NOT DISTINCT FROM OLD.action
      AND NEW.target_type IS NOT DISTINCT FROM OLD.target_type
      AND NEW.target_id IS NOT DISTINCT FROM OLD.target_id
      AND NEW.diff IS NOT DISTINCT FROM OLD.diff
      AND NEW.ip_address IS NOT DISTINCT FROM OLD.ip_address
      AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
      AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.actor_id)
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'audit_logs is append-only; UPDATE is prohibited'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_audit_log_mutation();
