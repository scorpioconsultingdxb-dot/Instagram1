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

## Stage Progress Overview (All 10 Stages)

| Stage | Scope | Implementation Status | Local QA Status | Infrastructure / Live PG16 Status |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 1** | Complete Supabase Removal & Independent PostgreSQL Architecture | **Implemented** | **Locally tested** (`66/66` tests, `lint`, `typecheck`, `build`, fail-closed prod smoke) | **Partially independently verified** (PG16 migrations, 2× seed, `viewora_app` `db:health` passed in CI Run `45636280310`); `test:db`, `pg_dump`/`pg_restore`, `e2e-postgres` **Pending infrastructure** |
| **Stage 2** | Independent Authentication, Registration, Login, Onboarding & Account Experience | **Implemented** | **Locally tested** (active sessions API, resend verification, CSRF hardening, `6/6` headless Chrome checks, `0` errors) | Live PG16 session/reset/verification E2E **Pending infrastructure** |
| **Stage 3** | Customer Workspace, Saved Profiles, Folders, Private Notes & Comparisons | **Implemented** | **Locally tested** (tag filters, private note counters, inline edit comparison project, sortable matrix, CSV export, CSRF guard) | Live PG16 workspace/RLS E2E **Pending infrastructure** |
| **Stage 4** | Personal Digital HQ, Preferences, Notifications & Support Desk | **Implemented** | **Locally tested** (All/Unread notification filter, read/unread toggle, CSRF + rate-limited support & contact routes) | Live PG16 notification/support E2E **Pending infrastructure** |
| **Stage 5** | Free Tools Suite, Public Search UX & Honest Data Provenance | **Implemented** | **Locally tested** (12 SEO tools, provenance badges, zero fabricated live metrics, zero Supabase copy) | Live Instagram/Meta API **Pending infrastructure** (excluded by roadmap) |
| **Stage 6** | AI Intelligence Studio, Report History & Multi-Format Exports | **Implemented** | **Locally tested** (report keyword search, one-click Copy Markdown Brief with provenance, CSRF-guarded AI route, PDF/CSV export history) | Live Gemini API **Pending infrastructure** (excluded by roadmap) |
| **Stage 7** | Pricing, 5-Tier Memberships, Subscriptions & Entitlement Enforcement | **Implemented** | **Locally tested** (5 synchronized tiers, locked `PAYMENTS_ENABLED=false`, checkout fail-closed `503`, CSRF guard) | Stripe activation **Pending infrastructure** (strictly disabled) |
| **Stage 8** | Administration Console, RBAC, Support Desk, CMS, Broadcasts & Audit Logs | **Implemented** | **Locally tested** (CSRF guard, `suspend_user` / `reactivate_user` with self-suspension block, `grant_user_override`, locked `payments_enabled` `403`, immutable audits) | Live PG16 RBAC E2E **Pending infrastructure** |
| **Stage 9** | Security Hardening, Privacy/GDPR Controls, Accessibility & Performance | **Implemented** | **Locally tested** (CSRF across all mutating endpoints, dev/prod split CSP, rate limiting, inline confirmed account deletion, GDPR JSON export, `stages-3-to-9.test.ts`) | Live PG16 RLS & pen-checks **Pending infrastructure** |
| **Stage 10** | Full Multi-Locale Polish, End-to-End QA & Release Readiness Package | **Implemented** | **Locally tested** (`13/13` test files, `66/66` tests, `286/286` static routes, all 5 locales `en`/`pt-BR`/`es`/`de`/`fr` zero overflow, `0` console/page errors, fixed `/fr` header overflow) | Full live PG16 release sign-off **Pending infrastructure** |

---

## Cumulative Pending Infrastructure Verification Items

1. **[Stage 1–10 — Pending infrastructure]** Execute `npm run test:db` (`src/lib/db/postgres.integration.test.ts`) against live PostgreSQL 16 under restricted `viewora_app` (`NOSUPERUSER NOBYPASSRLS`) to independently verify all 40 tables, >=45 indexes, >=40 FKs, >=20 RLS policies, cross-account isolation, zero admin bypass on private notes, concurrent `pg_advisory_xact_lock` quota enforcement, and full session/account lifecycle.
2. **[Stage 1 — Pending infrastructure]** Execute real `pg_dump` (`scripts/db/backup.sh` or `backup.ps1`) and `pg_restore` (`restore.sh` or `restore.ps1`) into `viewora_restore_check`, followed by `node scripts/db/verify-backup-restore.mjs compare`.
3. **[Stage 1–10 — Pending infrastructure]** Execute `node scripts/e2e-postgres.mjs` against production `next start` connected to PostgreSQL 16 (desktop `1440x900` + mobile `390x844`, production app restart persistence, synthetic `super_admin` verification, confirmed account deletion).
4. **[Stage 1 — Pending infrastructure]** Verify PostgreSQL container restart persistence (`docker compose restart postgres`) on a host with Docker Desktop or native PostgreSQL 16.
5. **[Owner Manual Action — Pending infrastructure]** Push local `main` commits to GitHub manually when ready to execute `.github/workflows/ci.yml` end-to-end against GitHub Actions PostgreSQL 16.
6. **[External Services — Excluded from Stages 1–10]** Meta/Instagram live API activation, Gemini live API key integration, Resend transactional email delivery, external analytics providers, and Stripe payment activation remain intentionally disabled and preserved behind existing provider interfaces.
