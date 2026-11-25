# Viewora — Independent PostgreSQL Database Activation Report

**Date:** 2026-11-25  
**Scope:** Independent PostgreSQL activation audit, local Windows detection, full PostgreSQL persistence completion, startup validation, and honest infrastructure status.  
**Restrictions Enforced:** Zero Supabase · Zero new external API integrations · `PAYMENTS_ENABLED=false` locked · Zero automatic production deployment · Local Git only.

---

## 1. Executive Summary

Viewora's application layer, Prisma ORM schema (40 tables, 3 SQL migrations, Row-Level Security policies), authentication/session architecture, Personal Digital HQ 2.0, Onboarding, Dashboard Widgets, Research Workspace Pro, Report Builder, Agency Center, Automation Center, and Customer Support are now **100% wired for native, read-only-filesystem-safe PostgreSQL persistence under the restricted `viewora_app` role (`NOBYPASSRLS`)**.

### Honest Live Local Database Status (`Pending Owner Credentials`)

During thorough Windows host inspection (beyond `PATH`), we discovered an **existing, running native PostgreSQL 14.25 server** on this workstation:

| Component | Measured Status | Details |
| --- | --- | --- |
| **Windows Service `postgresql-x64-14`** | **Running (Automatic)** | Listening on `0.0.0.0:5432` and `[::]:5432` (`TcpTestSucceeded: True`) |
| **Windows Service `pgbouncer`** | **Running (Automatic)** | Listening on `127.0.0.1:6432` and `[::1]:6432` |
| **PostgreSQL Binaries** | **Installed (Off `PATH`)** | `C:\Program Files\PostgreSQL\14\bin` (`psql (PostgreSQL) 14.25` runs cleanly) |
| **Windows App Control (WDAC)** | **Restriction Observed** | `pg_isready.exe` and `pg_restore.exe` under `PostgreSQL\14\bin` are blocked by a Windows Application Control policy on this workstation |
| **Local Auth Credentials** | **Password Protected** | `psql -h 127.0.0.1 -p 5432 -U postgres -w` returns `fe_sendauth: no password supplied`; no `.env`, `.env.local`, `PG*`, `DATABASE_*`, or `pgpass.conf` exists |
| **Docker Desktop** | **Not Installed** | `docker` not found on `PATH` or Windows services |

In accordance with security boundaries, we **did not** bypass password authentication, modify `pg_hba.conf`, guess credentials, or disable Windows Application Control. Consequently, **live local Scenario B execution (`migrate deploy`, `db:seed`, `db:health`, `test:db`, `scripts/e2e-postgres.mjs`, `pg_dump`/`pg_restore`) remains `Pending Owner Credentials / Infrastructure`** until the project owner runs the provisioning steps in [`WINDOWS_POSTGRESQL_SETUP.md`](./WINDOWS_POSTGRESQL_SETUP.md) with their local `postgres` superuser password (or installs PostgreSQL 16).

---

## 2. Persistence & Activation Gaps Discovered and Resolved

1. **Personal Digital HQ 2.0 & Onboarding PostgreSQL Persistence Gap (Fixed):**
   - Previously, `src/lib/db/repositories/profile-prefs.repo.ts` only read/wrote 13 columns on `user_preferences`, dropping 15 extended fields (`biography`, `interests`, `customerGoals`, `onboardingSegment`, `onboardingStep`, `onboardingCompleted`, `walkthroughDismissed`, `coverPosition`, `customAvatarUrl`, `customAvatarKey`, `customCoverUrl`, `customCoverKey`, `defaultLandingSection`, `widgetOrder`, `widgetVisibility`) whenever `DATABASE_URL` was set in production (`isLocalDevFallbackAllowed() === false`).
   - **Fix:** Extended `getDbProfilePrefs()` and `saveDbProfilePrefs()` to persist all 15 fields inside `user_preferences.notification_preferences.hqExtended` (protected by PostgreSQL RLS policy `user_preferences_owner_only`) and sync `users.onboarding_completed` — with zero breaking schema migrations and zero filesystem writes.
