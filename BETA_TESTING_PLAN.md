# Viewora — Controlled Invitation-Only Beta Testing Plan (Stage 59)

**Date:** 2026-11-26  
**Beta Enrollment Gate Status:** **CLOSED (`BETA_PUBLIC_REGISTRATION_ENABLED=false`)** — zero synthetic or fictitious beta customers created.  
**Implemented Modules:** [`src/lib/beta/service.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/beta/service.ts), [`src/app/api/beta/route.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/beta/route.ts), [`src/components/beta/BetaAccessClient.tsx`](file:///c:/Users/Scorpio/Videos/Instagram/src/components/beta/BetaAccessClient.tsx), [`src/app/[locale]/beta/page.tsx`](file:///c:/Users/Scorpio/Videos/Instagram/src/app/%5Blocale%5D/beta/page.tsx) (`noIndex: true`, verified in `phase6_beta_1440px.png` & live PG E2E `403 BETA_CLOSED` gate).

---

## 1. Invitation-Only Access Architecture

- **SHA-256 Hashed Invite Codes:** Raw invite codes are never persisted in plaintext; `createBetaInvite()` stores SHA-256 digests in PostgreSQL `system_settings` under Super Admin RBAC + immutable `audit_logs`.
- **Fail-Closed Gate:** Uninvited POST requests to `/api/beta` receive HTTP `403 BETA_CLOSED` while `BETA_PUBLIC_REGISTRATION_ENABLED !== 'true'`.
- **Zero Search Engine Exposure:** `/[locale]/beta` is disallowed in `robots.ts` and sets `robots: { index: false, follow: false }`.

---

## 2. Five Structured Pilot Cohorts (Planned Target Sizes — 0 Active Today)

| Cohort Key | Target Profile | Planned Pilot Size | Primary Workflows Under Evaluation |
| :--- | :--- | :---: | :--- |
| `personal` | Everyday public profile researchers | 5–10 invited testers | 12 Free Tools, Personal Digital HQ 3.0, Accessibility preferences |
| `creator` | Independent Instagram creators | 5–10 invited testers | Official Meta OAuth connection (once enabled), Bio/Format diagnostics, AI Studio |
| `marketing_pro` | In-house social marketers | 5–10 invited testers | Research Workspace Pro, Competitor Studio compatibility checks, CSV/PDF reports |
| `business` | SMB brand managers | 5–10 invited testers | Historical trend tracking, Automation Center, Email notification preferences |
| `agency` | Multi-client digital agencies | 3–5 invited agencies | Multi-project workflows, Agency Center, binary `%PDF-1.4` client deliverables |

---

## 3. Defect Severity Classification & Resolution SLA

| Severity | Definition | Required Beta Action |
| :---: | :--- | :--- |
| **S0 (Blocker / Security / Data Isolation)** | Cross-tenant leak, auth bypass, secret exposure, data corruption, uncontrolled API spend | **Immediate Emergency Halt**; block all beta cohorts until hotfix + regression test pass |
| **S1 (Critical Functional)** | Broken login, PDF export failure, broken OAuth callback, broken core dashboard/admin mutation | Block cohort expansion; fix & verify on staging within 24 hours |
| **S2 (Major Usability / Localization)** | Layout overflow, broken locale translation, misleading unavailable-data label, minor report formatting flaw | Track in backlog; fix prior to Commercial GA gate |
| **S3 (Minor / Enhancement)** | Cosmetic polish, feature request, optional UX suggestion | Capture via `/api/feedback` for post-launch roadmap |

---

## 4. Measurable Beta Exit Criteria (Before Stage 60 Commercial Launch)

1. **Zero open S0 or S1 defects** across all 5 pilot cohorts over a minimum **14-day soak period**.
2. **≥ 85%** of invited pilot testers complete onboarding, save at least one profile/project, and generate at least one `%PDF-1.4` or CSV report without engineering intervention.
3. **100% live provider acceptance pass** (`mode: 'live_provider_verified'`) for every enabled external integration with zero cost-cap breaches.
4. **Verified real customer feedback** collected via `/api/feedback` (and written consent obtained before publishing any testimonial on `/launch`).
