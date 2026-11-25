# Viewora — Automated, Runtime & Database Verification Test Report

**Date:** 2026-11-25  
**Environment:** Windows Workstation · Node.js `v24.19.0` · Next.js `15.5.29` · Prisma `6.19.3` · Vitest `3.2.7` · Headless Google Chrome (CDP)

---

## 1. Automated Verification Results (Executed Today)

| Check | Command | Result | Measured Output |
| --- | --- | --- | --- |
| **Prisma Schema Validation** | `npx.cmd prisma validate` | **PASS** | Valid 40-model PostgreSQL schema |
| **Prisma Client Generation** | `npx.cmd prisma generate` | **PASS** | Prisma Client `v6.19.3` generated cleanly |
| **Node Script Syntax Checks** | `node --check scripts/db/check-env.mjs` & `scripts/e2e-postgres.mjs` | **PASS** | `0` syntax errors |
| **ESLint** | `npm.cmd run lint` | **PASS** | `0` errors, `0` warnings |
| **TypeScript Typecheck** | `npm.cmd run typecheck` | **PASS** | `0` errors |
| **Automated Unit & Repo Suite** | `npm.cmd run test` | **PASS** | **17 / 17 test files · 84 / 84 tests passed** (`9.82s`) |
| **Env Preflight Diagnostic** | `npm.cmd run env:check` | **PASS (Expected Fail-Closed)** | Auto-detected `C:\Program Files\PostgreSQL\14\bin`; flagged missing `.env.local` (`DATABASE_URL`, `AUTH_SECRET`) without exposing secrets |
| **Production Build** | `npm.cmd run build` | **PASS** | **302 / 302 static pages** generated (`103 kB` shared JS) |
| **Zero Supabase Guard** | Recursive `src/` + `package.json` scan | **PASS** | `0` matches for `@supabase`, `SUPABASE_URL`, or `SUPABASE_ANON` |

### New Tests Added in This Pass (`src/lib/integration/db-activation.test.ts` — 3 / 3 PASS)
1. **Super Admin Bootstrap Validation:** Rejects short passwords, placeholder strings (`Replace-With-*`), and email-substring passwords; normalizes and accepts mixed-class >= 12-char passwords.
2. **PostgreSQL Personal Digital HQ 2.0 & Onboarding Persistence Under RLS:** Verifies `biography`, `interests`, `onboardingSegment`, `onboardingCompleted`, `coverPosition`, and `widgetVisibility` persist and reload through `saveDbProfilePrefs` / `getDbProfilePrefs` with transaction-local RLS context (`set_config`).
3. **PostgreSQL User Module State Coexistence:** Verifies `updateDbUserModuleState` / `readDbUserModuleState` persist Phase 3 module documents (`customReports`) under `user_preferences.notification_preferences._modules` without clobbering `hqExtended` fields.

---

## 2. Scenario A — Strict Production Runtime Verification (No DB + Simulated Read-Only Filesystem)

Executed via `strict_recovery_qa.mjs` against real `next start` (`NODE_ENV=production`, `DATABASE_URL=""`, `DEMO_MODE_ENABLED="false"`, `PAYMENTS_ENABLED="false"`, unwritable `VIEWORA_DATA_DIR=Z:\readonly-sim\.viewora-data`):

- **Public Routes Checked:** **78 / 78 returned HTTP 200** with non-empty content and zero `[data-error-boundary]` triggers (5 locales × homepage, pricing, tools, data-transparency, 11 info pages, 12 tool pages, login, register, forgot-password).
- **Responsive Viewports (`375px`, `390px`, `768px`, `1024px`, `1440px`, `1920px`):** `0px` horizontal overflow across all 6.
- **Dark Theme & Interactive Free Tool Check:** Passed cleanly (Engagement Rate Calculator computes deterministic output without DB).
- **Auth Unavailable Pages (`/login`, `/register`):** Graceful Viewora branded message, zero developer env var leaks, disabled submit actions, and direct free-tools navigation.
- **Zero-Tolerance Error Counts:** `0` console errors · `0` uncaught page errors · `0` failed 5xx requests · `0` server stderr errors.

---

## 3. Scenario B — Live PostgreSQL Integration & E2E Status (Honest Classification)

| Suite | Command | Current Local Status | Details |
| --- | --- | --- | --- |
| **Live PostgreSQL Integration + RLS Isolation Suite** | `npm.cmd run test:db` | **Pending Owner Credentials** | Local `postgresql-x64-14` is running on port `5432` but requires the owner's `postgres` password to create `viewora_test` and `.env.local` |
| **PostgreSQL Production Browser E2E + Restart Persistence** | `node scripts/e2e-postgres.mjs` | **Pending Owner Credentials** | Extended to verify homepage, free tools, registration, onboarding, saved profiles/folders/notes, Personal HQ bio/widgets, Report Builder, Support tickets, membership, full `next start` restart, admin dashboard, and confirmed account deletion |
| **Backup & Disposable Restore Drill** | `npm.cmd run db:backup` / `db:restore` / `verify-backup-restore.mjs` | **Pending Owner Credentials & App Control Policy** | Requires `.env.local` + allowlisting `pg_restore.exe` (currently blocked by Windows Application Control under `PostgreSQL\14\bin`) or installing PG16 |
| **Historical PG16 CI Baseline** | GitHub Actions CI Run `45636280310` | **Previously Passed (Pre-Phase 3)** | Must be re-executed after owner provisions `.env.local` |

---

## 4. Verified Screenshots Inventory (Strictly Classified)

- **Scenario A Production Screenshots (Verified Today — No DB / Read-Only FS):**
  `recovery_homepage_1440px.png`, `recovery_homepage_390px_mobile.png`, `recovery_data_transparency_1440px.png`, `recovery_tools_1440px.png`, `recovery_pricing_1440px.png`, `recovery_login_1440px.png`, `recovery_register_1440px.png`.
- **Isolated Local Demo Screenshots (Phase 3 UI Fixtures — NOT Real PostgreSQL Evidence):**
  `phase3_onboarding_1440px.png`, `phase3_research_pro_1440px.png`, `phase3_analytics_1440px.png`, `phase3_report_builder_1440px.png`, `phase3_agency_1440px.png`, `phase3_automation_1440px.png`, `phase3_referrals_1440px.png`, `phase3_profile_hq_1440px.png`, `phase3_admin_1440px.png`, `phase3_research_pro_390px_mobile.png`, `phase3_report_builder_390px_mobile.png`.
- **Scenario B Real PostgreSQL Customer Screenshots (`pg_e2e_*.png`):** **Pending Owner `.env.local` Provisioning.**
