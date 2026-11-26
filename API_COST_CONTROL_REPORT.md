# Viewora — API Cost Control & Usage Governance Report (Updated Phase 5 — Stages 42–45)

**Date:** 2026-11-26  
**Current Paid External Spend:** **\$0.00** (all paid/external providers disabled by default: `PROVIDER_*_ENABLED=false`)

---

## 1. Six-Layer Cost Protection Architecture

Viewora protects against runaway external API spend through six stacked enforcement layers:

| Layer | Control | Coordination Scope | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **1. Default-Off Feature Flags** | Every external provider (`meta_official`, `authorized_insights`, `licensed_third_party`, `permitted_public_dataset`, `gemini_ai`, `resend_email`) defaults to `false`. | Environment / Deployment | [env.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/env.ts), [credentials.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/credentials.ts) |
| **2. Durable PostgreSQL Emergency Kill Switches** | Global (`global_api`) and per-provider (`provider:<id>`) emergency shutdown flags persisted in PostgreSQL `cost_budgets.kill_switch_active`, toggleable via confirmed Super Admin UI action + immutable audit log. | **PostgreSQL Durable (Multi-Instance)** | [distributed-store.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/distributed-store.ts), [/api/admin/actions](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/admin/actions/route.ts) |
| **3. Atomic PostgreSQL Daily & Monthly USD Caps** | `reserveDistributedApiBudget()` serializes concurrent spend reservations with `pg_advisory_xact_lock`, enforcing `API_DAILY_COST_CAP_USD` (default `\$15`) and `API_MONTHLY_COST_CAP_USD` (default `\$200`) across `cost_budgets` + `operational_metrics`. | **PostgreSQL Durable (Multi-Instance Atomic)** | [distributed-store.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/distributed-store.ts), [gateway.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/gateway.ts) |
| **4. Durable Customer Membership Quotas** | Authenticated searches count UTC-day rows in PostgreSQL `search_events` (`countDbDailyCustomerSearches`) to enforce per-plan `daily_searches` (`HTTP 429 DAILY_SEARCH_LIMIT_REACHED`); AI reports enforce monthly `ai_profile_reports` quotas and fallback to \$0 deterministic templates for demo profiles. | **PostgreSQL Durable (Multi-Instance)** | [/api/search](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/search/route.ts), [gemini.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/ai/gemini.ts) |
| **5. Server-Side TTL Cache & In-Flight Coalescing** | Identical lookups within `PROVIDER_CACHE_TTL_SECONDS` return cached payloads at **\$0 incremental cost**; tenant-scoped cache keys isolate authorized owner responses. | Process-Local (Redis standby adapter prepared) | [gateway.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/gateway.ts), [router.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/router.ts) |
| **6. Per-Provider Rate Limits & Circuit Breakers** | Per-minute request caps (`20–30 req/min`) and circuit breakers (`3` consecutive failures → `60s` cooldown) stop retry storms against degraded upstream providers. | Process-Local (Redis standby adapter prepared) | [gateway.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/gateway.ts) |

---

## 2. Live Verification & Honest Scaling Notes

- **Live PostgreSQL Concurrency Proof (`test:db` on `viewora_test`):** Two concurrent `\$0.70` reservations against a `\$1.00` global daily cap serialized cleanly via `pg_advisory_xact_lock` — strictly **1 allowed, 1 rejected**. Persistent per-provider kill switch blocked spend immediately with `backend: 'postgresql'`.
- **Super Admin Integration Center (`test:e2e:pg`):** Verified `COORDINATION: POSTGRESQL DURABLE`, `REDIS: STANDBY / INACTIVE`, `ALL PAID APIS DISABLED`, live spend vs caps (`\$0.00 / \$15.00` daily, `\$0.00 / \$200.00` monthly), persisted 24h calls/errors (`0 / 0`), and interactive **Halt All** + per-provider **Emergency Halt** controls.
- **Horizontal Multi-Pod Note:** Durable spend caps, kill switches, API error logs, and customer daily search quotas are already multi-instance safe via PostgreSQL. Per-minute sliding-window rate limits and short-TTL response caches remain process-local until optional Upstash Redis (`UPSTASH_REDIS_REST_URL`) is provisioned in hosted staging/production.
