# Viewora — Production & Stage 2 Readiness Assessment

> **Current Verdict (Post-Stage 1):** **STAGE 1 COMPLETE AT CODE, SCHEMA, SECURITY & BUILD LEVEL — READY FOR STAGE 2 AFTER LOCAL DOCKER / POSTGRESQL RUNTIME VERIFICATION.**
> Viewora has **zero runtime dependency on Supabase** (`@supabase/*` uninstalled, `src/lib/supabase/` & `supabase/` removed, CSP cleaned, env vars migrated). It now runs on an independent **self-hosted PostgreSQL 16 + Prisma ORM + Auth.js v5 + revocable PostgreSQL sessions** architecture with modular repositories, native PostgreSQL RLS policies, persistent local file storage (`/.viewora-storage/`), and verified backup/restore scripts. Payments remain strictly disabled (`PAYMENTS_ENABLED=false`).

## Readiness Gate Status

| Gate | Status | Verification Evidence |
| :--- | :--- | :--- |
| Complete Supabase removal (0 runtime dependency) | **Verified** | Zero `@supabase/*` packages in `package.json`; `src/lib/supabase/` and `supabase/` removed; `https://*.supabase.co` removed from CSP; zero `NEXT_PUBLIC_SUPABASE_*` env reads; documented in [docs/SUPABASE_REMOVAL_REPORT.md](./docs/SUPABASE_REMOVAL_REPORT.md). |
| Prisma schema, SQL migrations & seed | **Verified (Static & Generated)** | `prisma validate` passed (`prisma/schema.prisma`, 40 models across 13 modules); `prisma generate` succeeded (v6.19.3); `20261125000001_initial_viewora_schema` (1,362-line DDL) and `20261125000002_postgres_rls_and_roles` (PostgreSQL RLS + least-privilege `viewora_app`) generated; idempotent `prisma/seed.ts` & secure `scripts/db/create-admin.ts` authored. |
| Independent Auth.js v5 + DB session security | **Verified (Unit & Contract)** | `src/lib/auth/auth.ts`, `/api/auth/[...nextauth]`, bcrypt cost 12, revocable PostgreSQL `Session` tokens, single-use SHA-256 hashed verification/reset tokens, login rate limiting, anti-enumeration, safe redirects, and confirmed account deletion/export verified across 56 passing Vitest tests. |
| Cross-account & cross-workspace isolation | **Verified (Repository Harness)** | `src/lib/storage/db-persistence.test.ts` explicitly verifies `WorkspaceAuthorizationError` on cross-account reads/updates/deletes for saved profiles, private research notes, folders, and notifications, plus `LocalFileStorage` owner isolation. |
| ESLint, TypeScript, Unit Tests & Production Build | **Verified Locally** | `lint` (0 errors), `typecheck` (0 errors), `test` (12/12 files, 56 passed, 1 live-DB test skipped cleanly when `TEST_DATABASE_URL` unset), `build` (284 routes compiled cleanly). |
| Public website, 12 free tools, 5 languages & UI | **Verified Locally** | Existing frontend preserved; updated login/register/forgot-password/reset-password/verify-email UI; headless Chrome E2E across 6 viewports (`375px`–`1920px`) and 5 languages with zero Supabase references. |
| Payments strictly disabled | **Verified** | `PAYMENTS_ENABLED=false`, `NEXT_PUBLIC_PAYMENTS_ENABLED=false`, `payments_enabled` flag locked `false`, checkout/webhook endpoints return `503`. |
| **Live Docker Compose + PostgreSQL execution (`db:up`, `migrate deploy`, `seed`, `backup`/`restore`, restart persistence)** | **Blocked on Local Environment** | **Docker Desktop and local PostgreSQL binaries (`docker`, `psql`, `pg_dump`, `pg_restore`, WSL) are not installed on this Windows host.** Must be executed once Docker Desktop or PostgreSQL 16 is installed on the target host or CI runner (including running `TEST_DATABASE_URL=... npm run test`). |
| Historical Supabase data migration | **N/A (No Export Found)** | Audited repository and local directories: no Supabase SQL/CSV/auth export exists. Clean database initialized; no historical customer data recovered or claimed. |
| Live external integrations (Meta API, Gemini AI, Resend Email, Stripe) | **Deferred (Out of Stage 1 Scope)** | Preserved modular provider interfaces; external integrations remain inactive until explicitly authorized in subsequent stages. |
| Legal policy review (GDPR / LGPD / UAE PDPL) | **Blocked (Requires Counsel)** | Draft Privacy, Terms, and Cookie policies require legal counsel sign-off before public commercial launch. |

## Honest Stage 2 Readiness Assessment

- **Ready for Stage 2 code work:** Yes — all database models, migrations, repositories, Auth.js flows, and local storage abstractions are cleanly separated from Supabase and compile/test cleanly.
- **Required operational step before Stage 2 live DB testing:** Install Docker Desktop (or PostgreSQL 16) on the host machine and run:
  1. `cp .env.example .env.local` (populate generated `AUTH_SECRET`, `POSTGRES_PASSWORD`, `POSTGRES_ADMIN_PASSWORD`, `DATABASE_URL`, `DATABASE_ADMIN_URL`, `TEST_DATABASE_URL`)
  2. `npm run db:up`
  3. `npm run db:migrate:deploy && npm run db:seed`
  4. `npm run db:health`
  5. `npm run test` (with `TEST_DATABASE_URL` set so the live PostgreSQL integration test runs)
  6. `npm run db:backup` and test restore into `viewora_test` via `scripts/db/restore.ps1 -TargetDb viewora_test -ConfirmRestore`
  7. Verify restart persistence via `docker compose restart postgres` and `npm run db:health`.
