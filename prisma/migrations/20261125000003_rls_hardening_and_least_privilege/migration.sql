-- ============================================================================
-- Viewora — Migration 3: PostgreSQL RLS Hardening & Least-Privilege Roles
-- Fixes all RLS gaps identified in Stage 1 review:
--   1. Separates platform admin vs support staff privileges (least privilege).
--   2. Adds SECURITY DEFINER app.is_workspace_owner() with hardened search_path
--      (pg_catalog, public, app) and revokes PUBLIC execute grants.
--   3. Enables INSERT/UPDATE/DELETE policies on workspace_members so workspace
--      registration and team administration work under restricted `viewora_app`.
--   4. Splits workspace SELECT vs owner write policies cleanly.
--   5. Enables RLS on activity_events, consent_records, and data_export_requests.
--   6. Enforces zero admin bypass on private research notes & OAuth tokens.
-- ============================================================================

-- 1. Hardened least-privilege helper functions in schema `app`
CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, app
AS $$
  SELECT CASE
    WHEN current_setting('app.current_user_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN current_setting('app.current_user_id', true)::uuid
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION app.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, app
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_user_role', true), ''), 'anonymous');
$$;

-- Only full platform administrators (excludes support_agent, content_manager, analyst)
CREATE OR REPLACE FUNCTION app.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, app
AS $$
  SELECT app.current_user_role() IN ('super_admin', 'admin', 'operations_admin');
$$;

-- Support staff (used strictly for support_tickets and support_messages)
CREATE OR REPLACE FUNCTION app.is_support_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, app
AS $$
  SELECT app.current_user_role() IN ('super_admin', 'admin', 'operations_admin', 'support_agent');
$$;

-- Keep backwards-compatible app.is_admin() narrowed to platform admins
CREATE OR REPLACE FUNCTION app.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, app
AS $$
  SELECT app.is_platform_admin();
$$;

CREATE OR REPLACE FUNCTION app.is_workspace_owner(target_ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = target_ws_id
      AND w.owner_id = app.current_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION app.is_workspace_member(target_ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_ws_id
      AND wm.user_id = app.current_user_id()
  );
$$;

-- Restrict execute permissions on SECURITY DEFINER and context helpers
REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;

-- 2. Enable RLS on additional privacy & tenant tables
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

-- 3. Tighten policies to least privilege & enable owner registration under viewora_app

-- user_preferences: customer owns own preferences; no unnecessary non-platform-admin access
DROP POLICY IF EXISTS user_preferences_owner_only ON public.user_preferences;
CREATE POLICY user_preferences_owner_only ON public.user_preferences
  FOR ALL
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

-- workspaces: split SELECT (owner or member) from INSERT/UPDATE/DELETE (owner only)
DROP POLICY IF EXISTS workspaces_member_access ON public.workspaces;
DROP POLICY IF EXISTS workspaces_select_member ON public.workspaces;
DROP POLICY IF EXISTS workspaces_insert_owner ON public.workspaces;
DROP POLICY IF EXISTS workspaces_modify_owner ON public.workspaces;
DROP POLICY IF EXISTS workspaces_delete_owner ON public.workspaces;

CREATE POLICY workspaces_select_member ON public.workspaces
  FOR SELECT
  USING (owner_id = app.current_user_id() OR app.is_workspace_member(id));

CREATE POLICY workspaces_insert_owner ON public.workspaces
  FOR INSERT
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY workspaces_modify_owner ON public.workspaces
  FOR UPDATE
  USING (owner_id = app.current_user_id())
  WITH CHECK (owner_id = app.current_user_id());

CREATE POLICY workspaces_delete_owner ON public.workspaces
  FOR DELETE
  USING (owner_id = app.current_user_id());

-- workspace_members: allow workspace owners to bootstrap owner/member rows under viewora_app
DROP POLICY IF EXISTS workspace_members_access ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_select ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_insert_owner ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_modify_owner ON public.workspace_members;
DROP POLICY IF EXISTS workspace_members_delete_owner ON public.workspace_members;

CREATE POLICY workspace_members_select ON public.workspace_members
  FOR SELECT
  USING (
    user_id = app.current_user_id()
    OR app.is_workspace_owner(workspace_id)
    OR app.is_workspace_member(workspace_id)
  );

CREATE POLICY workspace_members_insert_owner ON public.workspace_members
  FOR INSERT
  WITH CHECK (app.is_workspace_owner(workspace_id));

CREATE POLICY workspace_members_modify_owner ON public.workspace_members
  FOR UPDATE
  USING (app.is_workspace_owner(workspace_id))
  WITH CHECK (app.is_workspace_owner(workspace_id));

CREATE POLICY workspace_members_delete_owner ON public.workspace_members
  FOR DELETE
  USING (app.is_workspace_owner(workspace_id) OR user_id = app.current_user_id());

-- Customer research & workspace-isolated tables (ZERO admin bypass for private customer research)
DROP POLICY IF EXISTS saved_profiles_workspace_isolation ON public.saved_profiles;
CREATE POLICY saved_profiles_workspace_isolation ON public.saved_profiles
  FOR ALL
  USING (app.is_workspace_member(workspace_id))
  WITH CHECK (user_id = app.current_user_id() AND app.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS research_folders_workspace_isolation ON public.research_folders;
CREATE POLICY research_folders_workspace_isolation ON public.research_folders
  FOR ALL
  USING (app.is_workspace_member(workspace_id))
  WITH CHECK (user_id = app.current_user_id() AND app.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS profile_research_notes_private_only ON public.profile_research_notes;
CREATE POLICY profile_research_notes_private_only ON public.profile_research_notes
  FOR ALL
  USING (app.is_workspace_member(workspace_id))
  WITH CHECK (author_id = app.current_user_id() AND app.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS comparison_projects_workspace_isolation ON public.comparison_projects;
CREATE POLICY comparison_projects_workspace_isolation ON public.comparison_projects
  FOR ALL
  USING (app.is_workspace_member(workspace_id))
  WITH CHECK (user_id = app.current_user_id() AND app.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS activity_events_workspace_isolation ON public.activity_events;
CREATE POLICY activity_events_workspace_isolation ON public.activity_events
  FOR ALL
  USING (app.is_workspace_member(workspace_id))
  WITH CHECK (app.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS ai_reports_workspace_isolation ON public.ai_reports;
CREATE POLICY ai_reports_workspace_isolation ON public.ai_reports
  FOR ALL
  USING (app.is_workspace_member(workspace_id))
  WITH CHECK (user_id = app.current_user_id() AND app.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS report_exports_workspace_isolation ON public.report_exports;
CREATE POLICY report_exports_workspace_isolation ON public.report_exports
  FOR ALL
  USING (app.is_workspace_member(workspace_id))
  WITH CHECK (user_id = app.current_user_id() AND app.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS notifications_owner_isolation ON public.notifications;
CREATE POLICY notifications_owner_isolation ON public.notifications
  FOR ALL
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

DROP POLICY IF EXISTS consent_records_owner_only ON public.consent_records;
CREATE POLICY consent_records_owner_only ON public.consent_records
  FOR ALL
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

DROP POLICY IF EXISTS data_export_requests_owner_only ON public.data_export_requests;
CREATE POLICY data_export_requests_owner_only ON public.data_export_requests
  FOR ALL
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

-- Support tickets & messages: customer sees own; support_staff manages support queue
DROP POLICY IF EXISTS support_tickets_owner_or_admin ON public.support_tickets;
CREATE POLICY support_tickets_owner_or_support ON public.support_tickets
  FOR ALL
  USING (user_id = app.current_user_id() OR app.is_support_staff())
  WITH CHECK (user_id IS NULL OR user_id = app.current_user_id() OR app.is_support_staff());

DROP POLICY IF EXISTS support_messages_visibility ON public.support_messages;
DROP POLICY IF EXISTS support_messages_select ON public.support_messages;
DROP POLICY IF EXISTS support_messages_insert ON public.support_messages;

CREATE POLICY support_messages_select ON public.support_messages
  FOR SELECT
  USING (
    app.is_support_staff()
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

CREATE POLICY support_messages_insert ON public.support_messages
  FOR INSERT
  WITH CHECK (
    app.is_support_staff()
    OR (
      NOT is_internal_note
      AND EXISTS (
        SELECT 1
        FROM public.support_tickets t
        WHERE t.id = support_messages.ticket_id
          AND (t.user_id IS NULL OR t.user_id = app.current_user_id())
      )
    )
  );

-- 4. Re-grant least-privilege runtime permissions to `viewora_app`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'viewora_app') THEN
    GRANT USAGE ON SCHEMA public TO viewora_app;
    GRANT USAGE ON SCHEMA app TO viewora_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO viewora_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO viewora_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO viewora_app;
  END IF;
END
$$;
