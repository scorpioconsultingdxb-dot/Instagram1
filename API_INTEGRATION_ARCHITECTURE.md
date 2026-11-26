# Viewora — Platform Integration, Billing, SEO & Launch Architecture (Updated Stage 60)

**Date:** 2026-11-26  
**Architecture Baseline:** Independent PostgreSQL 14.25 (58 tables, 6 migrations, 74 FKs, 147 indexes, 24 RLS policies) · Managed PostgreSQL 16/17 LTS recommended for hosted Staging/Production · Next.js `15.5.29` App Router · **Zero Supabase** · **Zero Workspace CVEs (`0/401`)** · **All External Paid Providers, Billing & Public Beta Default-Off**

---

## 1. End-to-End Platform Architecture Layers (Stages 41–60)

```text
[Public SEO & Launch Layer (322 Zero-DB Static Pages · 5 Locales)]
  ├── /[locale]/launch (Brand positioning + honest availability matrix)
  ├── /[locale]/beta   (noIndex: true · Invitation-only closed beta shell)
  ├── /robots.ts (Auth/admin/checkout/beta disallowed) & /sitemap.ts (135 hreflang URLs)
  └── JSON-LD Metadata (SoftwareApplication + BreadcrumbList — zero fabricated ratings)
         │
         ▼
[Authenticated Customer, Beta & Admin Server Route Handlers]
  ├── /api/search, /api/dashboard/workspace (refresh_profile, saved profiles, notes)
  ├── /api/meta/{oauth/start, oauth/callback, connections} & /api/webhooks/meta
  ├── /api/ai/{studio, report} · /api/reports/builder (binary %PDF-1.4 & CSV)
  ├── /api/webhooks/resend & /api/email/unsubscribe
  ├── /api/automation & /api/jobs/run (constant-time CRON_SECRET)
  ├── /api/beta (SHA-256 hashed invites · HTTP 403 BETA_CLOSED default)
  └── /api/admin/{integrations, communications, actions, overview}
         │
         ▼
[Centralized Governance, Acceptance, Billing & Commercial Plane]
  ├── src/lib/integrations/  (7-adapter catalog, SSRF port-443 allowlists, 1 MB JSON ceiling,
  │                           ExternalApiGateway, micro-USD budgets, 50/75/90/100% alerts,
  │                           durable kill switches, 10-pt approval, Upstash Redis standby)
  ├── src/lib/providers/acceptance.ts   (fixture_contract_test vs. live_provider_verified suite)
  ├── src/lib/billing/lifecycle.ts      (PaymentGatewayAdapter, DisabledPaymentGateway, 7-day grace,
  │                                      integer-cent published quotes & proration — zero Stripe SDK)
  ├── src/lib/commercial/financial-model.ts (100–10,000 planning model + tier unit sustainability)
  └── src/lib/beta/service.ts           (SHA-256 invites, 5 cohorts, S0–S3 defect taxonomy)
         │
         ▼
[Independent PostgreSQL (Restricted viewora_app role, NOBYPASSRLS)]
  ├── Tenant RLS (24 policies): provider_connections (AES-256-GCM), profile_snapshots (Migration 6),
  │   saved_profiles, profile_research_notes, user_preferences._modules.{aiConversations,automation}
  ├── Durable Coordination: cost_budgets, operational_metrics, background_jobs (FOR UPDATE SKIP LOCKED),
  │   job_attempts, webhook_events, email_deliveries, ai_usage_records, api_usage_logs, system_settings
  └── Immutable Forensics: audit_logs (Migration 5 REVOKE + trg_audit_logs_immutable trigger)
```

---

## 2. Core Non-Negotiable Architecture Invariants

1. **Fail-Closed & Default-Off:** No external paid provider, payment gateway, or public beta registration activates automatically when keys appear; every activation requires explicit server flags AND owner governance sign-off.
2. **Strict Honesty & Data Provenance:** Zero scraping, zero private Instagram access, zero password collection, zero fabricated social/AI/email/revenue/testimonial metrics, and explicit separation of `fixture_contract_test` vs. `live_provider_verified` and `planning_model_assumption_not_actuals` vs. actual commercial metrics.
3. **Unified Emergency Shutdown:** Durable PostgreSQL Global and Per-Provider Emergency Halts immediately block both interactive gateway calls and background workers across all stateless replicas without redeployment.
