# Viewora — Cumulative 20-Stage Development & Verification Backlog

**Last Updated:** 2026-11-25  
**Execution Policy:** Permanent Development Execution Rules (local autonomous progression, manual GitHub management by owner, strict database independence, zero Supabase, no new external APIs, payments permanently disabled).

## Status Legend

- **Implemented:** Code authored and integrated into the repository.
- **Locally tested:** Verified locally via ESLint, TypeScript, Vitest unit/harness tests, production `next build`, and/or local headless browser checks.
- **Independently verified:** Verified against real external/runtime infrastructure (e.g., real PostgreSQL 16 server).
- **Pending infrastructure:** Implemented and ready, awaiting PostgreSQL 16 / Docker Desktop / manual CI push / Lighthouse CLI / future external service credentials.
- **Blocked:** Cannot proceed due to a hard external dependency or unresolved defect.
- **Failed:** Last run failed and requires remediation.

---

## Phase 1 (Stages 1–10) & Phase 2 (Stages 11–20) Progress Overview

| Stage | Scope | Implementation | Local QA | Live Infrastructure Status |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 1** | Complete Supabase Removal & Independent PostgreSQL Architecture | **Implemented** | **Locally tested** | **Partially independently verified** (PG16 migrations, 2× seed, `viewora_app` `db:health` in CI `45636280310`); `test:db`, `pg_dump`/`pg_restore`, `e2e-postgres` **Pending infrastructure** |
| **Stage 2** | Independent Auth, Registration, Login, Onboarding & Account Experience | **Implemented** | **Locally tested** | Live PG16 session/reset/verification E2E **Pending infrastructure** |
| **Stage 3** | Customer Workspace, Saved Profiles, Folders, Private Notes & Comparisons | **Implemented** | **Locally tested** | Live PG16 workspace/RLS E2E **Pending infrastructure** |
| **Stage 4** | Personal Digital HQ, Preferences, Notifications & Support Desk | **Implemented** | **Locally tested** | Live PG16 notification/support E2E **Pending infrastructure** |
| **Stage 5** | Free Tools Suite, Public Search UX & Honest Data Provenance | **Implemented** | **Locally tested** | Live Instagram/Meta API **Pending infrastructure** (excluded) |
| **Stage 6** | AI Intelligence Studio, Report History & Multi-Format Exports | **Implemented** | **Locally tested** | Live Gemini API **Pending infrastructure** (excluded) |
| **Stage 7** | Pricing, 5-Tier Memberships, Subscriptions & Entitlements | **Implemented** | **Locally tested** | Stripe activation **Pending infrastructure** (strictly disabled) |
| **Stage 8** | Administration Console, RBAC, Support, CMS, Broadcasts & Audit Logs | **Implemented** | **Locally tested** | Live PG16 RBAC E2E **Pending infrastructure** |
| **Stage 9** | Security Hardening, Privacy/GDPR Controls, Accessibility & Performance | **Implemented** | **Locally tested** | Live PG16 RLS & pen-checks **Pending infrastructure** |
| **Stage 10** | Multi-Locale Polish, End-to-End QA & Phase 1 Release Readiness | **Implemented** | **Locally tested** | Full live PG16 release sign-off **Pending infrastructure** |
| **Stage 11** | Premium Homepage & Brand Experience (`See Beyond the Profile.`) | **Implemented** | **Locally tested** | Live provider search **Pending infrastructure** |
| **Stage 12** | Free Tools Directory Mode Filters & Consistent 12-Tool UX | **Implemented** | **Locally tested** | Live Instagram API **Pending infrastructure** (excluded) |
| **Stage 13** | Personal Digital HQ (All 9 Sections + `My Research` + Hero Pills) | **Implemented** | **Locally tested** | Live PG16 profile prefs E2E **Pending infrastructure** |
| **Stage 14** | Dynamic Customer Dashboard (`Customize Layout` Widgets & Shortcuts) | **Implemented** | **Locally tested** | Live PG16 multi-workspace E2E **Pending infrastructure** |
| **Stage 15** | Professional Intelligence Center (Metric Formulas & Sortable Benchmarks) | **Implemented** | **Locally tested** | Live snapshot ingestion **Pending infrastructure** |
| **Stage 16** | AI Studio 7-Template Card Library & Report Experience | **Implemented** | **Locally tested** | Live Gemini API **Pending infrastructure** (excluded) |
| **Stage 17** | Membership Experience & Plan Comparison Assistant (`$0`–`$99.99`) | **Implemented** | **Locally tested** | Stripe billing **Pending infrastructure** (strictly disabled) |
| **Stage 18** | Super Admin Business Control Center (Distribution, Suspend, Overrides) | **Implemented** | **Locally tested** | Live PG16 admin RBAC E2E **Pending infrastructure** |
| **Stage 19** | SEO & Customer Acquisition (`resources`, `glossary`, JSON-LD, `296` pages) | **Implemented** | **Locally tested** | Production Search Console indexing **Pending infrastructure** |
| **Stage 20** | Commercial QA (6 Viewports, 5 Locales, WCAG, CWV, 11 Screenshots, 10 Reports) | **Implemented** | **Locally tested** | Standalone Lighthouse CLI & Live PG16 E2E **Pending infrastructure** |

---

## Cumulative Pending Infrastructure Verification Items

1. **[Pending infrastructure]** Execute `npm run test:db` (`src/lib/db/postgres.integration.test.ts`) against live PostgreSQL 16 under restricted `viewora_app` (`NOSUPERUSER NOBYPASSRLS`).
2. **[Pending infrastructure]** Execute real `pg_dump` / `pg_restore` (`scripts/db/backup.*` & `restore.*`) into `viewora_restore_check` and pass `node scripts/db/verify-backup-restore.mjs compare`.
3. **[Pending infrastructure]** Execute `node scripts/e2e-postgres.mjs` against production `next start` connected to PostgreSQL 16 (desktop + mobile, production app restart persistence, synthetic `super_admin`, confirmed account deletion).
4. **[Pending infrastructure]** Verify PostgreSQL container restart persistence on a host with Docker Desktop or native PostgreSQL 16.
5. **[Pending infrastructure]** Run standalone Lighthouse CLI mobile/desktop audit against staging URL once deployed.
6. **[Owner Manual Action]** Push local `main` commits to GitHub manually whenever ready to run `.github/workflows/ci.yml` end-to-end.
7. **[Excluded External Services]** Meta/Instagram live API, Gemini live API, Resend transactional email, external analytics providers, and Stripe payments remain intentionally disabled and preserved behind existing interfaces.
