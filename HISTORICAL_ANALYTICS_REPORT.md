# Viewora — Historical Analytics & Durable Snapshot Architecture Report (Stage 44)

**Date:** 2026-11-26  
**Core Modules:** [src/lib/db/repositories/snapshots.repo.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/repositories/snapshots.repo.ts), [src/lib/db/repositories/jobs.repo.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/repositories/jobs.repo.ts), [src/app/api/jobs/run/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/jobs/run/route.ts), [Migration 6](file:///c:/Users/Scorpio/Videos/Instagram/prisma/migrations/20261126000001_profile_snapshots_rls/migration.sql)

---

## 1. Observed Snapshot Collection & Deduplication

Viewora strictly separates **genuinely observed timestamped checkpoints** from **calculated trends** and **NEVER fabricates backdated historical data prior to when collection began**:

- **Atomic Deduplication (`recordProfileSnapshotWithDedup`):**
  - Acquires a PostgreSQL transaction-scoped advisory lock (`pg_advisory_xact_lock(hashtext('viewora:snapshot:' || savedProfileId))`).
  - Verifies parent `saved_profiles` ownership inside `withUserRlsContext`.
  - Inspects the most recent snapshot for `(savedProfileId, providerId)` within `dedupeWindowMinutes` (default `60m`). If `followersCount` and `postsCount` are identical, returns `{ created: false, deduplicated: true }` without inflating historical rows.
- **Membership Lookback Enforcement (`listProfileSnapshotsWithEntitlement`):**
  - Enforces each customer plan's `historical_analytics_days` entitlement directly in the PostgreSQL `WHERE captured_at >= cutoff` clause (`null` = unlimited).
- **Honest Trend Calculation (`computeObservedHistoricalTrends`):**
  - Requires at least **2** genuine timestamped observations. When `< 2` exist, returns `status: 'insufficient_history'`, `direction: 'unavailable'`, and explicit disclosure text.
  - When `>= 2` exist, computes exact `followerGrowth` (`delta`, `percentChange`, `direction`), `engagementTrend`, and `postsDelta` across the earliest and latest observed timestamps.
- **Retention Pruning (`pruneExpiredProfileSnapshots`):**
  - Scoped to the owner's RLS context (`savedProfile: { userId }`) to purge expired rows cleanly.

---

## 2. Database-Level Row-Level Security Hardening (Migration 6)

During live PostgreSQL integration testing on `viewora_test`, our cross-tenant security probe caught that `public.profile_snapshots` did not yet have a database-level RLS policy (unlike `saved_profiles` and `provider_connections`). We immediately remediated this in true defense-in-depth:
1. Added explicit `savedProfile: { userId }` ownership checks to every function in `snapshots.repo.ts`.
2. Created additive, zero-downtime **Migration 6** (`20261126000001_profile_snapshots_rls`), enabling `ROW LEVEL SECURITY` on `public.profile_snapshots` with policy `profile_snapshots_workspace_isolation` (`EXISTS (SELECT 1 FROM public.saved_profiles sp WHERE sp.id = profile_snapshots.saved_profile_id AND app.is_workspace_member(sp.workspace_id))`).
3. Applied Migration 6 cleanly to both `viewora` and `viewora_test` (total RLS policies: **24**, table count unchanged at **58**).

---

## 3. Durable PostgreSQL Background Job Queue

- **Schema Backing:** Uses existing PostgreSQL `background_jobs` and `job_attempts` tables.
- **Idempotency (`enqueueDbBackgroundJob`):** Enforces unique `idempotency_key` deduplication (handling concurrent `P2002` races safely).
- **Concurrent Worker Leasing (`claimNextDbBackgroundJob`):** Uses `SELECT id FROM public.background_jobs WHERE ... FOR UPDATE SKIP LOCKED LIMIT 1` with automatic stale-lease recovery (`locked_at < now - leaseTimeoutSeconds`).
- **Retry, Backoff & Dead-Letter (`failDbBackgroundJob`):** Exponential backoff (`baseBackoffMs * 2^(attempts - 1)`), recording every attempt in `job_attempts` and moving exhausted jobs (`attempts >= maxAttempts`) to `dead_letter`.
- **Honest Scheduler Status (`/api/jobs/run`):** Protected by `CRON_SECRET` / admin session; reports `schedulerStatus: 'inactive'` while `BACKGROUND_JOBS_ENABLED=false` (never claims automated cron polling is active without an external scheduler).

---

## 4. Verification Results

- **Live PostgreSQL 14.25 Integration (`test:db` on `viewora_test`):**
  - Verified snapshot creation, identical-metric deduplication, 30-day vs 90-day SQL lookback entitlement filtering, exact trend delta computation (`+900` followers, `+5` posts), **AND** verified that both `listProfileSnapshotsWithEntitlement` and raw SQL under `viewora_test_app` return **0 rows** for another user's snapshots.
  - Verified concurrent `Promise.all([claimNextDbBackgroundJob('worker-a'), claimNextDbBackgroundJob('worker-b')])` claims a single job strictly once, schedules retry on failure, and completes cleanly.
