-- Phase 5 (Stage 44) Defense-in-Depth Migration:
-- Enable PostgreSQL Row-Level Security on public.profile_snapshots so historical
-- profile snapshots are isolated at the database layer strictly to the workspace
-- that owns the parent saved_profiles record.
-- Additive policy only: zero destructive changes, table count remains 58.

ALTER TABLE public.profile_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_snapshots_workspace_isolation ON public.profile_snapshots;
CREATE POLICY profile_snapshots_workspace_isolation ON public.profile_snapshots
  FOR ALL
  USING (
    saved_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.saved_profiles sp
      WHERE sp.id = profile_snapshots.saved_profile_id
        AND app.is_workspace_member(sp.workspace_id)
    )
  )
  WITH CHECK (
    saved_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.saved_profiles sp
      WHERE sp.id = profile_snapshots.saved_profile_id
        AND app.is_workspace_member(sp.workspace_id)
    )
  );
