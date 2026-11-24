-- ============================================================================
-- Viewora Row-Level Security (RLS) Policies & Auth User Bootstrap Trigger
-- ============================================================================

-- Helper: check if the current authenticated user is an admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin')
  );
$$;

-- Helper: check workspace membership
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
  );
$$;

-- Bootstrap profile + default workspace + Free subscription when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_ws_id uuid;
  free_plan_id uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  insert into public.workspaces (owner_id, name, slug, segment, is_default)
  values (
    new.id,
    'Personal Workspace',
    'ws-' || substr(replace(new.id::text, '-', ''), 1, 12),
    'personal',
    true
  )
  returning id into default_ws_id;

  insert into public.workspace_members (workspace_id, user_id, member_role)
  values (default_ws_id, new.id, 'owner')
  on conflict do nothing;

  select id into free_plan_id from public.plans where code = 'free' limit 1;
  if free_plan_id is not null then
    insert into public.subscriptions (user_id, workspace_id, plan_id, billing_interval, status, payment_provider)
    values (new.id, default_ws_id, free_plan_id, 'monthly', 'active', 'disabled');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable RLS across all tables
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.plans enable row level security;
alter table public.plan_billing_options enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_entitlement_overrides enable row level security;
alter table public.saved_profiles enable row level security;
alter table public.profile_snapshots enable row level security;
alter table public.competitor_sets enable row level security;
alter table public.ai_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.search_events enable row level security;
alter table public.funnel_events enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_assignments enable row level security;
alter table public.provider_health_logs enable row level security;
alter table public.api_usage_logs enable row level security;
alter table public.cms_content enable row level security;
alter table public.support_tickets enable row level security;
alter table public.audit_logs enable row level security;
alter table public.feature_flags enable row level security;

-- Profiles: users read/update own profile (role cannot be self-escalated); admins manage all
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin());

-- Workspaces & members
create policy "workspaces_member_select" on public.workspaces
  for select using (owner_id = auth.uid() or public.is_workspace_member(id) or public.is_admin());

create policy "workspaces_owner_modify" on public.workspaces
  for all using (owner_id = auth.uid() or public.is_admin());

create policy "workspace_members_select" on public.workspace_members
  for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id) or public.is_admin());

create policy "workspace_members_admin_all" on public.workspace_members
  for all using (public.is_admin());

-- Plans, billing options & entitlements: readable by everyone, writable by admins only
create policy "plans_public_read" on public.plans
  for select using (is_active = true or public.is_admin());
create policy "plans_admin_write" on public.plans
  for all using (public.is_admin());

create policy "plan_billing_public_read" on public.plan_billing_options
  for select using (is_active = true or public.is_admin());
create policy "plan_billing_admin_write" on public.plan_billing_options
  for all using (public.is_admin());

create policy "plan_entitlements_public_read" on public.plan_entitlements
  for select using (true);
create policy "plan_entitlements_admin_write" on public.plan_entitlements
  for all using (public.is_admin());

-- Subscriptions & entitlement overrides
create policy "subscriptions_select_own_or_admin" on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "subscriptions_admin_write" on public.subscriptions
  for all using (public.is_admin());

create policy "overrides_select_own_or_admin" on public.user_entitlement_overrides
  for select using (user_id = auth.uid() or public.is_admin());
create policy "overrides_admin_write" on public.user_entitlement_overrides
  for all using (public.is_admin());

-- Workspace-scoped customer data
create policy "saved_profiles_workspace_access" on public.saved_profiles
  for all using (public.is_workspace_member(workspace_id) or public.is_admin());

create policy "profile_snapshots_read" on public.profile_snapshots
  for select using (
    saved_profile_id is null
    or exists (
      select 1 from public.saved_profiles sp
      where sp.id = profile_snapshots.saved_profile_id
        and public.is_workspace_member(sp.workspace_id)
    )
    or public.is_admin()
  );
create policy "profile_snapshots_admin_write" on public.profile_snapshots
  for all using (public.is_admin());

create policy "competitor_sets_workspace_access" on public.competitor_sets
  for all using (public.is_workspace_member(workspace_id) or public.is_admin());

create policy "ai_reports_workspace_access" on public.ai_reports
  for all using (public.is_workspace_member(workspace_id) or public.is_admin());

create policy "notifications_own_access" on public.notifications
  for all using (user_id = auth.uid() or public.is_admin());

-- Analytics & experiments: admin read; server/service writes
create policy "search_events_admin_read" on public.search_events
  for select using (user_id = auth.uid() or public.is_admin());
create policy "funnel_events_admin_read" on public.funnel_events
  for select using (public.is_admin());
create policy "experiments_public_read_active" on public.experiments
  for select using (status = 'active' or public.is_admin());
create policy "experiments_admin_write" on public.experiments
  for all using (public.is_admin());
create policy "experiment_assignments_admin_read" on public.experiment_assignments
  for select using (public.is_admin());

-- Admin-only operational tables
create policy "provider_health_admin_only" on public.provider_health_logs
  for all using (public.is_admin());
create policy "api_usage_admin_only" on public.api_usage_logs
  for all using (public.is_admin());
create policy "audit_logs_admin_read" on public.audit_logs
  for select using (public.is_admin());
create policy "audit_logs_admin_insert" on public.audit_logs
  for insert with check (public.is_admin());

-- CMS & feature flags: public read published/flags; admin write
create policy "cms_public_read" on public.cms_content
  for select using (is_published = true or public.is_admin());
create policy "cms_admin_write" on public.cms_content
  for all using (public.is_admin());

create policy "feature_flags_public_read" on public.feature_flags
  for select using (true);
create policy "feature_flags_admin_write" on public.feature_flags
  for all using (public.is_admin());

-- Support tickets: users see/create own; admins manage all
create policy "support_tickets_own_select" on public.support_tickets
  for select using (user_id = auth.uid() or public.is_admin());
create policy "support_tickets_create" on public.support_tickets
  for insert with check (user_id is null or user_id = auth.uid());
create policy "support_tickets_admin_all" on public.support_tickets
  for all using (public.is_admin());
