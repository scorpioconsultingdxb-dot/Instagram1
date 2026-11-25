# Viewora — Database Security & Multi-User Isolation Report

**Date:** 2026-11-25  
**Status:** **LIVE POSTGRESQL 14.25 RLS & LEAST-PRIVILEGE ISOLATION VERIFIED (`5/5` INTEGRATION TESTS PASS)**

---

## 1. Verified Role Separation & Least-Privilege Grants

| Role | Database | `rolsuper` | `rolbypassrls` | Verified Scope |
| --- | --- | --- | --- | --- |
| `postgres` | `viewora`, `viewora_test` | `true` | `true` | Migrations (`db:migrate:deploy`, `db:migrate:test`), seeding, `db:bootstrap-admin`, backups/restores ONLY |
| `viewora_app` | `viewora` | `false` | `false` | Application runtime (`DATABASE_URL`) — verified live via `env:check`, `db:health`, and `test:e2e:pg` |
| `viewora_test_app` | `viewora_test` | `false` | `false` | Integration tests (`TEST_DATABASE_URL`) — verified live via `env:check` and `npm run test:db` |

Migration 4 (`20261125000004_runtime_role_grants_and_test_role`) grants `USAGE ON SCHEMA public, app`, `EXECUTE ON ALL FUNCTIONS IN SCHEMA app`, `SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public`, `USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public`, and `ALTER DEFAULT PRIVILEGES` to both `viewora_app` and `viewora_test_app`, with zero hardcoded single-role assumptions.

---

## 2. Live-Verified Row-Level Security (23 Policies Across 16 Tables)

Verified directly in live PostgreSQL 14.25 (`pg_policies` count = `23`) under `NOBYPASSRLS` runtime roles:

- **Owner-only (Zero Admin Bypass):** `user_preferences` (including `hqExtended` and `_modules`), `notifications`, `provider_connections`, `consent_records`, `data_export_requests`.
- **Workspace-Member-Only (Zero Admin Bypass):** `saved_profiles`, `research_folders`, `profile_research_notes`, `comparison_projects`, `activity_events`, `ai_reports`, `report_exports`.
- **Owner-Controlled Workspace Membership:** `workspaces` (split SELECT vs owner write) and `workspace_members` (via `SECURITY DEFINER` `app.is_workspace_owner()` with `SET search_path = pg_catalog, public, app` and `REVOKE ALL FROM PUBLIC`).
- **Support Isolation:** `support_tickets` and `support_messages` (`support_tickets_owner_or_support`; customer `GET /api/support` binds `{ userId: user.id, role: 'user' }`).
- **Pooling-Safe Context:** `withUserRlsContext()` uses transaction-local `set_config(..., true)`, preventing cross-request context leakage under PgBouncer transaction pooling.

### Multi-User Cross-Tenant Isolation Proofs Executed Live (`npm run test:db`)
- Customer B cannot read Customer A's `saved_profiles`, `research_folders`, `profile_research_notes`, `notifications`, or `user_preferences` (returns `0` rows / `null` / `WorkspaceAuthorizationError`).
- Even `super_admin` cannot read Customer A's private `profile_research_notes` (`0` rows under RLS).
- Concurrent saved-profile requests are serialized per user via `pg_advisory_xact_lock` so Free tier quota (`1`) cannot be bypassed under race conditions.

---

## 3. Authentication, Secret Hygiene & Admin Governance Verified Live

- **`.env.local` Excluded from Git:** Confirmed via `git check-ignore -v .env.local` (`.gitignore:20:.env.local`); zero secrets printed in logs, tests, or reports.
- **`AUTH_SECRET` Strength Enforced:** 64-character `base64url` random secret verified by `env:check` (`>= 32` chars, non-placeholder).
- **Revocable Sessions & Password Security:** Bcrypt cost `12`, SHA-256 hashed session/verification/reset tokens, immediate session revocation on logout, password change, password reset, suspension, and account deletion.
- **Super Admin Bootstrap Hardening (`db:bootstrap-admin`):** Tested live during `test:e2e:pg`; rejects weak/placeholder passwords (`bootstrap-validation.ts`), hashes with bcrypt 12, logs `admin.bootstrap.created` / `admin.bootstrap.promoted`, and enforces locked `payments_enabled` (`HTTP 403` verified live).
