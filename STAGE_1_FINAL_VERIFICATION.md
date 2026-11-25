# Viewora — Stage 1 Final Verification Report

**Date:** 2026-11-25  
**Base Reviewed Commit:** `28f778eb1181c0e07e4f69565d16058dc8caf969`  
**Hardened Implementation Commit:** `ca64dc2ec8a9f8b3420f5a083ada198ae3b88bf3`  
**Final Acceptance Verdict:** **BLOCKED ON LIVE POSTGRESQL RUNTIME — ALL SOURCE-CODE REVIEW FINDINGS FIXED; CANNOT MARK STAGE 1 ACCEPTED UNTIL REAL POSTGRESQL EXECUTION PASSES.**

> **Honesty Statement:** No live PostgreSQL server, Docker daemon, WSL environment, or `psql`/`pg_dump`/`pg_restore` binary exists on this Windows workstation. Every claim below strictly separates **Implemented & Verified Locally**, **Failed As Expected (Disconnected DB Gate)**, and **Blocked Pending Docker Desktop / PostgreSQL 16 Installation**. Zero results are fabricated.

---

## 1. Development Environment Verification (Task 1)

| Component | Status | Actual Output / Finding |
| :--- | :--- | :--- |
| Node.js | **Verified Operational** | `v24.19.0` (`C:\Program Files\nodejs\node.exe`) |
| npm | **Verified Operational** | `11.17.0` (`npm.cmd`) |
| Prisma CLI | **Verified Operational** | `6.19.3` (Windows Query Engine, Schema Engine, Studio `0.511.0`) |
| PowerShell Runtime | **Verified (5.1 Only — Fixed)** | `powershell.exe` `5.1.26100.9818` present; `pwsh` (PS 7+) **NOT FOUND**. Fixed `package.json` + `scripts/db/env-loader.mjs` to invoke `powershell.exe -NoProfile -ExecutionPolicy Bypass` on Windows, and validated `0` PowerShell 5.1 parse errors on `backup.ps1` and `restore.ps1`. |
| Docker Desktop / Docker CLI | **BLOCKED (Not Installed)** | `docker`, `docker-compose` NOT FOUND; `C:\Program Files\Docker` ABSENT; no Docker Windows service; WSL not installed. |
| Native PostgreSQL & CLI Tools | **BLOCKED (Not Installed)** | `postgres`, `pg_ctl`, `psql`, `pg_dump`, `pg_restore` NOT FOUND; `C:\Program Files\PostgreSQL` ABSENT; no PostgreSQL Windows service. |

