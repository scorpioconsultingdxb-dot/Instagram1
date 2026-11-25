# Viewora — Commercial Production Readiness Assessment

**Date:** 2026-11-25  
**Overall Verdict:** **APPLICATION CODE READY FOR POSTGRESQL ACTIVATION — NOT YET COMMERCIALLY LIVE** (Live Scenario B verification against a provisioned PostgreSQL database and backup/restore drill remain **Pending Owner Credentials / Infrastructure**).

---

## 1. Honest Readiness Matrix

| Domain | Status | Evidence & Remaining Gate |
| --- | --- | --- |
| **Build, Lint, Types & Unit/Repo Tests** | **Verified** | `prisma validate/generate` pass · `eslint` `0/0` · `tsc` `0` · **84/84 tests (17 suites)** · **302/302 static pages** |
| **Public Site Stability (Scenario A — No DB + Read-Only FS)** | **Verified Live** | **78/78 public routes HTTP 200**, 5 locales, 6 viewports (`0px` overflow), dark theme, interactive tool pass, `0` console/page/5xx/stderr errors |
| **Full PostgreSQL Persistence & RLS Code Architecture** | **Verified (Code + Repo Tests)** | Zero Supabase; 40 Prisma models + 3 SQL migrations + 16 RLS-protected tables; Personal HQ 2.0, Onboarding, Widgets, Research Pro, Report Builder, Agency, Automation, and Support all wired to PostgreSQL under `viewora_app` RLS with zero local disk writes |
| **Startup Preflight & Super Admin Bootstrap** | **Verified (Code + CLI)** | `npm run env:check` validates config/role separation/safety locks without exposing secrets; `npm run db:bootstrap-admin` enforces mixed-class >= 12-char passwords and writes audit logs |
| **Live Local PostgreSQL Activation (Scenario B)** | **Pending Owner Credentials** | Native `postgresql-x64-14` (`C:\Program Files\PostgreSQL\14\bin`) + `pgbouncer` detected running on port `5432`/`6432`, but requires owner's `postgres` password to create `viewora` / `viewora_test` DBs and `.env.local`, then run `migrate deploy`, 2× `db:seed`, `db:health`, `test:db`, and `scripts/e2e-postgres.mjs` |
| **Backup & Disposable Restore Drill** | **Pending Owner Infrastructure** | `backup.ps1` / `restore.ps1` upgraded with auto-discovery; local `PostgreSQL\14\bin\pg_restore.exe` is currently blocked by Windows Application Control and needs allowlisting or PG16 installation |
| **Stateless Cloud Object Storage & Distributed Workers** | **Pending Cloud Provisioning** | Required before multi-instance / serverless deployment for `/api/auth/media` uploads and scheduled automation jobs (documented in `PRODUCTION_DATABASE_GUIDE.md`) |
| **External APIs & Payments (Meta, Gemini, Resend, Stripe)** | **Intentionally Inactive** | Preserved behind clean interfaces; `PAYMENTS_ENABLED=false` strictly locked |

---

## 2. Exact Owner Activation Sequence (5 Minutes Once Ready)

1. Follow [`WINDOWS_POSTGRESQL_SETUP.md`](./WINDOWS_POSTGRESQL_SETUP.md) to create `viewora_admin`, `viewora_app`, `viewora`, `viewora_test`, and `.env.local` (with generated 64-hex `AUTH_SECRET`).
2. Run `npm.cmd run env:check` → confirm `"ok": true` and live `SELECT 1` latency.
3. Run `npm.cmd run db:migrate:deploy`, `npm.cmd run db:seed` (twice), `npm.cmd run db:health`, and `npm.cmd run db:bootstrap-admin`.
4. Run `npm.cmd run test:db` and `node scripts/e2e-postgres.mjs` to complete **Scenario B** and generate live PostgreSQL-connected screenshots (`pg_e2e_*.png`).
5. Complete a disposable backup/restore drill (`db:backup` → `db:restore -TargetDb viewora_restore_test -ConfirmRestore` → `verify-backup-restore.mjs`) and review [`PRODUCTION_DATABASE_GUIDE.md`](./PRODUCTION_DATABASE_GUIDE.md) before cloud hosting.
6. Push verified commits to GitHub manually when satisfied (all GitHub operations remain strictly owner-managed).
