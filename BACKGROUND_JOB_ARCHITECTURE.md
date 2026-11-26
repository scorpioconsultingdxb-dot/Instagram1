# Viewora — Durable Background Job & Scheduler Architecture (Stage 48.1 & 48.3)

**Date:** 2026-11-26  
**Core Modules:** [src/lib/jobs/queue.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/jobs/queue.ts), [src/lib/jobs/scheduler-auth.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/jobs/scheduler-auth.ts), [src/lib/db/repositories/jobs.repo.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/repositories/jobs.repo.ts), [src/app/api/jobs/run/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/jobs/run/route.ts)

---

## 1. Supported Job Categories (All 12+ Stage 48 Categories)

`profile_refresh`, `authorized_profile_refresh`, `business_analytics_refresh`, `historical_snapshot`, `competitor_refresh`, `report_generation`, `ai_report_generation`, `ai_research_processing`, `pdf_export`, `csv_export`, `email_delivery`, `weekly_summary`, `research_reminder`, `membership_usage_notification`, `usage_reset`, `retention_cleanup`, `data_retention_cleanup`, `expired_token_cleanup`, `provider_health_check`, `automation_rule_run`.

---

## 2. Durable PostgreSQL Execution Guarantees

- **Idempotency (`enqueueDbBackgroundJob`):** Unique `background_jobs.idempotency_key` prevents duplicate job creation (handling concurrent `P2002` races safely) so retries never duplicate usage charges, reports, or notifications.
- **Atomic Leasing & Stale-Lease Recovery (`claimNextDbBackgroundJob`):** Uses `SELECT id FROM public.background_jobs WHERE (status = 'queued' AND run_after <= now) OR (status = 'running' AND locked_at < staleCutoff) ORDER BY run_after ASC, created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1`.
- **Bounded Retries, Exponential Backoff & Dead-Letter (`failDbBackgroundJob`):** Records every attempt in `job_attempts`, schedules `baseBackoffMs * 2^(attempts - 1)`, and moves exhausted jobs to `dead_letter`.
- **Cancellation & Per-Provider Concurrency + Emergency Halt Respect:** `cancelDbBackgroundJob()` cancels queued/running jobs cleanly; `canWorkerExecuteExternalJob()` checks BOTH per-provider concurrency caps AND durable PostgreSQL `cost_budgets.kill_switch_active` (`global_api` + `provider:<id>`), ensuring background workers respect the exact same emergency halts as interactive requests!

---

## 3. Hardened `POST /api/jobs/run` Endpoint

- Strictly inactive by default (`BACKGROUND_JOBS_ENABLED=false` → HTTP `503 schedulerStatus: 'inactive'`).
- Constant-time `crypto.timingSafeEqual` verification of `Bearer <CRON_SECRET>` (`verifyConstantTimeSchedulerSecret`, requiring `>= 16` chars).
- Zod-validated bounded batch (`batchSize: 1..10`, `maxDurationMs: 1000..25000`), replay deduplication via `runId`, sliding-window rate limit (`20/min`), and sanitized responses (zero secret leakage).
- **Live PostgreSQL Verification (`test:db` #8–#9 on `viewora_test`):** Proven concurrent single-claim `FOR UPDATE SKIP LOCKED`, retry + completion, cancellation, and kill-switch worker blocking.
