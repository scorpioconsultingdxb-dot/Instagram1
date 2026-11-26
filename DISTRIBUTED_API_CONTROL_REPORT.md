# Viewora — Distributed API Control & Multi-Instance Coordination Report

**Date:** 2026-11-26  
**Core Modules:** [src/lib/integrations/distributed-store.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/distributed-store.ts), [src/lib/integrations/gateway.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/gateway.ts), [src/app/api/search/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/search/route.ts), [src/app/api/admin/actions/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/admin/actions/route.ts)

---

## 1. Honest Architectural Distinction: PostgreSQL Durable vs. Process-Local Controls

Viewora strictly refuses to misrepresent process-local in-memory state as distributed coordination. Every control is categorized accurately below:

| Control | Backing Store Today | Multi-Instance Safe? | Exact Implementation & Table(s) |
| :--- | :--- | :--- | :--- |
| **Daily & Monthly USD API Spend Caps** | **PostgreSQL Durable** (falls back to process-local only if DB unconfigured) | **YES — Atomic** | `reserveDistributedApiBudget()` acquires `pg_advisory_xact_lock(hashtext('viewora:distributed_api_budget'))`, reads `cost_budgets` + aggregates `operational_metrics` (`metric_name = 'api_spend_usd'`), and atomically inserts the reserved spend inside one transaction. |
| **Global & Per-Provider Emergency Kill Switches** | **PostgreSQL Durable** | **YES — Immediate** | `setPersistentEmergencyKillSwitch()` upserts `cost_budgets.kill_switch_active` for `global_api` or `provider:<id>`, wired to Super Admin `toggle_api_kill_switch` action + immutable `audit_logs`. |
| **Customer Daily Search Quotas (`daily_searches`)** | **PostgreSQL Durable** | **YES — Durable** | `countDbDailyCustomerSearches()` queries live UTC-day rows in `search_events` for the authenticated `userId` in `/api/search`. |
| **External API Usage & Error Telemetry** | **PostgreSQL Durable** | **YES — Durable** | `recordPersistentApiUsageLog()` inserts secret- and PII-redacted records into `api_usage_logs`; `loadPersistentIntegrationTelemetry()` aggregates real 24h calls, errors, spend, and recent errors. |
| **Background Job Leasing & Idempotency** | **PostgreSQL Durable** | **YES — Atomic** | `background_jobs` (`idempotency_key` UNIQUE + `FOR UPDATE SKIP LOCKED` lease claiming) + `job_attempts`. |
| **Webhook Replay Deduplication** | **PostgreSQL Durable** | **YES — Atomic** | `webhook_events` (`provider_id`, `external_event_id` unique check) in `/api/webhooks/meta`. |
| **Short-TTL Response Cache & In-Flight Coalescing** | **Process-Local Memory** | **Single-Instance** (Redis standby adapter prepared) | `ExternalApiGateway.cache` / `inflight` Map with tenant-scoped keys (`buildTenantScopedCacheKey`). |
| **Per-Minute Provider Rate Limits & Circuit Breakers** | **Process-Local Memory** | **Single-Instance** (Redis standby adapter prepared) | `ExternalApiGateway.rateWindows` / `circuits` Map. |

---

## 2. Optional Redis Adapter Readiness (Strictly Inactive)

- `getOptionalRedisAdapterStatus()` detects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- Currently reports **`Redis: Standby / Inactive`** inside the Super Admin Integration Center while PostgreSQL handles all durable financial, kill-switch, quota, webhook, and job coordination.
- Before deploying multiple horizontally scaled Next.js containers under high live external traffic, connect Upstash Redis to share per-minute sliding-window rate limits, circuit-breaker states, and short-TTL response caches across pods.

---

## 3. Live PostgreSQL Concurrency Verification (`test:db` on `viewora_test`)

1. **Persistent Kill Switch Enforcement:** Toggled `licensed_third_party` kill switch to `active: true` in PostgreSQL `cost_budgets` → `reserveDistributedApiBudget()` immediately rejected with `allowed: false, backend: 'postgresql', reason: /kill switch/i`.
2. **Concurrent Atomic Budget Race:** Set global daily budget cap to `\$1.00`, then fired two simultaneous `\$0.70` reservations via `Promise.all(...)` → `pg_advisory_xact_lock` serialized both transactions cleanly: **strictly 1 allowed (`\$0.70`), 1 rejected (`budget_exceeded`)**, proving daily spend can never race past the cap across concurrent pods.
3. **Live Integration Center Telemetry (`test:e2e:pg`):** Verified `GET /api/admin/integrations` returns `distributedTelemetry.backend === 'postgresql'` and renders `COORDINATION: POSTGRESQL DURABLE` alongside interactive **Halt All** and per-provider **Emergency Halt** buttons protected by `ConfirmDialog`.
