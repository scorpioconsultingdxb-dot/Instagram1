# Viewora — Independent PostgreSQL Database Activation Report

**Date:** 2026-11-25  
**Status:** **ACTIVATED & VERIFIED LIVE ON POSTGRESQL 14.25**  
**Restrictions Enforced:** Zero Supabase · Zero new external API integrations · `PAYMENTS_ENABLED=false` locked · Zero automatic production deployment · Local Git only · Zero credential exposure.

---

## 1. Executive Summary

Viewora's independent PostgreSQL architecture has been **fully activated and verified end-to-end** against the configured local **PostgreSQL 14.25** server (`127.0.0.1:5432`) using least-privilege runtime roles (`viewora_app` on `viewora` and `viewora_test_app` on `viewora_test`), with `DEMO_MODE_ENABLED=false`, `PAYMENTS_ENABLED=false`, and a 64-character `base64url` `AUTH_SECRET` in `.env.local` (verified git-ignored via `git check-ignore -v .env.local`).

---

## 2. Live Infrastructure & Connection Verification (`npm run env:check`)

| Connection | Host / Port | Database | Role | `rolsuper` | `rolbypassrls` | Measured Latency | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | `127.0.0.1:5432` | `viewora` | `viewora_app` | `false` | `false` | `83 ms` | **PASS** |
| `DATABASE_ADMIN_URL` | `127.0.0.1:5432` | `viewora` | `postgres` | `true` | `true` | `73 ms` | **PASS** |
| `TEST_DATABASE_URL` | `127.0.0.1:5432` | `viewora_test` | `viewora_test_app` | `false` | `false` | `76 ms` | **PASS** |
| `TEST_DATABASE_ADMIN_URL` | `127.0.0.1:5432` | `viewora_test` | `postgres` | `true` | `true` | `65 ms` | **PASS** |

- `env:check` verdict: **`"ok": true`**, **`0` warnings**, **`0` errors**, zero Supabase env vars, `PAYMENTS_ENABLED=false`, `DEMO_MODE_ENABLED=false`.

---

## 3. Migrations, Role Grants, Double Seed & Health Check

- **All 4 Prisma SQL Migrations Applied Cleanly to Both `viewora` and `viewora_test` (PostgreSQL 14.25 compatible):**
  1. `20261125000001_initial_viewora_schema` (58 tables, 74 foreign keys, 147 indexes)
  2. `20261125000002_postgres_rls_and_roles` (`pgcrypto`, `app` helper schema, check constraints, initial RLS)
  3. `20261125000003_rls_hardening_and_least_privilege` (23 RLS policies across 16 tenant/privacy tables, `SECURITY DEFINER` owner helpers, `REVOKE ALL FROM PUBLIC`)
  4. `20261125000004_runtime_role_grants_and_test_role` (**Added in this pass:** grants least-privilege `USAGE`, `SELECT/INSERT/UPDATE/DELETE`, sequence, function execute, and `ALTER DEFAULT PRIVILEGES` to both `viewora_app` and `viewora_test_app`)
- **Migration Runner Support Added:** Added `test-admin` mode in `scripts/db/env-loader.mjs` plus `npm run db:migrate:test`, `npm run db:seed:test`, and `npm run test:e2e:pg` in `package.json`.
- **Idempotent Double Seeding Verified:** `npm.cmd run db:seed` executed **twice** on `viewora` and `npm.cmd run db:seed:test` executed **twice** on `viewora_test` with zero duplicates (`plans: 5`, `plan_billing_options: 15`, `plan_entitlements: 65`, `feature_flags: 5`, `cms_content: 6`).
- **Live Health Check (`npm.cmd run db:health` via `viewora_app`):** `status: "healthy"`, `engine: "postgresql"`, `latencyMs: 162`, `users: 0`, `plans: 5`, `featureFlags: 5`.

---

## 4. Real-World Issues Discovered & Fixed During Live Activation

1. **Truncated `AUTH_SECRET` in `.env.local`:** Caught immediately by `npm run env:check` (`29` chars < `32` minimum); silently regenerated to a 64-character `base64url` secret without printing the secret.
2. **Stale Table-Count Assertion (`40` vs actual `58`):** Live `npm run test:db` revealed `prisma/schema.prisma` defines **58** mapped tables; updated `postgres.integration.test.ts` to assert `58` tables and accept both `viewora_app` and `viewora_test_app` while strictly verifying `rolsuper=false` and `rolbypassrls=false`.
3. **Windows `pg_dump` Argument Ordering & Prisma `?schema=public` URI Parameter:** Live `npm run db:backup` caught both GNU-getopt flag ordering on Windows (`-Fc` after `$connUrl`) and libpq rejecting Prisma's `?schema=public`; fixed in `scripts/db/backup.ps1` and `scripts/db/restore.ps1`, plus added `-Format plain` (`psql -v ON_ERROR_STOP=1`) support for workstations where `pg_restore.exe` is blocked by Windows Application Control.
4. **Extended Personal Digital HQ 2.0, Onboarding, Widget Visibility & Phase 3 Module Persistence:** Wired `profile-prefs.repo.ts`, `user-module-state.repo.ts`, `CustomerDashboard.tsx`, and `/api/support` to persist natively in RLS-protected PostgreSQL with zero local disk writes.
5. **E2E Report Builder Payload Type:** Updated `scripts/e2e-postgres.mjs` to use valid enum `executive_summary` and guarantee synthetic account cleanup in `finally`.

---

## 5. End-to-End Live Verification Summary

| Suite | Result | Details |
| --- | --- | --- |
| **Live PostgreSQL Integration & RLS Suite (`npm run test:db`)** | **5 / 5 PASS** | 58 tables, 74 FKs, 147 indexes, 23 RLS policies, multi-user RLS isolation, private note protection, concurrent quota lock, HQ 2.0 + Phase 3 module RLS |
| **Live PostgreSQL Browser E2E + Restart Persistence (`npm run test:e2e:pg`)** | **ALL PASS** | Real UI signup/login, onboarding, dashboard/folders/notes, Profile HQ, Report Builder, Support, Membership, **full `next start` restart**, `db:create-admin` super admin, locked `payments_enabled` (`403`), account deletion cascade; `0` console/page errors; **11 live PG screenshots** |
| **Live Backup & Disposable Restore Drill** | **PASS** | Custom `.dump` (`166,497` bytes + SHA-256) + plain `.sql` restore into `viewora_restore_test`: **58/58 tables, 74/74 FKs, 147/147 indexes, 23/23 RLS policies**, synthetic records, and `viewora_test_app` RLS read verified identically |
