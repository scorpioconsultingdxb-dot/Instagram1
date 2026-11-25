# Viewora — Database Security & Multi-User Isolation Report

**Date:** 2026-11-25  
**Scope:** PostgreSQL role separation, Row-Level Security (RLS), authentication/session security, secret hygiene, admin bootstrap hardening, and privacy compliance.

---

## 1. Role Separation & Least-Privilege Architecture

| Role | Privileges | Permitted Usage | Prohibited Usage |
| --- | --- | --- | --- |
| `postgres` | Superuser | One-time role/database creation only | **Never** used by Viewora application or CI |
| `viewora_admin` | Database owner, `CREATEDB` | `db:migrate:deploy`, `db:seed`, `db:bootstrap-admin`, `db:backup`, `db:restore` (`DATABASE_ADMIN_URL`) | **Never** assigned to runtime `DATABASE_URL` |
| `viewora_app` | `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`; `SELECT, INSERT, UPDATE, DELETE` on `public` tables; `USAGE`/`EXECUTE` on `app` RLS helpers | Next.js application runtime (`DATABASE_URL`) and RLS integration tests (`TEST_DATABASE_APP_URL`) | Cannot run DDL, drop tables, alter roles, or bypass RLS |

---

## 2. PostgreSQL Row-Level Security (RLS) Enforcement

All 16 tenant- and privacy-sensitive tables have `ENABLE ROW LEVEL SECURITY` enforced across Migrations 2 and 3:

- **Owner-only (Zero Admin Bypass):**
  - `user_preferences` (including Personal Digital HQ `hqExtended` and Phase 3 `_modules` JSON state)
  - `notifications`
  - `provider_connections` (OAuth tokens)
  - `consent_records`
  - `data_export_requests`
- **Workspace-Member-Only (Zero Admin Bypass):**
  - `saved_profiles`
  - `research_folders`
  - `profile_research_notes` (private research notes strictly inaccessible to admins or other tenants)
  - `comparison_projects`
  - `activity_events`
  - `ai_reports`
  - `report_exports`
- **Split Owner/Member Policies:**
  - `workspaces` (SELECT for owner/member; INSERT/UPDATE/DELETE strictly owner-only)
  - `workspace_members` (owner-controlled membership mutations via `SECURITY DEFINER` `app.is_workspace_owner()` with hardened `SET search_path = pg_catalog, public, app` and `REVOKE ALL FROM PUBLIC`)
- **Support Queue Isolation:**
  - `support_tickets` and `support_messages` (`support_tickets_owner_or_support` — customer sees own non-internal messages; only `support_agent`, `operations_admin`, `admin`, `super_admin` view the full queue and internal notes; `GET /api/support` now explicitly binds `{ userId: user.id, role: 'user' }`).

### Transaction-Local Context Pooling Safety
`withUserRlsContext()` (`src/lib/db/prisma.ts`) uses `set_config('app.current_user_id', ..., true)` and `set_config('app.current_user_role', ..., true)` inside `client.$transaction(...)`. Because `is_local = true`, session context automatically clears on transaction commit/rollback and **cannot leak across pooled connections (including PgBouncer in transaction pooling mode)**.

---

## 3. Authentication, Sessions & Secret Controls

- **Password Hashing:** `bcryptjs` cost factor `12` (`users.repo.ts`), dummy bcrypt comparison on unknown email to reduce timing enumeration.
- **Sessions:** Cryptographically random 32-byte opaque tokens hashed with SHA-256 before database storage (`sessions.session_token`), 7-day TTL, explicit `revoked_at` revocation (single session, all sessions, password change, password reset, account suspension, and account deletion), `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- **Super Admin Bootstrap (`scripts/db/create-admin.ts` + `src/lib/admin/bootstrap-validation.ts`):**
  - Zero hardcoded admin passwords anywhere in the codebase or `prisma/seed.ts`.
  - Enforces minimum 12-character password containing uppercase, lowercase, digit, and special character; rejects placeholder phrases and email local-part substrings.
  - Writes immutable `audit_logs` records for both `admin.bootstrap.created` and `admin.bootstrap.promoted`.
- **Preflight Secret & Safety Guard (`scripts/db/check-env.mjs`):**
  - Validates `AUTH_SECRET` length (`>= 32`), rejects placeholder strings, blocks `TEST_DATABASE_URL` pointing to the same database as `DATABASE_URL`, warns on runtime superuser `postgres` or missing `?sslmode=require` on non-local hosts, verifies zero Supabase env vars, and enforces `PAYMENTS_ENABLED=false`.
  - Never prints passwords, connection strings, or `AUTH_SECRET` values.
- **CSRF & Input Hardening:** Origin verification (`isAllowedCsrfOrigin`) on all state-changing routes; Zod schema validation; CSV formula-injection neutralization (`sanitizeCsvFormulaCell`); magic-byte PNG/JPEG/WebP upload verification; zero developer env var exposure in customer-facing auth error states.

---

## 4. Verification Status

- **Verified via Automated Tests (`84/84` passing):** Password hashing, session revocation, cross-account isolation repository logic, admin RBAC, locked `payments_enabled` guard, bootstrap password validation, RLS transaction context binding (`set_config`), and zero Supabase references.
- **Pending Owner Local Execution:** Live multi-user RLS execution against local PostgreSQL via `npm.cmd run test:db` (using `TEST_DATABASE_APP_URL` as `viewora_app`) once `.env.local` is provisioned by the owner.