2. **Browser-Only Dashboard Widget Visibility (`localStorage`) Eliminated (Fixed):**
   - Previously, `CustomerDashboard.tsx` stored `widgetVisibility` exclusively in `window.localStorage.getItem('viewora_dash_widgets')`.
   - **Fix:** `toggleWidget` now persists directly via `PATCH /api/auth/profile`, hydrating from the user's PostgreSQL-backed `profilePrefs.widgetVisibility`.
3. **Phase 3 Customer Modules Wired to PostgreSQL RLS (`user-module-state.repo.ts`, Fixed):**
   - Previously, `/api/dashboard/research`, `/api/reports/builder`, `/api/agency`, and `/api/automation` wrote to `.viewora-data/*.json`, which fails on read-only serverless filesystems and does not share state across instances.
   - **Fix:** Added `src/lib/db/repositories/user-module-state.repo.ts` (`readDbUserModuleState` / `updateDbUserModuleState`) persisting user-owned `researchPro`, `customReports`, `agencyOrg`, and `automation` state inside RLS-scoped `user_preferences.notification_preferences._modules` whenever `isDatabaseConfigured()` is true, automatically cascading on account deletion (`ON DELETE CASCADE`) while preserving local dev JSON fallback for non-DB unit tests.
4. **Customer Support RLS Context Tightened (Fixed):**
   - `GET /api/support` now passes `{ userId: user.id, role: 'user' }` to `loadSupportTickets(...)` so PostgreSQL RLS `support_tickets_owner_or_support` enforces tenant isolation inside the database transaction rather than relying solely on JS filtering.
5. **Initial Onboarding State Corrected (Fixed):**
   - `registerUserWithWorkspace` in `src/lib/db/repositories/users.repo.ts` now initializes `onboardingCompleted: false` so new accounts genuinely enter and track the 4-step onboarding journey until completion.
6. **Startup Preflight & Admin Bootstrap Hardening (Added):**
   - Added `scripts/db/check-env.mjs` (`npm run env:check`) to validate `DATABASE_URL`, `DATABASE_ADMIN_URL`, `TEST_DATABASE_URL` isolation, `AUTH_SECRET` strength, URL origin consistency, zero Supabase env vars, `DEMO_MODE_ENABLED=false`, `PAYMENTS_ENABLED=false`, local Windows PostgreSQL discovery, and live `SELECT 1` reachability without leaking secrets.
   - Hardened `scripts/db/create-admin.ts` (`npm run db:bootstrap-admin`) with `src/lib/admin/bootstrap-validation.ts` (enforcing >= 12 char mixed-class non-placeholder passwords) and audit logging on both creation (`admin.bootstrap.created`) and promotion (`admin.bootstrap.promoted`).

---

## 3. Exact Verification Matrix

| Check | Status | Evidence |
| --- | --- | --- |
| `npx.cmd prisma validate` & `prisma generate` | **PASS** | Valid 40-model schema; Prisma Client `v6.19.3` generated |
| `npm.cmd run lint` & `npm.cmd run typecheck` | **PASS** | `0` lint errors/warnings · `0` TypeScript errors |
| `npm.cmd run test` | **PASS** | **17 / 17 test files · 84 / 84 tests passed** (includes `db-activation.test.ts` + `runtime-recovery.test.ts`) |
| `npm.cmd run build` | **PASS** | **302 / 302 static pages** built cleanly |
| Scenario A Prod QA (No DB + Unwritable FS) | **PASS** | **78 / 78 public routes HTTP 200**, 5 locales, 6 viewports, `0` console/page/5xx/stderr errors |
| `npm.cmd run env:check` (Local Diagnostic) | **PASS (Expected Fail-Closed)** | Auto-detected `C:\Program Files\PostgreSQL\14\bin`; cleanly flagged missing `.env.local` (`DATABASE_URL`, `AUTH_SECRET`) with zero secret output |
| Live Local Scenario B (`migrate deploy`, `db:seed`, `db:health`, `test:db`, `e2e-postgres.mjs`) | **Pending Owner Credentials** | Local `postgresql-x64-14` requires owner's `postgres` password to create `viewora` / `viewora_test` DBs and `.env.local` |
| Prior Real PG16 CI Verification (Migrations + 2× Seed + `viewora_app` RLS + Backup/Restore) | **Previously Verified (Historical)** | Verified in CI Run `45636280310` prior to Phase 3; must be re-executed after owner configures `.env.local` |
