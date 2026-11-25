# Viewora — Test Data Cleanup & Admin Baseline Report

**Date:** 2026-11-25  
**Target Database:** `viewora` (Independent PostgreSQL 14.25 · `127.0.0.1:5432`)  
**Permanent Super Admin Preserved:** `Scorpio Marketing Agency` (`marketing@scorpio.consulting`, role `super_admin`, tier `agency`)

---

## 1. Protected Pre-Cleanup Backup

Before modifying any rows in `viewora`, a full custom-format PostgreSQL backup and SHA-256 checksum were created via `npm.cmd run db:backup` (stored in git-ignored `./backups/`):

- **Backup File:** `backups/viewora_viewora_20261125T190858Z.dump`
- **SHA-256 Checksum:** `afa3149bd2b8f5720bc29fad785469dd5e6f0c38bc29f562c985103a0d721531`

---

## 2. Full 58-Table Forensic Inspection & Positive Identification

All **58 public tables** in `viewora` were inspected prior to cleanup. The following records were positively verified as synthetic fixtures originating from the automated `scripts/e2e-postgres.mjs` runs (`@viewora.test` domain, exact fixture subject, and corroborating timestamps/UUIDs in `audit_logs`):

| Table | Record ID | Positive Test-Origin Evidence | Action Taken |
| --- | --- | --- | --- |
| `support_tickets` | `71d4bc4e-82b1-4b4a-bae2-3725342fee75` | `email: e2e.customer.aef0d61c@viewora.test`, `subject: "PG E2E Support Verification"`, `userId: null`, corroborated by audit log `78d4fef2-4d96-4dc6-a9d0-b943d71cf4f1` (`18:47:24Z`) | **Removed (transactional)** |
| `support_tickets` | `abbf3978-d6a9-42e8-8682-db49255aa47a` | `email: e2e.customer.02fad83a@viewora.test`, `subject: "PG E2E Support Verification"`, `userId: null`, corroborated by audit log `530e9872-56e5-4684-90a3-de1db6148ad0` (`18:48:22Z`) | **Removed (transactional)** |
| `support_messages` | `2` rows linked to the 2 tickets above | Foreign key `ticket_id` referencing the 2 synthetic tickets (`ON DELETE CASCADE`) | **Removed via FK cascade** |
| `funnel_events` | `ae32b01e-f0fd-43c4-bcef-30b079760429` | `eventName: signup_completed`, `userId: null`, `createdAt: 18:47:14Z` (exact run-1 synthetic signup timestamp) | **Removed (transactional)** |
| `funnel_events` | `c1a26ad0-f42b-44b4-a387-e384c5693757` | `eventName: signup_completed`, `userId: null`, `sessionId: 9f6a27a7-6956-48bf-b374-5f9c0adced62` (exact UUID of deleted synthetic customer `e2e.customer.02fad83a@viewora.test` from audit log `776ece7c-d401-4b5f-93ae-5074c8749f03`) | **Removed (transactional)** |
| `account_deletion_requests` | `df7b3157-f625-4679-a7c6-15bac9bdf231` | `email: e2e.customer.02fad83a@viewora.test`, `status: completed` (`18:48:47Z`) | **Removed (transactional)** |

### Strictly Preserved Data (Zero Deletions / Zero Modifications)
- **Security Audit Trail (`audit_logs`):** All **5** existing audit entries were **100% preserved** (including `d6105b44-cbb0-4be5-ad19-b33dac72e4fe` for `marketing@scorpio.consulting` `admin.bootstrap.created`), and **1** immutable housekeeping audit record was appended (`86313fc2-f93f-4c5f-9fae-f44f8b129feb`, `system.housekeeping.synthetic_fixtures_removed`), bringing total audit logs to **6**.
- **Permanent Super Admin Account (`Scorpio Marketing Agency`):**
  - `id`: `0d507549-f807-4df8-8746-7f84ea3441d8`
  - `email`: `marketing@scorpio.consulting`
  - `role`: `super_admin` · `segment`: `agency` · `plan`: `agency` · `accountStatus`: `active`
  - `activeSessions`: `1` · `passwordHashUnchanged`: `true` (verified byte-for-byte inside the cleanup transaction)
- **Seeded Reference Tables:** `plans` (`5`), `plan_billing_options` (`15`), `plan_entitlements` (`65`), `feature_flags` (`5`), `cms_content` (`6`), `report_templates` (`2`), `cost_budgets` (`2`), `experiments` (`1`), `broadcast_notifications` (`1`), `system_settings` (`1`).

---

## 3. Clean Admin Console Baseline (Post-Cleanup Database Counts)

| Admin Console Metric | Before Cleanup | After Cleanup | Status |
| --- | ---: | ---: | --- |
| **Accounts (`users`)** | `1` | `1` (`Scorpio Marketing Agency`, `super_admin`, `Agency`) | **Verified** |
| **Open Support Tickets (`support_tickets`)** | `2` (synthetic) | `0` | **Clean** |
| **Support Messages (`support_messages`)** | `2` (synthetic) | `0` | **Clean** |
| **Funnel Events (`funnel_events`)** | `2` (synthetic) | `0` | **Clean** |
| **Deletion Requests (`account_deletion_requests`)** | `1` (synthetic) | `0` | **Clean** |
| **Audit Trail (`audit_logs`)** | `5` | `6` (5 preserved + 1 housekeeping audit entry) | **Intact** |
| **Plans / Entitlements / Feature Flags** | `5 / 65 / 5` | `5 / 65 / 5` (`payments_enabled` locked `false`) | **Verified** |

---

## 4. Preventive Safeguards Added for Future Automated Tests

1. **Isolated Test Database Enforcement (`scripts/e2e-postgres.mjs`, `package.json`, `postgres.integration.test.ts`):**
   - `npm run test:e2e:pg` now runs via `env-loader.mjs test`, targeting `TEST_DATABASE_URL` (`viewora_test_app` on `viewora_test`) and `TEST_DATABASE_ADMIN_URL` (`postgres` on `viewora_test`) by default.
   - Both `scripts/e2e-postgres.mjs` and `src/lib/db/postgres.integration.test.ts` now enforce a hard **Safety Block** refusing to execute against any database whose name does not match `/(^|_)test($|_)/i` (preventing accidental pollution of the main `viewora` database).
2. **Complete Transactional E2E Teardown (`scripts/e2e-postgres.mjs` `finally` & `postgres.integration.test.ts` `afterAll`):**
   - Explicitly removes synthetic `support_tickets` (cascading `support_messages`), `account_deletion_requests`, `funnel_events`, and synthetic `users` scoped strictly to the synthetic test emails/UUIDs so zero orphaned fixtures remain after any test pass or failure.

---

## 5. Post-Cleanup Verification Results

- `npm.cmd run db:health` (`viewora_app`): **PASS** (`status: "healthy"`, `98 ms`, `users: 1`, `plans: 5`, `featureFlags: 5`)
- `npm.cmd run env:check`: **PASS** (`"ok": true`, all 4 DB connections verified, `0` warnings/errors)
- `npm.cmd run lint` & `npm.cmd run typecheck`: **PASS** (`0` errors, `0` warnings)
- `npm.cmd run test`: **PASS** (**17 / 17 suites · 84 / 84 tests**)
- `npm.cmd run test:db` (isolated `viewora_test` via `viewora_test_app`): **PASS** (**5 / 5 live PostgreSQL RLS, RBAC & persistence tests** — main `viewora` DB untouched)
