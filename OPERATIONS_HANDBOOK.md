# Viewora — Commercial Operations & Administration Handbook (Stage 60)

**Date:** 2026-11-26  
**Audience:** Managing Director, Super Administrators, Support Operations, and On-Call Engineering

---

## 1. Super Admin Console Operations (`/[locale]/admin`)

- **Permanent Baseline Account:** `Scorpio Marketing Agency` (`marketing@scorpio.consulting`, role `super_admin`, membership `agency`).
- **Built-In Safety Guardrails:**
  - **Last-Super-Admin Lock:** PostgreSQL `pg_advisory_xact_lock` prevents demoting or suspending the final active `super_admin` (`HTTP 409 Conflict`).
  - **Self-Suspension Block:** Administrators cannot suspend their own account (`HTTP 400`).
  - **Customer Privacy Wall:** Private customer `profile_research_notes` and private workspace content are **never** exposed in the Admin Console.
  - **Immutable Audit Trail:** Every role change, plan override, session revocation, beta invite issuance, and kill-switch toggle appends to append-only `public.audit_logs`.

---

## 2. Support Ticket & Feedback Triage Guide

1. Customer tickets and `/api/feedback` submissions persist to PostgreSQL `support_tickets`.
2. **Response Priority Targets:**
   - **Security / Billing / Account Lockout:** Acknowledge ≤ 2 hours, resolve ≤ 24 hours.
   - **Agency / Pro Customer Issues:** Acknowledge ≤ 8 business hours.
   - **Starter / Premium / Free / Feature Requests:** Acknowledge ≤ 24–48 business hours.
3. **Session Revocation Procedure:** If a customer reports suspected account compromise, open their **Customer Detail Drawer** in Admin Console → click **Revoke All Active Sessions** (confirmed dialog) → instruct the customer to reset their password via `/forgot-password`.

---

## 3. External API Cost Governance & Emergency Shutdown

1. Monitor daily and monthly spend in **Admin Console → Integration Center 2.0** (integer micro-USD accounting with automatic **50% / 75% / 90% / 100%** alerts).
2. **Emergency Halt Procedure (Zero-Redeploy Immediate Protection):**
   - To stop a single misbehaving or over-budget provider: click **Halt Provider** in Integration Center 2.0 (persists `cost_budgets.kill_switch_active = true`).
   - To stop ALL external APIs and background workers simultaneously: click **Halt All External APIs** (confirmed dialog).
   - Both interactive gateway calls and `POST /api/jobs/run` background workers immediately honor the PostgreSQL halt flag across every running container.

---

## 4. Provider Activation & Membership Administration

- **Activating Any External Provider:** Follow all 10 checks in [PROVIDER_ACTIVATION_CHECKLIST.md](file:///c:/Users/Scorpio/Videos/Instagram/PROVIDER_ACTIVATION_CHECKLIST.md) on Staging first, verify `runProviderAcceptanceSuite()` in `live_provider_verified` mode, then enable on Production.
- **Membership Overrides:** Plan adjustments made in Admin Console sync immediately with PostgreSQL `plan_entitlements` and record an immutable audit event. Keep `PAYMENTS_ENABLED=false` until Gate #10 & #13 are cleared.

---

## 5. Incident Response, Backup & Post-Launch Monitoring

- **Health Check:** Poll `GET /api/health` every 60 seconds; alert if HTTP ≠ `200` or DB probe latency > `1,000 ms` for 3 consecutive checks.
- **Database Backup & Restore:** Follow [DISASTER_RECOVERY_RUNBOOK.md](file:///c:/Users/Scorpio/Videos/Instagram/DISASTER_RECOVERY_RUNBOOK.md) — verify daily encrypted dumps and execute quarterly disposable restore drills.
- **Release Rollback:** Shift traffic to prior immutable container image (< 2 min) per [DEPLOYMENT_RUNBOOK.md](file:///c:/Users/Scorpio/Videos/Instagram/DEPLOYMENT_RUNBOOK.md).
- **Data Breach Protocol:** Immediately revoke affected tokens/sessions, halt external providers if implicated, preserve `audit_logs` + WORM archive, and notify legal counsel immediately to meet statutory UAE PDPL / GDPR (72-hour) reporting windows.
