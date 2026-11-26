# Viewora — Upstash Redis Distributed Coordination Activation Guide (Stage 67)

**Date:** 2026-11-26  
**Activation Status:** **STANDBY / UNCONFIGURED (`active: false`) — AWAITING OWNER MULTI-POD PROVISIONING**  
**Codebase Readiness:** `ProcessLocalCoordinator` (active single-node fallback) and mock-verified `UpstashRedisCoordinator` (`src/lib/integrations/cache-coordinator.ts`) are implemented and unit-tested; durable PostgreSQL `pg_advisory_xact_lock` already coordinates spend budgets, monthly AI quotas, and background job leases safely across instances.

---

## 1. Verified Upstash Redis Pricing Plans (2026 Published List)

| Plan | Verified Pricing `[Verified List]` | Included Limits | Best Fit for Viewora |
| :--- | :--- | :--- | :--- |
| **Free** | **\$0 / mo** | 250 MB storage · 500,000 cmds/mo · 10 GB bandwidth | **Staging Verification** |
| **Pay-As-You-Go (PAYG)** | **\$0.20 / 100,000 cmds** · \$0.25/GB storage (first 1 GB free) · 200 GB free bandwidth | Budget cap configurable | Early low-traffic multi-pod Production |
| **Fixed 250 MB / 1 GB** | **\$10 / mo** (250 MB) · **\$20 / mo** (1 GB) | Flat monthly predictability for continuous polling/rate limits | Steady commercial Production (≥ 2 replicas) |

---

## 2. Exact Staging & Production Provisioning Steps

1. Create a TLS-only regional Upstash Redis database in the **same geographic region** as Hosted Next.js compute (e.g., `eu-central-1` Frankfurt or `me-central-1` UAE) to minimize RTT (< 5 ms).
2. Enable **Eviction (`allkeys-lru`)** for cache keys while keeping a separate budget cap alert in Upstash console.
3. Inject `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` into the hosted secret manager (never `NEXT_PUBLIC_*`).
4. Confirm Admin Integration Center 2.0 transitions Redis telemetry from `standby` to `active` (`healthy`).

---

## 3. Post-Approval Staging Verification Checklist

1. **Distributed Provider & Customer Rate Limits:** Send concurrent bursts across 2 staging replicas and verify shared atomic sliding-window counters enforce identical limits.
2. **Tenant-Scoped Cache Isolation:** Confirm every cache key embeds `tenantId` / `workspaceId` (`viewora:cache:{tenant}:{provider}:{key}`) so cross-customer cache reads are impossible.
3. **Distributed Locks & In-Flight Deduplication:** Fire 5 identical simultaneous requests and verify only 1 outbound call executes while siblings coalesce cleanly.
4. **Circuit Breaker Coordination & Cache Invalidation:** Trip a simulated provider error burst on Replica A and verify Replica B observes `circuit: open` immediately; verify manual Refresh invalidates the tenant cache entry cleanly.
5. **Graceful Degradation:** Temporarily block Redis connectivity on staging and confirm Viewora degrades cleanly without crashing public routes or bypassing PostgreSQL spend caps.
