# Viewora — Cumulative 10-Stage Development & Verification Backlog

**Last Updated:** 2026-11-25  
**Execution Policy:** Permanent Development Execution Rules (local autonomous progression, manual GitHub management by owner, strict database independence, zero Supabase, no new external APIs, payments permanently disabled).

## Status Legend

- **Implemented:** Code authored and integrated into the repository.
- **Locally tested:** Verified locally via ESLint, TypeScript, Vitest unit/harness tests, production `next build`, and/or local headless browser checks.
- **Independently verified:** Verified against real external/runtime infrastructure (e.g., real PostgreSQL 16 server).
- **Pending infrastructure:** Implemented and ready, awaiting PostgreSQL 16 / Docker Desktop / manual CI push / future external service credentials.
- **Blocked:** Cannot proceed due to a hard external dependency or unresolved defect.
- **Failed:** Last run failed and requires remediation.

---

## Stage Progress Overview

| Stage | Scope | Implementation Status | Local QA Status | Infrastructure / Live PG16 Status |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 1** | Complete Supabase Removal & Independent PostgreSQL Architecture | **Implemented** | **Locally tested** (`60/60` unit/harness tests, `lint`, `typecheck`, `build`) | **Partially independently verified** (PG16 migrations, 2× seed, `viewora_app` `db:health` passed in CI Run `45636280310`); `test:db`, `pg_dump`/`pg_restore`, `e2e-postgres` **Pending infrastructure** |
| **Stage 2** | Independent Authentication, Registration, Login, Onboarding & Account Experience | **Implemented** | **Locally tested** (`61/61` tests, `lint`, `typecheck`, `build`, `6/6` headless Chrome checks, `0` errors) | Live PG16 session/reset/verification E2E **Pending infrastructure** |
| **Stage 3** | Customer Workspace, Saved Profiles, Folders, Private Notes & Comparisons | *In Progress* | Pending | Live PG16 E2E **Pending infrastructure** |
| **Stage 4** | Personal Digital HQ, Preferences, Notifications & Activity Feed | Planned | Pending | Live PG16 E2E **Pending infrastructure** |
| **Stage 5** | Free Tools Suite, Public Search UX & Honest Data Provenance | Planned | Pending | Live Instagram API **Pending infrastructure** (excluded by roadmap) |
| **Stage 6** | AI Intelligence Studio, Report History & Multi-Format Exports | Planned | Pending | Live Gemini API **Pending infrastructure** (excluded by roadmap) |
| **Stage 7** | Pricing, 5-Tier Memberships, Subscriptions & Entitlement Enforcement (Payments Disabled) | Planned | Pending | Stripe activation **Pending infrastructure** (strictly disabled) |
| **Stage 8** | Administration Console, RBAC, Support Desk, CMS, Broadcasts & Audit Logs | Planned | Pending | Live PG16 RBAC E2E **Pending infrastructure** |
| **Stage 9** | Security Hardening, Privacy/GDPR Controls, Accessibility & Performance | Planned | Pending | Security/PG16 pen-checks **Pending infrastructure** |
| **Stage 10** | Full Multi-Locale Polish, End-to-End QA & Release Readiness Package | Planned | Pending | Full live PG16 release sign-off **Pending infrastructure** |

---

## Cumulative Pending Infrastructure Verification Items

1. **[Stage 1 — Pending infrastructure]** Execute `npm run test:db` (`src/lib/db/postgres.integration.test.ts`) against live PostgreSQL 16 under restricted `viewora_app` (`NOSUPERUSER NOBYPASSRLS`) to independently verify all 40 tables, >=45 indexes, >=40 FKs, >=20 RLS policies, cross-account isolation, zero admin bypass on private notes, concurrent `pg_advisory_xact_lock` quota enforcement, and full session/account lifecycle.
2. **[Stage 1 — Pending infrastructure]** Execute real `pg_dump` (`scripts/db/backup.sh` or `backup.ps1`) and `pg_restore` (`restore.sh` or `restore.ps1`) into `viewora_restore_check`, followed by `node scripts/db/verify-backup-restore.mjs compare`.
3. **[Stage 1 — Pending infrastructure]** Execute `node scripts/e2e-postgres.mjs` against production `next start` connected to PostgreSQL 16 (desktop `1440x900` + mobile `390x844`, production app restart persistence, synthetic `super_admin` verification, confirmed account deletion).
4. **[Stage 1 — Pending infrastructure]** Verify PostgreSQL container restart persistence (`docker compose restart postgres`) on a host with Docker Desktop or native PostgreSQL 16.
5. **[Stage 1 — Pending infrastructure]** Owner manual push of local commit `83ee8fb` (and subsequent stage commits) to GitHub to run `.github/workflows/ci.yml` end-to-end.
6. **[External Services — Excluded from Stages 1–10]** Meta/Instagram live API activation, Gemini live API key integration, Resend transactional email delivery, external analytics providers, and Stripe payment activation remain intentionally disabled and preserved behind existing provider interfaces.
