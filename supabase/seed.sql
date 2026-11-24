-- ============================================================================
-- Viewora Seed Data (Idempotent)
-- Populates: 5 Initial Pricing Plans (Demo Only), Billing Interval Discounts,
-- Centralized Plan Entitlements, Feature Flags (Payments Disabled),
-- Default A/B Experiment & Localized Disclosures.
-- ============================================================================

-- 1. Initial 5 Plans (Demo pricing only; payments disabled)
insert into public.plans (code, name, description, monthly_price_cents, target_segment, display_order, is_active, is_demo_pricing)
values
  ('free', 'Free', 'Public profile search and essential free Instagram analytics tools.', 0, 'personal', 1, true, true),
  ('starter', 'Starter', 'Saved public profiles, extended daily searches, and basic historical tracking.', 999, 'personal', 2, true, true),
  ('premium', 'Premium', 'Historical public trends, competitor comparisons, CSV exports, and AI profile summaries.', 1999, 'business', 3, true, true),
  ('pro', 'Pro', 'Deep competitor monitoring, PDF/CSV reports, email alerts, and influencer research tools.', 3999, 'business', 4, true, true),
  ('agency', 'Agency', 'Multiple client workspaces, team seats, client-ready exports, and highest tracking quotas.', 9999, 'agency', 5, true, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  monthly_price_cents = excluded.monthly_price_cents,
  target_segment = excluded.target_segment,
  display_order = excluded.display_order,
  is_demo_pricing = excluded.is_demo_pricing;

-- 2. Configurable Billing Intervals (Monthly 0%, Quarterly 15%, Annual 30%)
insert into public.plan_billing_options (plan_id, billing_interval, discount_percent, is_active)
select p.id, v.billing_interval, v.discount_percent, true
from public.plans p
cross join (
  values
    ('monthly', 0.00),
    ('quarterly', 15.00),
    ('annual', 30.00)
) as v(billing_interval, discount_percent)
on conflict (plan_id, billing_interval) do update set
  discount_percent = excluded.discount_percent,
  is_active = excluded.is_active;

-- 3. Centralized Entitlements per Plan
with entitlement_matrix (plan_code, feature_key, enabled, numeric_limit) as (
  values
    -- Free ($0)
    ('free', 'daily_searches', true, 5),
    ('free', 'tracked_profiles', true, 1),
    ('free', 'historical_analytics_days', false, 0),
    ('free', 'follower_trends', false, 0),
    ('free', 'competitor_monitoring', false, 0),
    ('free', 'ai_profile_reports', false, 0),
    ('free', 'influencer_research', false, 0),
    ('free', 'email_notifications', false, 0),
    ('free', 'csv_export', false, 0),
    ('free', 'pdf_export', false, 0),
    ('free', 'workspaces', true, 1),
    ('free', 'team_seats', true, 1),
    ('free', 'agency_dashboard', false, 0),

    -- Starter ($9.99)
    ('starter', 'daily_searches', true, 25),
    ('starter', 'tracked_profiles', true, 5),
    ('starter', 'historical_analytics_days', true, 30),
    ('starter', 'follower_trends', true, 30),
    ('starter', 'competitor_monitoring', false, 0),
    ('starter', 'ai_profile_reports', true, 3),
    ('starter', 'influencer_research', false, 0),
    ('starter', 'email_notifications', true, 5),
    ('starter', 'csv_export', true, null),
    ('starter', 'pdf_export', false, 0),
    ('starter', 'workspaces', true, 1),
    ('starter', 'team_seats', true, 1),
    ('starter', 'agency_dashboard', false, 0),

    -- Premium ($19.99)
    ('premium', 'daily_searches', true, 100),
    ('premium', 'tracked_profiles', true, 15),
    ('premium', 'historical_analytics_days', true, 90),
    ('premium', 'follower_trends', true, 90),
    ('premium', 'competitor_monitoring', true, 5),
    ('premium', 'ai_profile_reports', true, 15),
    ('premium', 'influencer_research', true, 25),
    ('premium', 'email_notifications', true, 20),
    ('premium', 'csv_export', true, null),
    ('premium', 'pdf_export', true, null),
    ('premium', 'workspaces', true, 2),
    ('premium', 'team_seats', true, 2),
    ('premium', 'agency_dashboard', false, 0),

    -- Pro ($39.99)
    ('pro', 'daily_searches', true, 300),
    ('pro', 'tracked_profiles', true, 50),
    ('pro', 'historical_analytics_days', true, 365),
    ('pro', 'follower_trends', true, 365),
    ('pro', 'competitor_monitoring', true, 20),
    ('pro', 'ai_profile_reports', true, 60),
    ('pro', 'influencer_research', true, 100),
    ('pro', 'email_notifications', true, 100),
    ('pro', 'csv_export', true, null),
    ('pro', 'pdf_export', true, null),
    ('pro', 'workspaces', true, 5),
    ('pro', 'team_seats', true, 5),
    ('pro', 'agency_dashboard', false, 0),

    -- Agency ($99.99)
    ('agency', 'daily_searches', true, 1000),
    ('agency', 'tracked_profiles', true, 250),
    ('agency', 'historical_analytics_days', true, 730),
    ('agency', 'follower_trends', true, 730),
    ('agency', 'competitor_monitoring', true, 100),
    ('agency', 'ai_profile_reports', true, 250),
    ('agency', 'influencer_research', true, 500),
    ('agency', 'email_notifications', true, null),
    ('agency', 'csv_export', true, null),
    ('agency', 'pdf_export', true, null),
    ('agency', 'workspaces', true, 25),
    ('agency', 'team_seats', true, 20),
    ('agency', 'agency_dashboard', true, null)
)
insert into public.plan_entitlements (plan_id, feature_key, enabled, numeric_limit)
select p.id, em.feature_key, em.enabled, em.numeric_limit
from entitlement_matrix em
join public.plans p on p.code = em.plan_code
on conflict (plan_id, feature_key) do update set
  enabled = excluded.enabled,
  numeric_limit = excluded.numeric_limit;

-- 4. Feature Flags (Payments explicitly disabled and locked until authorization)
insert into public.feature_flags (key, description, enabled, locked)
values
  ('payments_enabled', 'Enables live Stripe checkout and billing. Must remain disabled until explicitly approved.', false, true),
  ('demo_provider_enabled', 'Enables clearly labeled demo fixture responses when live provider credentials are not configured.', true, false),
  ('ai_insights_enabled', 'Enables AI-generated profile summaries (uses deterministic template fallback when no API key is set).', true, false),
  ('story_viewer_tool', 'Exposes the Story Viewer tool with authorized-source availability and limitation disclosures.', true, false),
  ('ab_testing_enabled', 'Enables funnel conversion A/B experiments.', true, false)
on conflict (key) do nothing;

-- 5. Default Conversion Experiment
insert into public.experiments (key, name, description, variants, traffic_weights, status)
values (
  'homepage_preview_cta',
  'Homepage Premium Preview CTA Copy',
  'Compares clear feature-preview CTA wording on the search result preview card.',
  '["control", "benefit_focused"]'::jsonb,
  '[50, 50]'::jsonb,
  'active'
)
on conflict (key) do nothing;

-- 6. Initial Localized CMS Disclosures
insert into public.cms_content (slug, locale, content_type, title, body, is_published)
values
  ('data-transparency', 'en', 'disclosure', 'Data Transparency Notice', 'Viewora only displays legitimately available public Instagram information or clearly labeled estimates and demo fixtures. Private accounts are never accessed.', true),
  ('data-transparency', 'pt-BR', 'disclosure', 'Aviso de Transparência de Dados', 'O Viewora exibe apenas informações públicas do Instagram legitimamente disponíveis ou estimativas e dados de demonstração claramente identificados. Contas privadas nunca são acessadas.', true),
  ('data-transparency', 'es', 'disclosure', 'Aviso de Transparencia de Datos', 'Viewora solo muestra información pública de Instagram legítimamente disponible o estimaciones y datos de demostración claramente etiquetados. Nunca se accede a cuentas privadas.', true),
  ('data-transparency', 'de', 'disclosure', 'Hinweis zur Datentransparenz', 'Viewora zeigt ausschließlich rechtmäßig verfügbare öffentliche Instagram-Informationen sowie klar gekennzeichnete Schätzungen und Demo-Daten an. Auf private Konten wird niemals zugegriffen.', true),
  ('data-transparency', 'fr', 'disclosure', 'Avis de Transparence des Données', 'Viewora affiche uniquement des informations publiques Instagram légitimement disponibles ou des estimations et données de démonstration clairement identifiées. Les comptes privés ne sont jamais consultés.', true)
on conflict (slug, locale) do nothing;
