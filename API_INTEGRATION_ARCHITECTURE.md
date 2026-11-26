# Viewora — External API, AI, Email & Automation Integration Architecture (Updated Stage 50)

**Date:** 2026-11-26  
**Architecture Baseline:** Independent PostgreSQL 14.25 (58 tables, 6 migrations, 24 RLS policies) · Next.js 15.5 App Router · **Zero Supabase** · **All External Paid Providers Default-Off (`PROVIDER_*_ENABLED=false`)**

---

## 1. End-to-End Integration Architecture Layers

```text
[Customer UI / Admin Console]
        │  (CSRF origin check + Session cookie + RBAC / Entitlements)
        ▼
[Next.js Server Route Handlers]
  ├── /api/search, /api/dashboard/workspace (refresh_profile)
  ├── /api/meta/{oauth/start, oauth/callback, connections} & /api/webhooks/meta
  ├── /api/ai/{studio, report}
  ├── /api/webhooks/resend & /api/email/unsubscribe
  ├── /api/automation & /api/jobs/run (constant-time CRON_SECRET)
  └── /api/admin/{integrations, communications, actions, overview}
        │
        ▼
[Centralized Governance & Security Plane (src/lib/integrations/)]
  ├── catalog.ts & credentials.ts   (7 adapters, dual-key flags, placeholder rejection, secret/PII redaction)
  ├── router.ts                     (capability routing, COMMERCIAL_RIGHTS_BY_PROVIDER, tenant cache keys)
  ├── ssrf.ts                       (HTTPS port-443 host allowlists, 1 MB bounded JSON)
  ├── gateway.ts                    (timeouts, bounded retries, circuit breakers, Zod validation)
  ├── distributed-store.ts          (PG pg_advisory_xact_lock USD caps, durable kill switches, search_events)
  ├── financial-controls.ts         (integer micro-USD math, 50/75/90/100% alerts, reconciliation, 10-pt approval)
  └── cache-coordinator.ts          (ProcessLocalCoordinator + standby UpstashRedisCoordinator)
        │
        ▼
[Independent PostgreSQL 14.25 (Restricted viewora_app role, NOBYPASSRLS)]
  ├── Tenant RLS (24 policies): provider_connections (AES-256-GCM), profile_snapshots (Migration 6),
  │   saved_profiles, profile_research_notes, user_preferences._modules.{aiConversations,automation}
  ├── Durable Coordination: cost_budgets, operational_metrics, background_jobs (FOR UPDATE SKIP LOCKED),
  │   job_attempts, webhook_events, email_deliveries, ai_usage_records, api_usage_logs, system_settings
  └── Immutable Forensics: audit_logs (Migration 5 REVOKE + trg_audit_logs_immutable trigger)
```

---

## 2. Core Design Invariants

1. **Fail-Closed & Default-Off:** No external paid provider activates automatically when credentials appear; every provider requires an explicit server flag (`PROVIDER_*_ENABLED=true`) AND completion of the 10-point owner approval checklist.
2. **Strict Privacy & Provenance Separation:** Zero private Instagram account access, zero password collection, zero fabricated metrics/AI/email statuses, and private customer research notes stay isolated under RLS and excluded from external AI unless explicitly opted in.
3. **Unified Emergency Shutdown:** Activating Global or Per-Provider Emergency Halt in PostgreSQL `cost_budgets` blocks BOTH interactive gateway requests AND background workers immediately across all instances.
