# Viewora — External Cron & Background Scheduler Activation Guide (Stage 67)

**Date:** 2026-11-26  
**Activation Status:** **INACTIVE (`BACKGROUND_JOBS_ENABLED=false`) — AWAITING OWNER STAGING APPROVAL & EXTERNAL CRON SETUP**  
**Codebase Readiness:** Durable PostgreSQL job queue (`background_jobs`, `job_attempts`) with atomic `FOR UPDATE SKIP LOCKED` leasing, `idempotency_key` deduplication, stale-lease recovery, exponential backoff, dead-letter handling, worker Emergency Halt checks (`canWorkerExecuteExternalJob()`), and hardened constant-time `CRON_SECRET` endpoint (`POST /api/jobs/run`) are **all implemented and live-PG verified**.

---

## 1. Secure External Cron Configuration Blueprint

Configure a managed external scheduler (Render Cron Job, DigitalOcean Functions/App Job, GitHub Actions/Cloudflare Worker Cron, or AWS EventBridge) to invoke:

```bash
curl -fsS -X POST "https://<domain>/api/jobs/run" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -H "X-Viewora-Cron-Timestamp: $(date -u +%s)" \
  -d '{"maxJobs": 10}'
```

**Mandatory Security Requirements:**
- `CRON_SECRET` must be ≥ 32 random bytes (`openssl rand -hex 32`), unique per environment, stored exclusively in secret managers.
- `POST /api/jobs/run` rejects missing/invalid Bearer tokens using constant-time comparison (`crypto.timingSafeEqual`), enforces replay/rate limits, and returns `503` while `BACKGROUND_JOBS_ENABLED !== 'true'`.

---

## 2. Supported Job Categories & Idempotency Verification Matrix

| Job Category | Schedule Cadence | Idempotency / Deduplication Protection | Emergency Halt Honored? |
| :--- | :---: | :--- | :---: |
| **Profile Refresh** | Hourly / Rule-based | `idempotency_key = profile_refresh:{workspace}:{handle}:{hour}` | **YES** (blocked immediately) |
| **Historical Snapshots** | Daily UTC | `recordProfileSnapshotWithDedup()` prevents duplicate same-day points | **YES** |
| **Research Reminders** | Every 15 min | `idempotency_key = reminder:{reminderId}` + `sent_at` guard | **YES** |
| **Scheduled Report Generation** | Weekly / Rule-based | `idempotency_key = report:{ruleId}:{periodKey}` | **YES** |
| **Transactional Email Delivery** | Every 1–5 min | `email_deliveries` unique delivery key + suppression check | **YES** |
| **Weekly Summaries** | Weekly Mon 08:00 UTC | `idempotency_key = weekly_summary:{userId}:{isoWeek}` | **YES** |
| **Data Retention Cleanup** | Daily 03:00 UTC | `executeDataRetentionCleanup()` — **permanently preserves `audit_logs` (`auditLogsDeleted: 0`)** | **N/A** (internal DB maintenance) |

---

## 3. Post-Approval Staging Acceptance Tests

1. Enable `BACKGROUND_JOBS_ENABLED=true` on Staging with a 5-minute external cron trigger.
2. Enqueue duplicate jobs with the same `idempotency_key` and confirm only **one** execution runs and **zero** duplicate customer records or API charges are created.
3. Simulate a mid-lease worker crash and confirm stale-lease recovery re-leases the job cleanly after timeout without double-charging.
4. Trigger **Global Emergency Halt** in Admin Integration Center 2.0 and confirm the next `POST /api/jobs/run` tick skips all external-provider jobs immediately and logs the halt state cleanly.
