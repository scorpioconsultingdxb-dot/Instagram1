# Viewora — Workflow & Automation Architecture (Stage 27)

## Overview

The Workflow & Automation Center (`/[locale]/dashboard/automation`) pairs user-configurable internal workspace automation rules and reminder tasks with Viewora's idempotent `JobQueueEngine` (`src/lib/jobs/queue.ts`).

## Execution Architecture

1. **Background Job Queue (`src/lib/jobs/queue.ts`):**
   - Atomic job claiming (`claimNext`) with concurrency caps (`maxConcurrent`).
   - Idempotency keys (`auto:<userId>:<ruleId>:<slot>`) preventing duplicate execution.
   - Retry limits (`maxAttempts`) with exponential backoff (`base * 2^(attempts - 1)`) and `dead_letter` transitions.
   - Explicit job cancellation (`cancel(jobId, reason)`) and worker heartbeats (`recordHeartbeat()`).
2. **Internal Workflow Rules & Templates (`src/lib/automation/service.ts` & `templates.ts`):**
   - Built-in templates: Weekly Research Review Reminder, Monthly Client Report Preparation, Project Deadline Follow-Up Task.
   - Supports trigger, condition, action (`create_internal_notification`, `create_research_followup_task`, `queue_report_prep_reminder`), schedule cadence (`manual`, `daily`, `weekly`, `monthly`), user timezone, enable/disable toggle, and immutable execution audit history.
3. **Honest External Trigger Boundaries:**
   - Triggers requiring external credentials (`external_email_alert_inactive`, `live_instagram_monitor_inactive`) are explicitly marked `requiresExternalAuth: true` and **cannot** be enabled or simulated. Running one logs `blocked_external_inactive` honestly rather than faking external delivery.

## Verification Status

**Implemented & Locally Tested** (Vitest unit & integration tests + Headless Chrome execution audit verification). Scheduled cron worker execution in a live multi-instance production deployment remains **Pending Infrastructure** (documented in `DEVELOPMENT_BACKLOG.md`).
