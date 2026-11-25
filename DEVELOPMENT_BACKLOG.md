# Viewora — Development Backlog (Updated After Database Activation Audit)

**Date:** 2026-11-25  
**Status Legend:** `Pending Owner Infrastructure` · `Pending Enhancement` · `Deferred (By Scope Restriction)`

---

## 1. Pending Owner Infrastructure (Required Before Live Commercial Launch)

1. **Local Windows PostgreSQL Provisioning & Live Scenario B Execution (`Pending Owner Infrastructure`):**
   - Provide local `postgres` superuser password to create `viewora` / `viewora_test` DBs and `viewora_admin` / `viewora_app` roles on the detected native PostgreSQL 14.25 instance (or install PostgreSQL 16), populate `.env.local`, and run `npm.cmd run env:check`, `db:migrate:deploy`, `db:seed` (2×), `db:health`, `db:bootstrap-admin`, `test:db`, and `node scripts/e2e-postgres.mjs` to capture real PostgreSQL-connected screenshots (`pg_e2e_*.png`).
2. **Windows Application Control Policy for `pg_restore.exe` (`Pending Owner Infrastructure`):**
   - Allowlist `C:\Program Files\PostgreSQL\14\bin\pg_restore.exe` (or install signed PostgreSQL 16 binaries) to execute a local Windows backup/restore drill via `npm.cmd run db:backup` + `db:restore` + `verify-backup-restore.mjs`.
3. **Cloud Object Storage Driver (`Pending Infrastructure`):**
   - Implement an S3 / GCS / Cloudflare R2 driver for `FileStorageDriver` (`src/lib/storage/local-files.ts`) before horizontal autoscaling or serverless deployment so customer avatar/cover uploads persist across stateless instances.
4. **Distributed Background Worker & Cron Scheduler (`Pending Infrastructure`):**
   - Connect `JobQueueEngine` to a PostgreSQL `background_jobs` (`SKIP LOCKED`) worker / cloud scheduler for automatic scheduled automation execution.
5. **Live Lighthouse CI & Assistive Technology Audit (`Pending Staging & Manual QA`):**
   - Run automated Lighthouse CI and manual screen-reader checks (NVDA / VoiceOver) against a deployed HTTPS staging URL.

---

## 2. Pending Engineering Enhancements (Post-Activation)

1. **Promote `referrals/service.ts` to Native PostgreSQL Tables (`Pending Enhancement`):**
   - Wire `src/lib/referrals/service.ts` directly to the existing `referral_codes`, `referral_attributions`, and `affiliate_accounts` Prisma models (currently fails closed cleanly with `503` on read-only filesystems).
2. **Dedicated Normalized Tables for Phase 3 Modules (`Optional Future Optimization`):**
   - Phase 3 user-owned modules (`researchPro`, `customReports`, `agencyOrg`, `automation`) now persist natively in PostgreSQL under RLS-protected `user_preferences.notification_preferences._modules` (zero disk writes, full `ON DELETE CASCADE`). If cross-workspace SQL analytics over custom reports or agency comments is needed at high scale, promote them into dedicated relational tables via an additive migration.

---

## 3. Explicitly Deferred by Scope Restrictions (Do Not Activate Until Authorized)

1. **Stripe Billing & Affiliate Payouts (`Deferred — PAYMENTS_ENABLED=false`):** Locked off across env validation, database feature flag, UI, and API routes.
2. **Official Meta Graph API / Business Discovery (`Deferred`):** Interfaces preserved; unactivated.
3. **Gemini Live API (`Deferred`):** Budget/kill-switch interfaces preserved; falls back cleanly to deterministic templates.
4. **Resend Transactional Email (`Deferred`):** Deduplication interfaces preserved; external email delivery inactive.
5. **External Analytics Providers (`Deferred`):** First-party consent-aware funnel analytics preserved.

---

## 4. Completed in Database Activation & Hardening Pass

- [x] Thorough Windows PostgreSQL detection (discovered running `postgresql-x64-14` + `pgbouncer` at `C:\Program Files\PostgreSQL\14\bin` and WDAC block on `pg_restore.exe`/`pg_isready.exe`)
- [x] Created `scripts/db/check-env.mjs` (`npm run env:check`) preflight validator with zero secret output
- [x] Hardened `scripts/db/create-admin.ts` (`npm run db:bootstrap-admin`) with strong mixed-class password validation (`bootstrap-validation.ts`) and promotion audit logging
- [x] Enhanced `scripts/db/backup.ps1` & `restore.ps1` with automatic Windows `PostgreSQL\{17..13}\bin` discovery and `DATABASE_ADMIN_URL` restore support
- [x] Fixed silent PostgreSQL drop of 15 Personal Digital HQ 2.0 / Onboarding / Dashboard fields (`profile-prefs.repo.ts`)
- [x] Removed browser-only `localStorage` widget visibility persistence (`CustomerDashboard.tsx`) in favor of account-owned `/api/auth/profile` persistence
- [x] Persisted Research Pro, Report Builder, Agency Center, and Automation Center natively in RLS-protected PostgreSQL (`user-module-state.repo.ts`) for read-only filesystem & multi-instance safety
- [x] Tightened `GET /api/support` with explicit customer RLS context (`{ userId, role: 'user' }`) and set new user `onboardingCompleted: false` on registration
- [x] Extended `scripts/e2e-postgres.mjs` to cover free tools, Report Builder, Support tickets, Personal HQ bio/widgets, and full process restart verification
- [x] Added `src/lib/integration/db-activation.test.ts` (+3 tests; total **84/84 passing** across 17 suites) and re-verified strict Scenario A production QA (**78/78 routes HTTP 200**, `0` errors)
