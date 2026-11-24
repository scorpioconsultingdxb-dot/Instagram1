-- ============================================================================
-- Viewora Master Architecture Expansion Migration (Phase 4–6)
-- Extends initial schema cleanly without duplicating existing tables.
-- Adds: Least-privilege admin roles, research notes, activity events,
-- report exports, billing orders/invoices (Phase 7 ready), provider
-- connections, background jobs & attempts, webhooks, email deliveries,
-- support messages, AI usage & cost budgets, and referral/affiliate tables.
-- ============================================================================

-- 1. Expand supported least-privilege administrative roles on profiles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'user', 'analyst', 'content_manager', 'support_agent', 'operations_admin', 'admin', 'super_admin'));

alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'deleted'));

-- 2. Private Research Notes & Activity Events (distinguishing event vs observed time)
create table if not exists public.profile_research_notes (
  id uuid primary key default gen_random_uuid(),
  saved_profile_id uuid not null references public.saved_profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  folder_name text not null default 'General',
  note_body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  saved_profile_id uuid references public.saved_profiles (id) on delete cascade,
  username text not null,
  event_type text not null check (event_type in (
    'new_public_content',
    'follower_count_change',
    'account_stats_update',
    'bio_change',
    'engagement_change',
    'report_completed',
    'data_refresh'
  )),
  summary text not null,
  data_class text not null check (data_class in ('live', 'cached', 'estimate', 'demo')),
  occurred_at timestamptz, -- Actual event timestamp if known
  observed_at timestamptz not null default now(), -- System observation timestamp
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_activity_events_ws_obs
  on public.activity_events (workspace_id, observed_at desc);

-- 3. Report Exports Center
create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  username text not null,
  report_kind text not null check (report_kind in ('profile', 'growth', 'engagement', 'competitor', 'ai', 'weekly_summary')),
  export_format text not null check (export_format in ('pdf', 'csv')),
  status text not null default 'ready' check (status in ('queued', 'generating', 'ready', 'failed')),
  data_class text not null check (data_class in ('live', 'cached', 'estimate', 'demo')),
  storage_path text,
  created_at timestamptz not null default now()
);

-- 4. Future Phase 7 Billing Structures (Payments Disabled)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  billing_interval text not null check (billing_interval in ('monthly', 'quarterly', 'annual')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  status text not null default 'disabled_preview' check (status in ('disabled_preview', 'pending', 'paid', 'failed', 'refunded')),
  external_reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  invoice_number text not null unique,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  status text not null default 'draft' check (status in ('draft', 'open', 'paid', 'void')),
  issued_at timestamptz not null default now()
);

-- 5. Official Meta & Authorized Provider Connections (Encrypted Server-Side Tokens)
create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider_id text not null,
  external_account_id text not null,
  external_username text,
  granted_scopes text[] not null default '{}',
  encrypted_access_token text,
  token_expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider_id, external_account_id)
);

-- 6. Durable Background Jobs, Attempts & Webhook Replay Protection
create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'dead_letter')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_background_jobs_claim
  on public.background_jobs (status, run_after asc);

create table if not exists public.job_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.background_jobs (id) on delete cascade,
  attempt_number integer not null,
  worker_id text not null,
  status text not null check (status in ('succeeded', 'failed')),
  duration_ms integer,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  signature_verified boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- 7. Email Deliveries & Support Ticket Threaded Messages
create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  recipient_email text not null,
  template_key text not null,
  dedupe_key text not null unique,
  status text not null default 'disabled'
    check (status in ('disabled', 'queued', 'sent', 'bounced', 'complained', 'failed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_role text not null check (author_role in ('customer', 'support_agent', 'admin')),
  is_internal_note boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

-- 8. AI Usage Accounting & Operational Cost Budgets
create table if not exists public.ai_usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  workspace_id uuid references public.workspaces (id) on delete set null,
  report_type text not null,
  model_name text not null,
  prompt_version text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(10, 6) not null default 0,
  execution_mode text not null check (execution_mode in ('live_gemini', 'cached', 'template_fallback', 'demo')),
  created_at timestamptz not null default now()
);

create table if not exists public.cost_budgets (
  id uuid primary key default gen_random_uuid(),
  scope text not null unique check (scope in ('global_ai', 'global_providers')),
  daily_budget_usd numeric(10, 2) not null default 10.00,
  monthly_budget_usd numeric(10, 2) not null default 150.00,
  kill_switch_active boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 9. Referral & Affiliate Architecture (Commissions & Payouts Disabled Until Phase 7)
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  commission_percent numeric(5, 2) not null default 25.00,
  commission_months integer not null default 12,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes (id) on delete cascade,
  referred_user_id uuid not null unique references public.profiles (id) on delete cascade,
  consent_verified boolean not null default false,
  status text not null default 'attributed_pending_billing'
    check (status in ('attributed_pending_billing', 'rejected_self_referral', 'eligible', 'paid')),
  created_at timestamptz not null default now()
);

-- Enable RLS across all new tables
alter table public.profile_research_notes enable row level security;
alter table public.activity_events enable row level security;
alter table public.report_exports enable row level security;
alter table public.orders enable row level security;
alter table public.invoices enable row level security;
alter table public.provider_connections enable row level security;
alter table public.background_jobs enable row level security;
alter table public.job_attempts enable row level security;
alter table public.webhook_events enable row level security;
alter table public.email_deliveries enable row level security;
alter table public.support_messages enable row level security;
alter table public.ai_usage_records enable row level security;
alter table public.cost_budgets enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_attributions enable row level security;

-- Workspace isolation & admin RLS policies
create policy "notes_workspace_only" on public.profile_research_notes
  for all using (public.is_workspace_member(workspace_id)); -- Admins intentionally excluded from reading private user notes!

create policy "activity_events_workspace" on public.activity_events
  for all using (public.is_workspace_member(workspace_id) or public.is_admin());

create policy "report_exports_workspace" on public.report_exports
  for all using (public.is_workspace_member(workspace_id) or public.is_admin());

create policy "orders_own_or_admin" on public.orders
  for select using (user_id = auth.uid() or public.is_admin());

create policy "invoices_own_or_admin" on public.invoices
  for select using (user_id = auth.uid() or public.is_admin());

create policy "provider_connections_owner" on public.provider_connections
  for all using (user_id = auth.uid());

create policy "background_jobs_admin_only" on public.background_jobs
  for all using (public.is_admin());

create policy "job_attempts_admin_only" on public.job_attempts
  for all using (public.is_admin());

create policy "webhook_events_admin_only" on public.webhook_events
  for all using (public.is_admin());

create policy "email_deliveries_admin_only" on public.email_deliveries
  for select using (user_id = auth.uid() or public.is_admin());

create policy "support_messages_owner_or_admin" on public.support_messages
  for select using (
    (not is_internal_note and exists (
      select 1 from public.support_tickets t where t.id = support_messages.ticket_id and t.user_id = auth.uid()
    ))
    or public.is_admin()
  );

create policy "ai_usage_admin_or_own" on public.ai_usage_records
  for select using (user_id = auth.uid() or public.is_admin());

create policy "cost_budgets_admin_only" on public.cost_budgets
  for all using (public.is_admin());

create policy "referral_codes_own_or_admin" on public.referral_codes
  for all using (owner_user_id = auth.uid() or public.is_admin());

create policy "referral_attributions_admin_only" on public.referral_attributions
  for select using (public.is_admin());
