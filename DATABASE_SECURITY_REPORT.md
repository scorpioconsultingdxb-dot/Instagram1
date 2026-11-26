# Viewora — Independent PostgreSQL Database Security Report (Updated Stage 50)

**Date:** 2026-11-26  
**Database Engine:** Independent PostgreSQL 14.25 (PG 14–16 compatible) · Prisma ORM · **Zero Supabase**  
**Schema Inventory:** **58 tables · 74 foreign keys · 147 indexes · 24 Row-Level Security (RLS) policies · 6 forward migrations**

---

## 1. Role Separation & Connection Security

| Variable | Database | Role | `rolsuper` | `rolbypassrls` | Role Scope |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `DATABASE_URL` | `viewora` | `viewora_app` | `false` | `false` | Operational application runtime |
| `DATABASE_ADMIN_URL` | `viewora` | `postgres` | `true` | `true` | Migrations & bootstrap only |
| `TEST_DATABASE_URL` | `viewora_test` | `viewora_test_app` | `false` | `false` | Isolated automated tests |
| `TEST_DATABASE_ADMIN_URL` | `viewora_test` | `postgres` | `true` | `true` | Isolated test migrations & cleanup |

---

## 2. Row-Level Security (24 Policies) & Migration 6 Hardening

- Every customer-owned table (`workspaces`, `saved_profiles`, `profile_research_notes`, `profile_snapshots` [Migration 6], `provider_connections`, `comparison_projects`, `ai_reports`, `report_exports`, `user_preferences`, `notifications`, `support_tickets`, `support_messages`) enforces RLS under `viewora_app` / `viewora_test_app` (`NOBYPASSRLS`).
- **Migration 6 (`20261126000001_profile_snapshots_rls`):** Applied cleanly to both `viewora` and `viewora_test`, verified via live PostgreSQL test #8 under both repository and raw SQL queries (`0` rows leaked cross-user).
- **Private Research Notes & AI Conversations:** Strictly isolated to their owning account; completely inaccessible to other users and administrators.

---

## 3. Atomic Concurrency Locks & Immutability

- **Migration 5 (`audit_logs` Immutability):** `REVOKE UPDATE, DELETE, TRUNCATE` from runtime roles + `trg_audit_logs_immutable` trigger (`ERRCODE 42501`), verified in `test:db` #7 and respected by Stage 48.5 `executeDataRetentionCleanup()` (`auditLogsDeleted: 0`).
- **Verified Advisory & Row Locks (`test:db` #7, #8, #9):**
  - `viewora:super_admin_guard` — Last-Super-Admin race protection (`HTTP 409`)
  - `viewora:media_quota:<userId>` — 3 MB per-customer media quota serialization (`HTTP 413`)
  - `viewora:snapshot:<savedProfileId>` — Deduplicated snapshot writes
  - `viewora:distributed_api_budget` — Atomic multi-instance USD spend cap enforcement
  - `viewora:ai_quota:<userId>` — Atomic concurrent monthly AI quota lock (5 parallel calls vs limit 3 → strictly 3 allowed, 2 rejected)
  - `FOR UPDATE SKIP LOCKED` on `public.background_jobs` — Single-worker atomic leasing

---

## 4. Operational Baseline Integrity

- Verified post-Suite via `inspect_test_data.mjs`: operational `viewora` DB is **100% untouched** (`Scorpio Marketing Agency`, `super_admin`/`agency`, `users: 1`, `support_tickets: 0`, `audit_logs: 6`).
