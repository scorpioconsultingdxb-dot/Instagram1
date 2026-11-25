# Viewora — Automated, Runtime & Live PostgreSQL Test Report

**Date:** 2026-11-25  
**Environment:** Windows Workstation · Node.js `v24.19.0` · Next.js `15.5.29` · Prisma `6.19.3` · **PostgreSQL `14.25` (Live)** · Vitest `3.2.7` · Headless Google Chrome (CDP)

---

## 1. Complete Verification Summary

| Suite / Check | Command | Result | Verified Output |
| --- | --- | --- | --- |
| **Env & 4-Connection Preflight** | `npm.cmd run env:check` | **PASS** | `"ok": true`, `0` warnings/errors, all 4 DBs reachable (`viewora_app`/`viewora_test_app` `super=false`, `bypassrls=false`) |
| **Migrations (`viewora` & `viewora_test`)** | `db:migrate:deploy` & `db:migrate:test` | **PASS** | All 4 SQL migrations applied cleanly on PostgreSQL 14.25 |
| **Idempotent Double Seed (Both DBs)** | `db:seed` (2×) & `db:seed:test` (2×) | **PASS** | `0` duplicates (`5` plans, `15` billing options, `65` entitlements, `5` flags, `6` CMS records) |
| **Live Database Health (`viewora_app`)** | `npm.cmd run db:health` | **PASS** | `status: "healthy"`, `162 ms`, `plans: 5`, `featureFlags: 5` |
| **Live PostgreSQL Integration & RLS Suite** | `npm.cmd run test:db` | **PASS (5 / 5)** | **58 tables, 74 FKs, 147 indexes, 23 RLS policies**, cross-user isolation, private note privacy, quota lock, HQ 2.0 + Phase 3 module RLS (`6.18 s`) |
| **Live PostgreSQL Production Browser E2E** | `npm.cmd run test:e2e:pg` | **PASS (7 / 7 milestones)** | Full UI signup/login, onboarding, dashboard, Profile HQ, Report Builder, Support, Membership, **full `next start` restart persistence**, `db:create-admin` super admin, locked `payments_enabled` (`403`), account deletion; `0` console/page errors; **11 live screenshots** |
| **Live Backup & Disposable Restore Drill** | `backup.ps1` + `restore.ps1` + `verify-backup-restore.mjs` | **PASS** | `.dump` (`166,497` bytes) + plain `.sql` restore into `viewora_restore_test`: **58/58 tables, 74/74 FKs, 147/147 indexes, 23/23 RLS policies**, synthetic data, `viewora_test_app` RLS read matched |
| **Scenario A Public No-DB Read-Only Prod QA** | `strict_recovery_qa.mjs` | **PASS (78 / 78 routes)** | `5` locales, `6` viewports (`0px` overflow), dark theme, interactive calculator, `0` console/page/5xx/stderr errors |
| **ESLint & TypeScript** | `npm.cmd run lint` & `typecheck` | **PASS** | `0` errors, `0` warnings |
| **Unit & Mock-Repo Test Suite** | `npm.cmd run test` | **PASS (17 files · 84 / 84)** | All auth security, Prisma repo, entitlement, analytics, Phase 3, runtime recovery & DB activation tests passing |
| **Production Build** | `npm.cmd run build` | **PASS (302 pages)** | `302 / 302` static pages, `103 kB` shared JS, `0` Supabase matches |

---

## 2. Live PostgreSQL-Connected Screenshots (Visually Inspected)

Saved in `C:\Users\Scorpio\.gemini\antigravity\brain\36811d4f-f53f-4027-a394-ebcca0dde9f6\`:
- `pg_e2e_home_1440px.png`, `pg_e2e_home_390px.png`, `pg_e2e_register_1440px.png`, `pg_e2e_onboarding_1440px.png`, `pg_e2e_dashboard_1440px.png`, `pg_e2e_dashboard_390px.png`, `pg_e2e_profile_hq_1440px.png`, `pg_e2e_report_builder_1440px.png`, `pg_e2e_membership_1440px.png`, `pg_e2e_login_1440px.png`, `pg_e2e_admin_1440px.png`.
