# Viewora — Production Operations & Administration Handbook (Updated Stage 70)

**Date:** 2026-11-26  
**Audience:** Managing Director, Super Administrators, Customer Support Lead, and On-Call Engineering

---

## 1. Super Admin Console Operations (`/[locale]/admin`)

- **Permanent Operational Baseline Account:** `Scorpio Marketing Agency` (`marketing@scorpio.consulting`, role `super_admin`, membership `agency`).
- **Enforced Safety Controls:**
  - **Last-Super-Admin Lock:** PostgreSQL `pg_advisory_xact_lock` blocks demoting or suspending the final active `super_admin` (`HTTP 409 Conflict`).
  - **Self-Suspension Block:** Administrators cannot suspend their own account (`HTTP 400`).
  - **Customer Privacy Wall:** Private customer `profile_research_notes` and workspace files are strictly excluded from all Admin views.
  - **Immutable Forensics:** Every role change, membership override, session revocation, beta invite issuance, and Emergency Halt mutation appends to immutable `public.audit_logs` (Migration 5 + planned WORM archival).

---

## 2. Customer Support & Incident Triage Runbook

| Severity / Queue | Target First Response | Target Resolution / Containment | Escalation Path |
| :--- | :---: | :---: | :--- |
| **S0 — Security / Tenant Isolation / Runaway API Cost** | **≤ 15 minutes** | **Immediate Emergency Halt** (`cost_budgets.kill_switch_active`) | On-Call Engineering + Managing Director + Legal Counsel (if breach) |
| **S1 — Login / Data Loss / Broken Report Export / Billing** | **≤ 2 hours** | **≤ 24 hours** (rollback container if deploy-induced) | Engineering Lead |
| **S2 — Agency / Pro Support Tickets** | **≤ 8 business hours** | **≤ 48 hours** | Support Ops |
| **S3 — Starter / Premium / Free / Feature Requests (`/api/feedback`)** | **≤ 24–48 business hours** | Backlog prioritization | Product / Support |

- **Compromised Customer Account Procedure:** Admin Console → Customer Detail Drawer → **Revoke All Active Sessions** → notify user to trigger `/forgot-password` → review `audit_logs`.

---

## 3. External Provider Governance & Emergency Shutdown

1. Monitor daily/monthly integer micro-USD spend and **50% / 75% / 90% / 100%** utilization alerts in **Admin Console → Integration Center 2.0**.
2. **Instant Emergency Halt (Zero Redeploy):** Click **Halt Provider** or **Halt All External APIs** in Integration Center 2.0. PostgreSQL persists `kill_switch_active = true`, halting BOTH interactive gateway calls and `POST /api/jobs/run` background workers immediately across all containers.
3. **Provider Activation Sequence:** Follow [RESEND_ACTIVATION_GUIDE.md](file:///c:/Users/Scorpio/Videos/Instagram/RESEND_ACTIVATION_GUIDE.md) → [GEMINI_ACTIVATION_GUIDE.md](file:///c:/Users/Scorpio/Videos/Instagram/GEMINI_ACTIVATION_GUIDE.md) → [META_ACTIVATION_GUIDE.md](file:///c:/Users/Scorpio/Videos/Instagram/META_ACTIVATION_GUIDE.md) → [REDIS_ACTIVATION_GUIDE.md](file:///c:/Users/Scorpio/Videos/Instagram/REDIS_ACTIVATION_GUIDE.md) → [SCHEDULER_ACTIVATION_GUIDE.md](file:///c:/Users/Scorpio/Videos/Instagram/SCHEDULER_ACTIVATION_GUIDE.md) on Staging before Production.

---

## 4. Backup, Release Rollback & Breach Response

- **Health Monitoring:** Poll `GET /api/health` every 60 seconds; alert on HTTP ≠ `200` or DB latency > `1,000 ms` across 3 consecutive checks.
- **Release Rollback:** Shift edge traffic to previous immutable container image (< 2 minutes); additive migrations preserve N-1 backward compatibility.
- **Disaster Recovery:** Follow [BACKUP_RESTORE_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/BACKUP_RESTORE_REPORT.md) and [DISASTER_RECOVERY_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/DISASTER_RECOVERY_REPORT.md) (`RPO ≤ 5 min PITR`, `RTO ≤ 60 min full restore`).
- **Statutory Data Breach Escalation:** Preserve `audit_logs` + WORM archive, contain compromised credentials/sessions, and notify qualified legal counsel immediately to meet GDPR (72-hour) and UAE PDPL reporting duties.