### Required Owner Action to Unblock Live PostgreSQL Execution
Install **either**:
1. **Docker Desktop for Windows** (https://www.docker.com/products/docker-desktop/) — enables `npm run db:up` with `docker-compose.yml`, persistent volume `viewora_pgdata`, and `docker exec` backups/restores; **or**
2. **Native PostgreSQL 16 for Windows** (https://www.postgresql.org/download/windows/) — provides local `postgres`, `psql`, `pg_dump`, and `pg_restore`; **or**
3. **Run the GitHub Actions CI workflow** (`.github/workflows/ci.yml`), which provisions an ephemeral `postgres:16-alpine` service container and executes every migration, seed, RLS, backup/restore, and mandatory `test:db` check automatically.

---

## 2. Database Configuration Status & Model Count (Tasks 2 & 3)

- **Supabase Runtime Dependencies:** **0 (Verified Removed)** — `@supabase/supabase-js` and `@supabase/ssr` uninstalled; `src/lib/supabase/` and `supabase/` deleted; `https://*.supabase.co` removed from CSP; zero `NEXT_PUBLIC_SUPABASE_*` env references; `/en` and `/en/login` HTML verified free of `supabase`.
- **Database Model Count:** **40 Prisma models** across 13 domain modules in `prisma/schema.prisma`.
- **Docker Compose & Env Loading:** **Implemented & Validated Statically**
  - `docker-compose.yml` updated with `env_file` (`.env` + `.env.local`), persistent volume `viewora_pgdata`, `127.0.0.1:5432` loopback binding, health checks, and `init-databases.sh` provisioning `viewora`, `viewora_test`, and least-privilege `viewora_app` (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`).
  - `scripts/db/env-loader.mjs` ensures Prisma migrations, seeds, and `db:create-admin` load `.env.local` and route through `DATABASE_ADMIN_URL`, while runtime commands use `DATABASE_URL` (`viewora_app`).
  - Removed deprecated `package.json#prisma` property warning.
- **Prisma Schema Validation & Client Generation:** **Verified Locally (PASS)**
  - `npx.cmd prisma validate` → `The schema at prisma\schema.prisma is valid` (exit `0`).
  - `npm.cmd run db:generate` → `Generated Prisma Client (v6.19.3)` (exit `0`).
- **Live Migration Execution & Seed Idempotency (Task 3):** **BLOCKED (No Local PostgreSQL Server)**
  - Authored 3 versioned migrations ready for `npm run db:migrate:deploy`:
    1. `20261125000001_initial_viewora_schema/migration.sql` (1,362 lines)
    2. `20261125000002_postgres_rls_and_roles/migration.sql`
    3. `20261125000003_rls_hardening_and_least_privilege/migration.sql`
  - Could not be applied against a live PostgreSQL instance locally due to missing Docker/PostgreSQL binaries. Wired into `.github/workflows/ci.yml` for automated execution including double-run seed idempotency verification.

---

## 3. PostgreSQL RLS & Role Hardening Findings (Task 4)

### Critical Issues Identified & Fixed in Code + Migration 3
1. **Unwired RLS Context (`withUserRlsContext`):** Previously defined in `src/lib/db/prisma.ts` but unused by repositories. Now consistently enforced via `withUserRlsContext` / `setTxRlsContext` (`SELECT set_config('app.current_user_id', ..., true)` and `app.current_user_role`) across `users.repo.ts`, `profile-prefs.repo.ts`, `workspace.repo.ts`, `admin.repo.ts`, and `export-data/route.ts`. Verified via `$executeRaw` assertion in unit tests.
2. **Broken Registration & Workspace Creation Under Restricted `viewora_app`:**
   - Fixed `registerUserWithWorkspace` to create `User` first, immediately invoke `setTxRlsContext(tx, { userId: user.id, role: 'user' })`, and then create `UserPreference`, `Workspace`, `WorkspaceMember`, `ResearchFolder`, `Subscription`, `Notification`, `EmailVerificationToken`, and `ConsentRecord` inside the same transaction.
   - Added `app.is_workspace_owner(uuid)` (`SECURITY DEFINER`, `SET search_path = pg_catalog, public, app`) and `INSERT`/`UPDATE`/`DELETE` policies on `workspace_members` in `20261125000003_rls_hardening_and_least_privilege/migration.sql`.
3. **Overbroad Admin RLS Bypass:** Narrowed `app.is_admin()` to `app.is_platform_admin()` (`super_admin`, `admin`, `operations_admin`), separated `app.is_support_staff()` strictly for `support_tickets` / `support_messages`, revoked `PUBLIC` execute privileges on `app.*`, enabled RLS on `activity_events`, `consent_records`, and `data_export_requests`, and removed admin bypass from customer research tables (`saved_profiles`, `research_folders`, `profile_research_notes`, `comparison_projects`, `ai_reports`, `report_exports`, `user_preferences`, `notifications`).
4. **Concurrent Quota Race Condition:** Added transaction-local PostgreSQL advisory lock (`pg_advisory_xact_lock`) + atomic count check inside `persistDbSavedProfile`, wired to `/api/dashboard/workspace`.

- **Database Role & Live RLS Enforcement Status:** **Implemented & Unit-Tested (Harness); Live `viewora_app` Execution BLOCKED Pending Local PostgreSQL.**

---

## 4. Authentication Security & Production Fallback Hardening (Tasks 5, 6 & 8)

### Findings Fixed & Verified
1. **Eliminated Predictable Production Secret Fallbacks (Task 5):**
   - Created `src/lib/auth/secret.ts` (`getRequiredAuthSecret`, `isStrongAuthSecret`, `assertValidProductionAuthConfig`, `isAllowedCsrfOrigin`).
   - Removed `'missing-auth-secret-configure-AUTH_SECRET-in-env'` from `src/lib/auth/auth.ts` and `'viewora-local-dev-session-secret-only'` from `src/lib/auth/session.ts`.
   - Production (`NODE_ENV === 'production'`) strictly rejects missing, short (`< 32` chars), low-entropy, or placeholder `AUTH_SECRET` values with `AuthConfigurationError` / HTTP `503`.
   - Added CSRF `Origin` validation on mutating auth endpoints (`login`, `signup`, `logout`, `change-password`, `delete-account`).
   - **Verified Live Against Production Build (`next start`):** `POST /api/auth/login` with empty `AUTH_SECRET` returned **HTTP `503`** (`{"ok":false,"error":"Authentication service is not configured securely."}`).
2. **Unified Session Architecture (Task 6):**
   - Eliminated split JWT vs DB session validation. Auth.js (`src/lib/auth/auth.ts`) is now configured with `session: { strategy: 'database' }` and `getCurrentSessionUser()` validates exclusively against revocable PostgreSQL `public.sessions` rows via `resolveDbSessionByRawToken` (verifying non-revocation, expiration, `accountStatus === 'active'`, and live `role`/`planCode` on every request).
   - Added `suspendDbUserAccount` / `reactivateDbUserAccount` in `users.repo.ts` (revokes all active sessions atomically).
   - Verified in unit/contract tests: registration, login, logout revocation, session expiration, password change session revocation, single-use password reset & email verification (replay blocked), account suspension, immediate admin role removal, and account deletion cascade.
3. **Eliminated Unsafe Production Fallbacks & Demo Admin Leaks (Task 8):**
   - `isDemoModeEnabled()` and `isLocalDevFallbackAllowed()` in `src/lib/env.ts` now unconditionally return `false` when `NODE_ENV === 'production'`.
   - Removed silent DB-error fallbacks to local JSON in `profile-prefs.ts`, `dashboard/store.ts`, `admin/store.ts`, and `session.ts`; API routes return HTTP `503` when PostgreSQL is unavailable.
   - **Verified Live Against Production Build (`next start` with `DEMO_MODE_ENABLED=true`):** `/api/health` reported `demoMode.enabled: false`, `database.status: "not_configured"`, `payments.enabled: false`; `/api/dashboard/workspace` returned `401`.

---

## 5. Automated Test, Build, Backup & Browser Results (Tasks 7, 9, 10, 11, 12)

| Verification Gate | Status | Actual Measured Output |
| :--- | :--- | :--- |
| `npx.cmd prisma validate` | **PASS** | Valid 40-model schema (`exit 0`) |
| `npm.cmd run db:generate` | **PASS** | Prisma Client `v6.19.3` generated (`exit 0`) |
| `npm.cmd run lint` | **PASS** | ESLint `0` errors, `0` warnings (`exit 0`) |
| `npm.cmd run typecheck` | **PASS** | `tsc --noEmit` `0` errors (`exit 0`) |
| `npm.cmd run test` | **PASS** | **12/12 files, 60/60 unit/security/repository tests passed** (`0` skipped) |
| `npm.cmd run test:db` (Mandatory Live Postgres Gate) | **FAIL (Expected — Disconnected DB)** | Exited `1`: `MANDATORY DATABASE GATE FAILED: TEST_DATABASE_URL is not configured. Start PostgreSQL and set TEST_DATABASE_URL to viewora_test.` Proves disconnected DBs cannot silently pass. |
| `npm.cmd run build` | **PASS** | Production Next.js 15 build compiled cleanly (`284/284` static pages, `exit 0`) |
| Production HTTP Smoke (`next start`, no DB) | **PASS** | `/api/health` (`not_configured`, `demoMode: false`, `payments: false`), `/api/auth/login` (`503` fail-closed), `/api/dashboard/workspace` (`401`), `/en` & `/en/login` (`200`, zero `supabase`) |
| Backup/Restore Script Syntax (PowerShell 5.1) | **PASS (Static)** | `backup.ps1` & `restore.ps1`: `0` PowerShell 5.1 parse errors |
| Live PostgreSQL Customer Persistence & Restart Test (Task 7) | **BLOCKED** | Requires local Docker/PostgreSQL 16 server |
| Live PostgreSQL Backup & Restore Comparison (Task 9) | **BLOCKED** | Requires local `pg_dump` / `pg_restore` or Docker container |
| Live PostgreSQL Browser Verification (Task 12) | **BLOCKED** | Previous non-DB E2E passed (`9/9`, `0` errors at `28f778e`); full PostgreSQL-connected browser verification requires running PostgreSQL locally |
| GitHub Actions CI (Task 11) | **Implemented (Awaiting Push Authorization)** | `.github/workflows/ci.yml` created with temporary `postgres:16-alpine` service, `viewora_app` role setup, migrations, idempotent seed, `lint`, `typecheck`, `test`, mandatory `test:db`, `pg_dump`/`pg_restore` check, and `build`. |

---

## 6. Local Git Commit Summary (Branch `main`, Not Pushed)

| Commit | Summary |
| :--- | :--- |
| `0405038` | Initial Docker Compose, PostgreSQL init script, backup/restore scripts, `.env.example`, `.gitignore`, `next.config.ts`, `prisma/schema.prisma`, `src/lib/env.ts`, `local-files.ts`, `docs/SUPABASE_REMOVAL_REPORT.md` |
| `0f32b39` | Prisma SQL migrations 1 & 2, idempotent `prisma/seed.ts`, DB admin scripts, singleton `prisma.ts`, and modular repositories |
| `8fce0dc` | Auth.js v5, revocable PostgreSQL sessions, application-owned auth routes, migrated stores/UI, and deletion of `src/lib/supabase/` & `supabase/` |
| `28f778e` | Prisma repository & auth security tests, E2E PostgreSQL checks, and independent database docs |
| `ca64dc2` | **Stage 1 Final Hardening:** Migration 3 (least-privilege RLS & `workspace_members` owner policies), `withUserRlsContext` across all protected repositories, concurrent quota lock, production `AUTH_SECRET` & CSRF enforcement, unified DB session model, zero production fallbacks/demo leaks, PowerShell 5.1 env loader, mandatory `test:db` suite, and `.github/workflows/ci.yml` |

---

## 7. Stage 2 Readiness Decision

- **Decision:** **HOLD STAGE 1 FINAL ACCEPTANCE UNTIL LIVE POSTGRESQL VERIFICATION IS EXECUTED.**
- **Why:** Every source-code architectural, security, RLS, session, secret, fallback, test-gate, and CI issue identified in the independent review has been resolved and verified by static analysis, 60/60 unit/security tests, a fail-closed production build smoke test, and the intentionally failing disconnected `test:db` gate. However, per the Final Acceptance Requirements, Stage 1 cannot be marked accepted until real PostgreSQL migrations, seed idempotency, restricted `viewora_app` RLS tests (`npm run test:db`), container restart persistence, backup/restore comparison, and PostgreSQL-connected browser E2E are actually executed against PostgreSQL 16 (either by installing Docker Desktop / PostgreSQL 16 locally or authorizing a push to run `.github/workflows/ci.yml`).
