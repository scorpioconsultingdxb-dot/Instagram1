# Viewora — Database Scalability, Security & Governance Report

**Date:** 2026-11-26  
**Database Engine:** Independent PostgreSQL 14.25 (schema, migrations 1–5, and SQL verified compatible with PostgreSQL 14, 15, and 16)  
**ORM / Access Layer:** Prisma `6.19.3` with restricted least-privilege runtime roles (`viewora_app` on `viewora`, `viewora_test_app` on `viewora_test`; both `NOSUPERUSER`, `NOBYPASSRLS`)

## 1. Schema & Security Controls

- **58 mapped tables**, **74 foreign keys**, **147 database indexes**, **23 active Row-Level Security (RLS) policies**, and **5 applied forward-only migrations** (Migrations 1–4 untouched; Migration 5 added in Phase 4.1).
- **Transaction-Local RLS (`set_config(..., true)`):** Every tenant-scoped repository transaction sets `app.current_user_id` and `app.current_user_role` locally via `withUserRlsContext()` ([prisma.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/prisma.ts)), guaranteeing zero session-variable bleed across pooled PgBouncer / Prisma connections.
- **Database-Enforced Audit Log Immutability (Migration 5 — [migration.sql](file:///c:/Users/Scorpio/Videos/Instagram/prisma/migrations/20261125000005_audit_immutability_and_hardening/migration.sql)):**
  - `REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM viewora_app, viewora_test_app;`
  - `REVOKE CREATE ON SCHEMA public FROM PUBLIC;`
  - `BEFORE UPDATE OR DELETE` trigger `trg_audit_logs_immutable` (`app.prevent_audit_log_mutation()`) raises `ERRCODE 42501` on all `DELETE` and content `UPDATE` attempts (even from privileged roles), permitting exclusively PostgreSQL's `ON DELETE SET NULL` RI cascade on `actor_id` when a user row is deleted while keeping `actor_email`, `action`, `target_type`, `target_id`, `diff`, `ip_address`, and `created_at` immutable.
  - **Live Proof (`test:db` on `viewora_test`):** Confirmed both `viewora_test_app` and `postgres` fail on `UPDATE`/`DELETE` against `audit_logs`, while `deleteDbUserAccount` succeeds and preserves the forensic audit row.

## 2. Concurrency & Race-Condition Protection

- **Concurrent Tracked-Profile Quota Lock:** `persistDbSavedProfile` serializes parallel inserts per user inside a PostgreSQL transaction; `test:db` proves 4 parallel calls against a limit of 1 produce strictly `1` success and `3` `QuotaExceededError` rejections.
- **Concurrent Last-Super-Admin Protection (Phase 4.1):** `persistDbAdminUserUpdate` and `suspendDbUserAccount` acquire `SELECT pg_advisory_xact_lock(hashtext('viewora:super_admin_guard'))` inside `$transaction` when `enforceLastSuperAdminGuard: true`. `test:db` proves two simultaneous demotion attempts against the last 2 active Super Admins result in strictly `1` demotion and `1` `LAST_SUPER_ADMIN` (`409`) block, and suspending the remaining Super Admin throws `LastSuperAdminError`.

## 3. Pagination, Indexing & Pooling Readiness

- Admin user listings (`take: 200`), active sessions (`take: 25`), audit logs, and workspace queries use indexed sort keys (`created_at DESC`, `user_id`, `status`) to prevent unbounded table scans.
- PgBouncer is active on `127.0.0.1:6432` alongside direct PostgreSQL on `127.0.0.1:5432`; transaction-local `set_config(..., true)` is safe under PgBouncer transaction pooling (add `?pgbouncer=true` to `DATABASE_URL` when routing through PgBouncer in hosted deployment).

## 4. Operational Baseline & Backup / Upgrade Notes

- **Operational `viewora` Integrity (Verified Post-Testing):** `users: 1` (`Scorpio Marketing Agency`, `super_admin`, `agency`), `support_tickets: 0`, `audit_logs: 6`, `plans: 5`, `plan_billing_options: 15`, `plan_entitlements: 65`, `feature_flags: 5`, `cms_content: 6`.
- **Backup & Restore Status:** Protected baseline backup exists at `backups/viewora_viewora_20261125T190858Z.dump`, and a full disposable restore drill (`viewora_test` → `viewora_restore_test`, 58/58 tables, 74/74 FKs, 147/147 indexes, 23/23 RLS policies) passed on 2026-11-25. During Phase 4.1 re-verification, workstation Windows Application Control policy blocked local `pg_dump.exe` / `pg_restore.exe` binary execution; this OS-level host restriction is recorded transparently without attempting any bypass. Hosted staging/production deployments on Linux PostgreSQL 16 will execute `pg_dump -Fc` / `pg_restore` natively.
- **PG 14 → PG 16 Upgrade Path:** Migrations 1–5 use standard PostgreSQL 14–16 DDL (`CREATE SCHEMA IF NOT EXISTS`, `REVOKE CREATE ON SCHEMA public FROM PUBLIC`, standard PL/pgSQL triggers and `pg_advisory_xact_lock`). Zero PG 14-deprecated features exist, enabling a clean `pg_dump`/`pg_restore` or managed logical upgrade to PostgreSQL 16 in Phase 5 staging.
