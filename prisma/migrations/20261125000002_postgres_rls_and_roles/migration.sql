-- ============================================================================
-- Viewora — PostgreSQL Row-Level Security (RLS), Roles & Integrity Constraints
-- Replaces legacy Supabase auth.uid() policies with native PostgreSQL
-- transaction-local session context (`app.current_user_id`, `app.current_user_role`).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper schema for Viewora session-scoped authorization functions
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_user_role', true), ''), 'anonymous');
$$;

CREATE OR REPLACE FUNCTION app.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app.current_user_role() IN (
    'admin',
    'super_admin',
    'operations_admin',
    'support_agent',
    'content_manager',
    'analyst'
  );
$$;

CREATE OR REPLACE FUNCTION app.is_workspace_member(target_ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_ws_id
      AND wm.user_id = app.current_user_id()
  );
$$;

-- Domain check constraints matching Viewora business invariants
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check,
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('customer', 'user', 'analyst', 'content_manager', 'support_agent', 'operations_admin', 'admin', 'super_admin'));

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_account_status_check,
  ADD CONSTRAINT users_account_status_check
    CHECK (account_status IN ('active', 'suspended', 'deleted'));

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_segment_check,
  ADD CONSTRAINT users_segment_check
    CHECK (segment IN ('personal', 'business', 'agency'));

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_locale_check,
  ADD CONSTRAINT users_locale_check
    CHECK (preferred_locale IN ('en', 'pt-BR', 'es', 'de', 'fr'));

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_code_check,
  ADD CONSTRAINT plans_code_check
    CHECK (code IN ('free', 'starter', 'premium', 'pro', 'agency')),
  DROP CONSTRAINT IF EXISTS plans_price_check,
  ADD CONSTRAINT plans_price_check
    CHECK (monthly_price_cents >= 0);

ALTER TABLE public.plan_billing_options
  DROP CONSTRAINT IF EXISTS plan_billing_interval_check,
  ADD CONSTRAINT plan_billing_interval_check
    CHECK (billing_interval IN ('monthly', 'quarterly', 'annual')),
  DROP CONSTRAINT IF EXISTS plan_billing_discount_check,
  ADD CONSTRAINT plan_billing_discount_check
    CHECK (discount_percent >= 0 AND discount_percent <= 90);

-- Enable PostgreSQL Row-Level Security on customer-owned & multi-tenant tables
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_research_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Policies enforce strict user & workspace isolation when `app.current_user_id` is set.
-- Private research notes intentionally exclude admin bypass to protect customer privacy.
DROP POLICY IF EXISTS user_preferences_owner_only ON public.user_preferences;
CREATE POLICY user_preferences_owner_only ON public.user_preferences
  FOR ALL
  USING (user_id = app.current_user_id() OR app.is_admin())
  WITH CHECK (user_id = app.current_user_id() OR app.is_admin());

DROP POLICY IF EXISTS workspaces_member_access ON public.workspaces;
CREATE POLICY workspaces_member_access ON public.workspaces
  FOR ALL
  USING (owner_id = app.current_user_id() OR app.is_workspace_member(id) OR app.is_admin())
  WITH CHECK (owner_id = app.current_user_id() OR app.is_admin());

DROP POLICY IF EXISTS workspace_members_access ON public.workspace_members;
CREATE POLICY workspace_members_access ON public.workspace_members
  FOR SELECT
  USING (user_id = app.current_user_id() OR app.is_workspace_member(workspace_id) OR app.is_admin());

DROP POLICY IF EXISTS research_folders_workspace_isolation ON public.research_folders;
CREATE POLICY research_folders_workspace_isolation ON public.research_folders
  FOR ALL
  USING (user_id = app.current_user_id() AND app.is_workspace_member(workspace_id))
  WITH CHECK (user_id = app.current_user_id() AND app.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS saved_profiles_workspace_isolation ON public.saved_profiles;
CREATE POLICY saved_profiles_workspace_isolation ON public.saved_profiles
  FOR ALL
  USING (app.is_workspace_member(workspace_id) OR app.is_admin())
  WITH CHECK (app.is_workspace_member(workspace_id) OR app.is_admin());

DROP POLICY IF EXISTS profile_research_notes_private_only ON public.profile_research_notes;
CREATE POLICY profile_research_notes_private_only ON public.profile_research_notes
  FOR ALL
  USING (app.is_workspace_member(workspace_id))
  WITH CHECK (app.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS comparison_projects_workspace_isolation ON public.comparison_projects;
CREATE POLICY comparison_projects_workspace_isolation ON public.comparison_projects
  FOR ALL
  USING (app.is_workspace_member(workspace_id))
  WITH CHECK (app.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS ai_reports_workspace_isolation ON public.ai_reports;
CREATE POLICY ai_reports_workspace_isolation ON public.ai_reports
  FOR ALL
  USING (app.is_workspace_member(workspace_id) OR app.is_admin())
  WITH CHECK (app.is_workspace_member(workspace_id) OR app.is_admin());

DROP POLICY IF EXISTS report_exports_workspace_isolation ON public.report_exports;
CREATE POLICY report_exports_workspace_isolation ON public.report_exports
  FOR ALL
  USING (app.is_workspace_member(workspace_id) OR app.is_admin())
  WITH CHECK (app.is_workspace_member(workspace_id) OR app.is_admin());

DROP POLICY IF EXISTS notifications_owner_isolation ON public.notifications;
CREATE POLICY notifications_owner_isolation ON public.notifications
  FOR ALL
  USING (user_id = app.current_user_id() OR app.is_admin())
  WITH CHECK (user_id = app.current_user_id() OR app.is_admin());

DROP POLICY IF EXISTS provider_connections_owner_only ON public.provider_connections;
CREATE POLICY provider_connections_owner_only ON public.provider_connections
  FOR ALL
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

DROP POLICY IF EXISTS support_tickets_owner_or_admin ON public.support_tickets;
CREATE POLICY support_tickets_owner_or_admin ON public.support_tickets
  FOR ALL
  USING (user_id = app.current_user_id() OR app.is_admin())
  WITH CHECK (user_id IS NULL OR user_id = app.current_user_id() OR app.is_admin());

DROP POLICY IF EXISTS support_messages_visibility ON public.support_messages;
CREATE POLICY support_messages_visibility ON public.support_messages
  FOR SELECT
  USING (
    app.is_admin()
    OR (
      NOT is_internal_note
      AND EXISTS (
        SELECT 1
        FROM public.support_tickets t
        WHERE t.id = support_messages.ticket_id
          AND t.user_id = app.current_user_id()
      )
    )
  );

-- Ensure least-privilege viewora_app role has schema/function access if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'viewora_app') THEN
    GRANT USAGE ON SCHEMA app TO viewora_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO viewora_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO viewora_app;
  END IF;
END
$$;
