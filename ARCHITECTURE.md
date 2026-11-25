# Viewora — System Architecture Documentation (Updated Phase 4)

**Date:** 2026-11-25  
**Stack:** Next.js `15.5.29` (App Router, TypeScript) · React `19` · Tailwind CSS `4` · Prisma ORM `6.19.3` · Independent PostgreSQL `14.25` (PG 14–16 compatible) · Zero Supabase.

---

## 1. High-Level Architecture
- **Public & SEO Layer (`/[locale]/*`):** 303 statically generated pages across 5 locales (`en`, `pt-BR`, `es`, `de`, `fr`), 12 deterministic Instagram tools, pricing, and 11 informational pages. Operates with **zero filesystem writes** and degrades gracefully when PostgreSQL is unavailable (Scenario B verified: 78/78 HTTP 200).
- **Authentication & Session Layer (`src/lib/auth/*`, `src/lib/db/repositories/users.repo.ts`):** Independent bcrypt (cost 12) + SHA-256 revocable DB sessions (`sessions`), single-use email verification & password reset tokens, CSRF origin enforcement, and rate limiting. Production demo mode is hard-disabled.
- **PostgreSQL & RLS Data Layer (`prisma/schema.prisma`, 4 SQL migrations, `src/lib/db/*`):**
  - **58 relational tables**, **74 foreign keys**, **147 indexes**, **23 RLS policies** across 16 tenant/privacy tables.
  - Strict role separation: `postgres`/`viewora_admin` for migrations/seeds/backups; restricted `viewora_app` (`viewora`) and `viewora_test_app` (`viewora_test`) with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS` for runtime/tests.
  - Transaction-local RLS context (`withUserRlsContext()` → `set_config(..., true)`) safe with PgBouncer transaction pooling.
  - Durable PostgreSQL storage for Personal HQ 3.0 (`hqExtended`), customer avatars/covers (`_media`), Phase 3/4 modules (`_modules`: `researchPro`, `customReports`, `agencyOrg`, `automation`, `referralCampaigns`), and native `referral_codes` / `referral_attributions` / `affiliate_accounts`.
- **Entitlements & Governance (`src/lib/entitlements/*`, `src/lib/admin/*`):** Centralized server-side plan entitlements (`Free`, `Starter`, `Premium`, `Pro`, `Agency`), per-user overrides, least-privilege admin RBAC, immutable `audit_logs`, last-super-admin & self-suspension guards, and locked `payments_enabled=false`.
- **Operations & Testing (`scripts/db/*`, `scripts/e2e-postgres.mjs`):** `env:check`, `db:health`, `db:migrate:deploy`, `db:migrate:test`, `db:seed`, `db:bootstrap-admin`, `db:backup` (`.dump`/`.sql` + `.sha256`), `db:restore`, `verify-backup-restore.mjs`, `test` (86 unit tests), `test:db` (6 live PG RLS tests on `viewora_test`), and `test:e2e:pg` (live PG browser E2E on `viewora_test`).
