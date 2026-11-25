# Viewora — Development Backlog (Updated After Live PostgreSQL Activation)

**Date:** 2026-11-25  
**Status Legend:** `Pending Cloud Provisioning` · `Pending Enhancement` · `Deferred (By Scope Restriction)`

---

## 1. Pending Cloud Provisioning (Before Multi-Instance Production Hosting)

1. **Cloud Object Storage Driver (`Pending Cloud Provisioning`):**
   - Implement an S3 / GCS / Cloudflare R2 `FileStorageDriver` (`src/lib/storage/local-files.ts`) so custom avatar/cover uploads (`/api/auth/media`) scale across stateless serverless/container replicas.
2. **Distributed Background Worker & Cron Scheduler (`Pending Cloud Provisioning`):**
   - Attach a dedicated worker process / cloud scheduler reading PostgreSQL `background_jobs` (`SKIP LOCKED`) for automatic scheduled automation execution.
3. **Managed PostgreSQL 16 Staging & Live Lighthouse CI (`Pending Cloud Provisioning`):**
   - Provision managed PG 16 with PgBouncer + `?sslmode=require`, run `npm run env:check -- --strict` + `db:migrate:deploy` + `test:db`, and execute Lighthouse CI + manual NVDA/VoiceOver assistive-tech audits against the HTTPS staging URL.
4. **Local Windows App Control Policy for `pg_restore.exe` (Optional Workstation Admin Item):**
   - Plain-SQL backup & restore (`backup.ps1 -Format plain` + `restore.ps1` via `psql.exe`) and custom-format backup (`pg_dump -Fc`) are verified live; allowlisting `pg_restore.exe` (or installing signed PG16) enables local `.dump` restores as well.

---

## 2. Pending Engineering Enhancements (Post-Activation)

1. **Promote `referrals/service.ts` to Native PostgreSQL Tables (`Pending Enhancement`):**
   - Wire `src/lib/referrals/service.ts` directly to the existing `referral_codes`, `referral_attributions`, and `affiliate_accounts` Prisma models (currently fails closed cleanly with `503` on read-only filesystems).
2. **Optional Normalized Tables for Phase 3 Modules:**
   - Research Pro, Report Builder, Agency Center, and Automation Center are now verified live in RLS-protected PostgreSQL (`user_preferences.notification_preferences._modules`, zero disk writes, `ON DELETE CASCADE`); normalize into standalone tables only if cross-tenant SQL reporting is needed later.

---

## 3. Explicitly Deferred by Scope Restrictions (Do Not Activate Until Authorized)

1. **Stripe Billing & Affiliate Payouts (`Deferred — PAYMENTS_ENABLED=false`)**
2. **Official Meta Graph API / Business Discovery (`Deferred`)**
3. **Gemini Live API (`Deferred`)**
4. **Resend Transactional Email (`Deferred`)**
5. **External Analytics Providers (`Deferred`)**

---

## 4. Completed in Live PostgreSQL 14.25 Activation Pass

- [x] Verified `.env.local` git-ignored, upgraded `AUTH_SECRET` to 64-char `base64url`, verified all 4 live DB connections via `npm run env:check`
- [x] Added Migration 4 (`20261125000004_runtime_role_grants_and_test_role`) and `TEST_DATABASE_ADMIN_URL` runner support (`db:migrate:test`, `db:seed:test`, `test:e2e:pg`)
- [x] Executed all 4 Prisma migrations + idempotent double seeds on both `viewora` and `viewora_test` + verified `db:health` via `viewora_app`
- [x] Executed and passed **5/5 live PostgreSQL integration & RLS isolation tests (`npm run test:db`)** through `viewora_test_app` (`58` tables, `74` FKs, `147` indexes, `23` RLS policies)
- [x] Executed and passed **full live PostgreSQL production browser E2E (`npm run test:e2e:pg`)** including full `next start` restart persistence, super admin bootstrap, locked `payments_enabled` (`403`), account deletion cascade, `0` console/page errors, and **11 live PG screenshots**
- [x] Fixed Windows `pg_dump` flag ordering & Prisma `?schema=public` stripping in `backup.ps1` / `restore.ps1`, added `-Format plain` (`psql`) restore support, and verified live `.dump` backup + disposable `viewora_restore_test` restore fidelity (**58/58 tables, 74/74 FKs, 147/147 indexes, 23/23 RLS policies**, `restrictedRoleReadVerified: true`)
