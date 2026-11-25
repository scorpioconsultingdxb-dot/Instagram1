# Viewora — Commercial Production Readiness Assessment

**Date:** 2026-11-25  
**Overall Verdict:** **FULLY ACTIVATED & VERIFIED LOCALLY ON REAL POSTGRESQL 14.25 — READY FOR STAGING / CLOUD PROVISIONING** (Cloud object storage for multi-instance uploads, distributed worker scheduling, HTTPS staging Lighthouse CI, and explicitly excluded external APIs/payments remain for cloud deployment phase).

---

## 1. Honest Readiness Matrix

| Domain | Status | Verified Evidence |
| --- | --- | --- |
| **Build, Lint, Types & Unit Tests** | **Verified** | `eslint` `0/0` · `tsc` `0` · **84/84 unit tests (17 suites)** · **302/302 static pages** · zero Supabase |
| **Public Site Resilience (Scenario A — No DB + Read-Only FS)** | **Verified Live** | **78/78 public routes HTTP 200**, 5 locales, 6 viewports (`0px` overflow), dark mode, interactive tool pass, `0` errors |
| **Independent PostgreSQL Activation (Scenario B — Live PG 14.25)** | **Verified Live** | `env:check` (`ok: true`, all 4 connections), 4 SQL migrations on `viewora` & `viewora_test`, 2× idempotent seed on both DBs, `db:health` healthy via `viewora_app` (`162 ms`) |
| **Multi-User RLS & Database Security** | **Verified Live** | **5/5 live integration tests (`test:db`)** against `viewora_test` via restricted `viewora_test_app` (`rolsuper=false`, `rolbypassrls=false`): 58 tables, 74 FKs, 147 indexes, 23 RLS policies, private notes inaccessible to admins/other tenants, concurrent quota lock |
| **End-to-End Customer & Admin Flows + Restart Persistence** | **Verified Live** | **`test:e2e:pg` PASS** (`0` console/page errors, **11 live PG screenshots**): UI registration, onboarding, saved profiles/folders/notes, Personal HQ 2.0, widgets, Report Builder, Support, Membership, **full `next start` restart persistence**, `db:bootstrap-admin` super admin, locked `payments_enabled` (`403`), confirmed account deletion |
| **Backup & Disposable Restore Fidelity** | **Verified Live** | Custom `.dump` (`166,497` B + SHA-256) + plain `.sql` restore into `viewora_restore_test`: **58/58 tables, 74/74 FKs, 147/147 indexes, 23/23 RLS policies**, synthetic data & `viewora_test_app` RLS read matched (`pg_restore.exe` remains subject to local Windows App Control policy) |
| **Cloud Object Storage & Distributed Workers** | **Pending Cloud Provisioning** | Needed before multi-instance cloud autoscaling for `/api/auth/media` uploads and scheduled jobs (documented in `PRODUCTION_DATABASE_GUIDE.md`) |
| **External APIs & Payments (Meta, Gemini, Resend, Stripe)** | **Intentionally Inactive** | Preserved behind clean interfaces; `PAYMENTS_ENABLED=false` strictly locked |

---

## 2. Next Owner Actions

1. **Create Your Permanent Super Admin Account** on `viewora` when ready:
   ```powershell
   npm.cmd run db:bootstrap-admin
   ```
   (Prompts interactively for email, full name, and a strong >= 12-character mixed-class password.)
2. **Start Viewora Connected to Your Live PostgreSQL Database:**
   ```powershell
   npm.cmd run start
   ```
   Open `http://localhost:3000/en`, register a real account, and verify `http://localhost:3000/api/health`.
3. **Manual GitHub Sync:** Push reviewed local commits to GitHub manually when ready.
4. **Cloud Deployment:** Follow [PRODUCTION_DATABASE_GUIDE.md](./PRODUCTION_DATABASE_GUIDE.md) when provisioning managed PostgreSQL 16 + S3/GCS/R2 object storage.
