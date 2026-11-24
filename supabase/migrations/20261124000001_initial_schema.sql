-- ============================================================================
-- Viewora Initial Database Schema
-- Covers: Users & Segments, Workspaces, Configurable Plans & Centralized
-- Entitlements, Saved Profiles & Historical Snapshots, Funnel & A/B Analytics,
-- Provider Health, API Usage, CMS, Support Tickets, Audit Logs & Feature Flags.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Helper trigger function for updated_at timestamps
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1. User Profiles & Customer Segments
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user'
    check (role in ('user', 'admin', 'super_admin')),
  segment text not null default 'personal'
    check (segment in ('personal', 'business', 'agency')),
  preferred_locale text not null default 'en'
    check (preferred_locale in ('en', 'pt-BR', 'es', 'de', 'fr')),
  onboarding_completed boolean not null default false,
  email_preferences jsonb not null default '{
    "productUpdates": false,
    "weeklyDigest": false,
    "trackingAlerts": true,
    "marketing": false
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. Workspaces (Personal, Business & Multi-Workspace Agency Support)
-- ============================================================================
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null unique,
  segment text not null default 'personal'
    check (segment in ('personal', 'business', 'agency')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role text not null default 'member'
    check (member_role in ('owner', 'admin', 'analyst', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ============================================================================
-- 3. Pricing Architecture & Centralized Entitlements
-- ============================================================================
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('free', 'starter', 'premium', 'pro', 'agency')),
  name text not null,
  description text not null,
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  currency text not null default 'USD',
  target_segment text not null default 'personal'
    check (target_segment in ('personal', 'business', 'agency')),
  display_order integer not null default 0,
  is_active boolean not null default true,
  is_demo_pricing boolean not null default true,
  stripe_product_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

create table if not exists public.plan_billing_options (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  billing_interval text not null check (billing_interval in ('monthly', 'quarterly', 'annual')),
  discount_percent numeric(5, 2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 90),
  stripe_price_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, billing_interval)
);

create trigger plan_billing_options_set_updated_at
  before update on public.plan_billing_options
  for each row execute function public.set_updated_at();

create table if not exists public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default false,
  numeric_limit integer, -- null means unlimited when enabled=true, or boolean feature
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, feature_key)
);

create trigger plan_entitlements_set_updated_at
  before update on public.plan_entitlements
  for each row execute function public.set_updated_at();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  plan_id uuid not null references public.plans (id),
  billing_interval text not null default 'monthly'
    check (billing_interval in ('monthly', 'quarterly', 'annual')),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'demo_preview')),
  payment_provider text not null default 'disabled'
    check (payment_provider in ('disabled', 'stripe')),
  external_subscription_id text,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table if not exists public.user_entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature_key text not null,
  enabled boolean not null,
  numeric_limit integer,
  reason text,
  granted_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_key)
);

create trigger user_entitlement_overrides_set_updated_at
  before update on public.user_entitlement_overrides
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 4. Saved Public Profiles, Snapshots, Competitors, AI Reports & Notifications
-- ============================================================================
create table if not exists public.saved_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  username text not null,
  display_name text,
  category text,
  is_demo boolean not null default false,
  data_source text not null default 'demo_fixture',
  last_synced_at timestamptz,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, username)
);

create index if not exists idx_saved_profiles_workspace on public.saved_profiles (workspace_id);

create trigger saved_profiles_set_updated_at
  before update on public.saved_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  saved_profile_id uuid references public.saved_profiles (id) on delete cascade,
  username text not null,
  data_class text not null check (data_class in ('live', 'cached', 'estimate', 'demo')),
  provider_id text not null,
  followers_count bigint,
  following_count bigint,
  posts_count bigint,
  engagement_rate numeric(6, 3),
  bio_snapshot text,
  raw_metadata jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists idx_profile_snapshots_username_captured
  on public.profile_snapshots (username, captured_at desc);

create table if not exists public.competitor_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  usernames text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger competitor_sets_set_updated_at
  before update on public.competitor_sets
  for each row execute function public.set_updated_at();

create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  username text not null,
  report_type text not null default 'profile_summary',
  data_class text not null check (data_class in ('live', 'cached', 'estimate', 'demo')),
  summary text not null,
  insights jsonb not null default '[]'::jsonb,
  model_used text not null default 'deterministic_template',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'system'
    check (category in ('system', 'tracking', 'report', 'billing', 'security')),
  is_read boolean not null default false,
  action_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_read
  on public.notifications (user_id, is_read, created_at desc);

-- ============================================================================
-- 5. Search Analytics, Funnel Events & A/B Testing Architecture
-- ============================================================================
create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  session_id text,
  normalized_username text not null,
  tool_slug text not null default 'homepage_search',
  locale text not null default 'en',
  provider_id text not null,
  data_class text not null check (data_class in ('live', 'cached', 'estimate', 'demo')),
  availability text not null
    check (availability in ('available', 'partial', 'unavailable', 'private_account', 'unauthorized')),
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_events_created on public.search_events (created_at desc);

create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  session_id text not null,
  event_name text not null
    check (event_name in (
      'search_performed',
      'results_viewed',
      'premium_preview_viewed',
      'signup_started',
      'signup_completed',
      'pricing_viewed',
      'upgrade_intent'
    )),
  locale text not null default 'en',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_funnel_events_name_created
  on public.funnel_events (event_name, created_at desc);

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  variants jsonb not null default '["control", "variant_a"]'::jsonb,
  traffic_weights jsonb not null default '[50, 50]'::jsonb,
  status text not null default 'active'
    check (status in ('draft', 'active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger experiments_set_updated_at
  before update on public.experiments
  for each row execute function public.set_updated_at();

create table if not exists public.experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_key text not null references public.experiments (key) on delete cascade,
  subject_id text not null, -- user_id or anonymous session_id
  variant text not null,
  converted boolean not null default false,
  assigned_at timestamptz not null default now(),
  unique (experiment_key, subject_id)
);

-- ============================================================================
-- 6. Admin Operations: Provider Health, API Usage, CMS, Support, Audit, Flags
-- ============================================================================
create table if not exists public.provider_health_logs (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  status text not null check (status in ('healthy', 'degraded', 'unavailable', 'disabled')),
  latency_ms integer,
  message text,
  checked_at timestamptz not null default now()
);

create index if not exists idx_provider_health_checked
  on public.provider_health_logs (provider_id, checked_at desc);

create table if not exists public.api_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  provider_id text not null,
  endpoint text not null,
  status_code integer not null,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_usage_created on public.api_usage_logs (created_at desc);

create table if not exists public.cms_content (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  locale text not null check (locale in ('en', 'pt-BR', 'es', 'de', 'fr')),
  content_type text not null default 'announcement'
    check (content_type in ('announcement', 'faq', 'tool_guide', 'disclosure')),
  title text not null,
  body text not null,
  is_published boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, locale)
);

create trigger cms_content_set_updated_at
  before update on public.cms_content
  for each row execute function public.set_updated_at();

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  admin_notes text,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  diff jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created on public.audit_logs (created_at desc);

create table if not exists public.feature_flags (
  key text primary key,
  description text not null,
  enabled boolean not null default false,
  locked boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();
