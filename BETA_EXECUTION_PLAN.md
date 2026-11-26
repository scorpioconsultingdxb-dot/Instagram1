# Viewora — Controlled 14-Day Invitation-Only Beta Execution Plan (Stage 69)

**Date:** 2026-11-26  
**Beta Registration Status:** **CLOSED (`BETA_PUBLIC_REGISTRATION_ENABLED=false`) — AWAITING OWNER AUTHORIZATION TO COMMENCE**  
**Zero Fabrication Policy:** Zero synthetic beta participants or fabricated feedback have been created.

---

## 1. Recommended Pilot Cohort Structure (25 Invited Participants — Subject to Owner Approval)

| Cohort Key | Segment | Proposed Seats | Primary Validation Focus |
| :--- | :--- | :---: | :--- |
| `personal` | Personal & Everyday Explorers | **5** | 12 Free Tools, registration, email verification, Personal Digital HQ 3.0, accessibility modes |
| `creator` | Independent Instagram Creators | **5** | Official Meta OAuth connection/disconnect, Profile Intelligence, AI Intelligence Studio |
| `marketing_pro` | In-House Marketing Professionals | **5** | Research Workspace Pro, Competitor Studio compatibility checks, CSV/PDF reports |
| `business` | SMB & Brand Managers | **5** | Observed Historical Analytics, Automation Center schedules, notification preferences |
| `agency` | Multi-Client Digital Agencies | **5** | Agency Center multi-client workspaces, team isolation, high-volume `%PDF-1.4` client deliverables |
| **Total** | **5 Balanced Cohorts** | **25** | **14 consecutive calendar days of live observation** |

**Access Mechanics (Already Built & E2E Verified):** Super Admin issues single-use SHA-256 hashed invite codes via `/api/beta`; uninvited POSTs return HTTP `403 BETA_CLOSED`; `/[locale]/beta` stays hidden from search engines (`noIndex: true` + `robots.ts`).

---

## 2. Daily Beta Operations & Telemetry Monitoring Checklist (Days 1–14)

Every day at 09:00 UTC during the 14-day pilot, the Operations Lead records actual observed metrics from PostgreSQL & Admin Console:
1. **Acquisition & Activation:** Registration success rate, Resend email verification receipt rate, onboarding completion, first saved profile, first research project, first `%PDF-1.4`/CSV report.
2. **Data & AI Reliability:** Search success rate, upstream provider error rate (`4xx`/`5xx`/timeouts), live AI capability usage, micro-USD daily & cumulative API spend vs. hard caps.
3. **Background Jobs & Stability:** Scheduled job completion/retry/dead-letter counts, `GET /api/health` uptime & DB latency.
4. **Customer & Security Health:** Support ticket volume/resolution time, structured `/api/feedback` satisfaction themes, defect severity triage (`S0`/`S1`/`S2`/`S3`), and `audit_logs` security event review.

---

## 3. Proposed Beta Exit Criteria & Owner-Aligned Quantitative Targets

> **Pre-Commencement Step:** Confirm exact numerical activation, reliability, and retention thresholds with the Owner before Day 1. Proposed defaults below:

- **Hard Security & Integrity Gates (Non-Negotiable):**
  - `0` unresolved **S0 (critical security / data-isolation)** defects and `0` confirmed cross-customer data exposures.
  - `0` unresolved **S1 (critical customer workflow)** defects.
  - Verified Linux backup & disposable restore drill, verified provider micro-USD spend caps, verified password/account recovery, verified self-service account deletion, and verified Emergency Halt kill-switch response.
- **Proposed Numerical Product Targets (To Ratify With Owner Before Day 1):**
  - Registration + Email Verification Completion: **≥ 90%** of invited attendees.
  - Core Activation (Saved Profile + Project or Report Created within 7 days): **≥ 75%**.
  - Day-7 Pilot Retention (Active session in Week 2): **≥ 60%**.
  - Core API Availability (excluding intentional maintenance): **≥ 99.5%**.
  - Customer Satisfaction (Post-Beta Survey CSAT / NPS): **≥ 4.0 / 5.0** with documented written consent before quoting any testimonial publicly.
