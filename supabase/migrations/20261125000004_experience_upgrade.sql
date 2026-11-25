-- ============================================================================
-- Viewora 10-Stage Customer Experience & Persistence Upgrade Migration
-- Adds persistent Personal Digital HQ fields, Research Folders, Comparison
-- Projects, Dashboard Settings, Broadcast Notifications, and RLS policies.
-- ============================================================================

-- 1. Personal Digital Headquarters & Dashboard Preferences on profiles
alter table public.profiles
  add column if not exists professional_title text default 'Social Intelligence Strategist',
  add column if not exists organization text default 'Viewora Workspace',
  add column if not exists workspace_name text default 'Primary Workspace',
  add column if not exists avatar_preset text not null default 'violet-cyan'
    check (avatar_preset in ('violet-cyan', 'emerald-teal', 'amber-rose', 'obsidian-indigo', 'custom-emoji')),
  add column if not exists avatar_emoji text,
  add column if not exists cover_preset text not null default 'aurora'
    check (cover_preset in ('aurora', 'midnight', 'emerald', 'obsidian', 'sunset')),
  add column if not exists theme_preference text not null default 'system'
    check (theme_preference in ('light', 'dark', 'system')),
  add column if not exists accent_preset text not null default 'violet'
    check (accent_preset in ('violet', 'cyan', 'emerald', 'indigo')),
  add column if not exists timezone text not null default 'UTC',
  add column if not exists default_date_range text not null default '30d'
    check (default_date_range in ('7d', '30d', '90d')),
  add column if not exists dashboard_density text not null default 'comfortable'
    check (dashboard_density in ('comfortable', 'compact')),
  add column if not exists sidebar_default_collapsed boolean not null default false,
  add column if not exists personal_shortcuts jsonb not null default '[]'::jsonb,
  add column if not exists dashboard_settings jsonb not null default '{}'::jsonb;

-- 2. Research Folders (Workspace-owned organization for saved profiles)
create table if not exists public.research_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  color text not null default 'violet'
    check (color in ('violet', 'cyan', 'emerald', 'amber', 'slate')),
  description text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create trigger research_folders_set_updated_at
  before update on public.research_folders
  for each row execute function public.set_updated_at();

alter table public.saved_profiles
  add column if not exists folder_id uuid references public.research_folders (id) on delete set null;

-- 3. Comparison Projects (Persistent multi-profile competitor evaluations)
create table if not exists public.comparison_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text default '',
  usernames text[] not null default '{}',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger comparison_projects_set_updated_at
  before update on public.comparison_projects
  for each row execute function public.set_updated_at();

-- 4. Admin Broadcast Notifications (Read-only for customers, managed by admins)
create table if not exists public.broadcast_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'system'
    check (category in ('system', 'tracking', 'report', 'billing', 'security')),
  target_segment text not null default 'all'
    check (target_segment in ('all', 'personal', 'business', 'agency')),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.research_folders enable row level security;
alter table public.comparison_projects enable row level security;
alter table public.broadcast_notifications enable row level security;

-- Workspace-scoped RLS policies
create policy "research_folders_workspace_member" on public.research_folders
  for all using (public.is_workspace_member(workspace_id));

create policy "comparison_projects_workspace_member" on public.comparison_projects
  for all using (public.is_workspace_member(workspace_id));

create policy "broadcast_notifications_read_active" on public.broadcast_notifications
  for select using (is_active = true or public.is_admin());

create policy "broadcast_notifications_admin_manage" on public.broadcast_notifications
  for all using (public.is_admin());
