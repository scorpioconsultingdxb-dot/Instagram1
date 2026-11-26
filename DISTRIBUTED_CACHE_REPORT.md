# Viewora — Distributed Cache, Rate-Limiting & Coordination Report (Stage 48.4)

**Date:** 2026-11-26  
**Core Modules:** [src/lib/integrations/cache-coordinator.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/cache-coordinator.ts), [src/lib/integrations/distributed-store.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/distributed-store.ts)

---

## 1. Honest Scope Classification (No Process-Local Controls Mislabeled as Distributed)

| Coordination Capability | Active Implementation Today | Multi-Instance Safe? | Redis Upgrade Path |
| :--- | :--- | :---: | :--- |
| **USD Spend Caps & Budget Reservations** | PostgreSQL `cost_budgets` + `operational_metrics` (`pg_advisory_xact_lock`) | **YES — Globally Atomic** | Already PostgreSQL-durable |
| **Global & Per-Provider Emergency Halts** | PostgreSQL `cost_budgets.kill_switch_active` + `system_settings` metadata | **YES — Globally Immediate** | Already PostgreSQL-durable |
| **Customer Daily Search & Monthly AI Quotas** | PostgreSQL `search_events` & `ai_usage_records` (`pg_advisory_xact_lock`) | **YES — Globally Durable** | Already PostgreSQL-durable |
| **Background Job Leasing & Webhook Deduplication** | PostgreSQL `background_jobs` (`FOR UPDATE SKIP LOCKED`) & `webhook_events` | **YES — Globally Atomic** | Already PostgreSQL-durable |
| **Short-TTL Response Cache & In-Flight Deduplication** | `ProcessLocalCoordinator` / `ExternalApiGateway.cache` (`scope: 'process_local'`) | **Single-Instance** | `UpstashRedisCoordinator` (`SET EX`, `GET`, `DEL`) |
| **Per-Minute Provider Rate Limits & Circuit Breakers** | `ProcessLocalCoordinator` / `ExternalApiGateway.rateWindows` (`scope: 'process_local'`) | **Single-Instance** | `UpstashRedisCoordinator` (`INCR` + `EXPIRE`) |
| **Ephemeral Distributed Execution Locks** | `ProcessLocalCoordinator.acquireLock` (`scope: 'process_local'`) | **Single-Instance** | `UpstashRedisCoordinator` (`SET NX EX`) |

---

## 2. Upstash Redis Coordinator Contract Verification

- `UpstashRedisCoordinator` remains **strictly inactive** (`active: false`) until `UPSTASH_REDIS_REST_URL` (`https://...`) and `UPSTASH_REDIS_REST_TOKEN` are explicitly approved and configured by the owner.
- **Isolated Fixture Contract Test (`phase5-stages-46-to-50.test.ts`):** Verified `INCR`/`EXPIRE` rate-limit blocking on 3rd call against limit `2`, `SET EX`/`GET`/`DEL` cache lifecycle + invalidation, and `SET NX EX` lock exclusivity + release against an isolated mock REST endpoint without making any live network calls.
