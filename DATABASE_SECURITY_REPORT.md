# Viewora — Independent PostgreSQL Database Security & Architecture Report

**Date:** 2026-11-26  
**Database Engine:** Independent PostgreSQL 14.25 (PG 14–16 compatible) · Prisma ORM · **Zero Supabase**  
**Schema Inventory:** **58 tables · 74 foreign keys · 147 indexes · 24 Row-Level Security (RLS) policies · 6 forward migrations**

---

## 1. Least-Privilege Role & Connection Separation

| Connection Variable | Database | PostgreSQL Role | `rolsuper` | `rolbypassrls` | Permitted Purpose |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `DATABASE_URL` | `viewora` | `viewora_app` | `false` | `false` | Production/operational application runtime ONLY |
| `DATABASE_ADMIN_URL` | `viewora` | `postgres` | `true` | `true` | Schema migrations (`prisma migrate deploy`) & administrative bootstrap ONLY |
| `TEST_DATABASE_URL` | `viewora_test` | `viewora_test_app` | `false` | `false` | Isolated automated integration & browser E2E runtime |
| `TEST_DATABASE_ADMIN_URL` | `viewora_test` | `postgres` | `true` | `true` | Isolated test schema migrations & test fixture cleanup |

- Verified via `npm run env:check`: all 4 connections healthy, `.env.local` excluded from Git, `CREATE ON SCHEMA public` revoked from `PUBLIC` (Migration 5), and test safety guards refuse execution against any non-test database name (`viewora` operational DB strictly protected).

---

## 2. Database-Level Row-Level Security (24 Policies Across All Tenant Tables)

Every multi-tenant customer table enforces PostgreSQL RLS under restricted `NOBYPASSRLS` roles via `withUserRlsContext()` (`SET LOCAL app.current_user_id` / `app.current_user_role`):

- **Core Workspace & Private Data Isolation (Migrations 2–3):** `workspaces`, `workspace_members`, `research_folders`, `saved_profiles`, `profile_research_notes` (strictly private, inaccessible even to admins), `comparison_projects`, `ai_reports`, `report_exports`, `notifications`, `user_preferences`, `user_module_states`, `support_tickets`, `support_messages` (internal notes hidden from customers), `referrals`, `custom_reports`.
- **Encrypted OAuth Connections (`provider_connections_owner_only`):** Isolates `provider_connections` strictly to `user_id = app.current_user_id()`; tokens are additionally encrypted at rest with AES-256-GCM (`v1:<iv>:<tag>:<cipher>`).
- **Historical Snapshots (`profile_snapshots_workspace_isolation` — NEW Migration 6):** Added in Phase 5 Stage 44 (`20261126000001_profile_snapshots_rls`) after live PostgreSQL security testing detected that `profile_snapshots` lacked its own DB-level RLS policy. Enforces `EXISTS (SELECT 1 FROM public.saved_profiles sp WHERE sp.id = profile_snapshots.saved_profile_id AND app.is_workspace_member(sp.workspace_id))`, verified via both repository and raw SQL queries under `viewora_test_app` (`0` rows leaked cross-user).

---

## 3. Database-Enforced Immutability & Concurrency Locks

1. **Append-Only `audit_logs` (Migration 5):**
   - `REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM viewora_app, viewora_test_app;`
   - `BEFORE UPDATE OR DELETE` trigger `trg_audit_logs_immutable` raises `ERRCODE 42501` against direct mutations (even from `postgres`), while cleanly allowing PostgreSQL's `ON DELETE SET NULL` RI cascade on `actor_id` when a customer deletes their account (verifying all forensic columns remain untouched).
   - **Honest Limitation:** A compromised OS/database superuser (`postgres`) with DDL privileges could still `DISABLE TRIGGER`. Hosted production should stream `audit_logs` to an external WORM SIEM sink.
2. **PostgreSQL Advisory & Row Locks (`pg_advisory_xact_lock` / `FOR UPDATE SKIP LOCKED`):**
   - `viewora:super_admin_guard` — Serializes Last-Super-Admin demotion/suspension (`HTTP 409`).
   - `viewora:media_quota:<userId>` — Serializes concurrent avatar/cover uploads against the `3 MB` per-customer cap (`HTTP 413`).
   - `viewora:snapshot:<savedProfileId>` — Serializes deduplicated historical snapshot writes.
   - `viewora:distributed_api_budget` — Serializes multi-instance daily/monthly USD API spend reservations.
   - `FOR UPDATE SKIP LOCKED` on `public.background_jobs` — Guarantees single-worker lease claiming with stale-lease recovery.

---

## 4. Operational Baseline & Backup Status (Honest Workstation Constraint)

- **Operational `viewora` Verification (`inspect_test_data.mjs`):** **100% untouched** (`users: 1` `Scorpio Marketing Agency` `super_admin`/`agency`, `support_tickets: 0`, `audit_logs: 6`, `plans: 5`, `plan_billing_options: 15`, `plan_entitlements: 65`, `feature_flags: 5`, `cms_content: 6`).
- **Backup & Restore Note:** Local Windows Application Control policy on this workstation currently blocks `pg_dump.exe` and `pg_restore.exe` (never bypassed). The verified pre-policy baseline snapshot (`backups/viewora_viewora_20261125T190858Z.dump`) and full 58-table restore drill (`viewora_test` → `viewora_restore_test`) remain archived; automated scheduled `pg_dump -Fc` / `pg_restore` drills are scheduled for hosted Linux staging.
