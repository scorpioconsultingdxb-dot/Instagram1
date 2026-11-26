# Viewora — Hosted Neon PostgreSQL 18.7 Activation & Live Production Verification Report (`neon-bisque-harbor`)

**Date:** 2026-11-26  
**Live Canonical Production URL:** `https://instagram1-beta.vercel.app`  
**Verified Live Vercel Deployment:** `dpl_8AW3VMX12PsZdWKZTTD8NV4qH2M9` (`readyState: READY`, Team `scorpioconsultingdxb-9036`, Project `instagram1`)  
**Target Neon Resource:** `neon-bisque-harbor` (`branch: main`, `database: neondb`, `region: AWS US East 1`, `PostgreSQL 18.7`)  
**Overall Activation Status:** **LIVE & VERIFIED ON VERCEL PRODUCTION WITH RESTRICTED POOLED `viewora_app` ROLE (14/14 LIVE ACCEPTANCE CHECKS PASS)**  
**Locked Pre-Launch Gates:** `PAYMENTS_ENABLED=false` · `NEXT_PUBLIC_PAYMENTS_ENABLED=false` · `PUBLIC_REGISTRATION_ENABLED=false` (`403 REGISTRATION_CLOSED`) · `BETA_PUBLIC_REGISTRATION_ENABLED=false` · `DEMO_MODE_ENABLED=false` · `VIEWORA_ENABLE_DEMO_PROVIDER=false` · All External Paid Providers Disabled · Hosted Super Admin Pending Owner Interactive Bootstrap  
**Security Guarantee:** Zero passwords, secrets, raw connection strings, or OIDC tokens appear in this report. Local `.env.local` and local PostgreSQL `14.25` remain 100% untouched.

---

## 1. Live Neon PostgreSQL 18.7 Database Verification Summary

| Verification Layer | Verified Live Evidence | Status |
| :--- | :--- | :---: |
| **Neon Server & TLS** | `PostgreSQL 18.7 (3190d2f) on aarch64-unknown-linux-gnu` · pooled host `ep-raspy-king-bc4ymzob-pooler.c-16.us-east-1.aws.neon.tech` · `sslmode=require&pgbouncer=true` | **PASS** |
| **Restricted Runtime Role (`viewora_app`)** | Verified **both** via `db:hosted:verify` AND live runtime `GET https://instagram1-beta.vercel.app/api/health` `connectedRole` introspection: `role: "viewora_app"`, `rolsuper: false`, `rolcreatedb: false`, `rolcreaterole: false`, `rolbypassrls: false`, `member_of: []`, `owned_tables: 0`, `audit_logs` append-only (`SELECT`/`INSERT` only), `public_can_create: false` | **PASS** |
| **6 Forward-Only Migrations** | All 6 migrations (`20261125000001` → `20261126000001`) applied cleanly: **`58` tables · `6` migrations · `74` foreign keys · `147` indexes · `24` RLS policies · `1` `trg_audit_logs_immutable` trigger** | **PASS** |
| **Double Idempotent Seed** | **`5` plans · `15` billing options · `65` entitlements · `5` feature flags (`paymentsEnabled: false`) · `6` CMS entries · `0` users · `0` synthetic support tickets** | **PASS** |
| **Pooled Serverless RLS & Advisory Locks** | Transaction-local `set_config(..., true)` RLS isolation & `pg_advisory_xact_lock` verified over Neon PgBouncer | **PASS** |
| **Live Vercel Production Acceptance (`dpl_8AW3VMX12PsZdWKZTTD8NV4qH2M9`)** | `GET /api/health` → HTTP `200`, `database.status: "healthy"` (`268ms`), `security.source: "VIEWORA_DATABASE_URL"`, `restrictedRoleVerified: true`, `vercelProductionStrict: true`, `adminUrlAbsentFromRuntime: true`, `connectedRole.restrictedPrivilegeVerified: true`, `registration.publicOpen: false`, `payments.enabled: false`, all 5 providers (incl. `demo_fixture`) `disabled`; `10/10` public pages HTTP `200` (`0` Supabase); `POST /api/auth/signup` → HTTP `403` (`REGISTRATION_CLOSED`) | **PASS (14/14)** |
| **Local PostgreSQL `14.25` Preservation** | `.vercel`, `.env.local`, `.env.hosted.local` verified git-ignored; local `viewora` DB untouched (`db:health` → `healthy`, `220ms`, `users: 1`, `plans: 5`, `featureFlags: 5`) | **PASS** |

---

## 2. Exact Remaining Owner Actions

1. **Bootstrap Hosted Super Admin (Fresh Credentials Privately via Interactive Prompt — Never Copy Local Hash/Sessions):**
   ```powershell
   npm.cmd run db:hosted:bootstrap-admin
   ```
   After completion, sign in at `https://instagram1-beta.vercel.app/en/login` to verify Dashboard, Admin Console, reload persistence, and Logout.
2. **Review & Isolate Unnecessary Privileged Neon Marketplace Env Vars** (see §3 of [FINAL_VERCEL_ACTIVATION_AUDIT.md](file:///c:/Users/Scorpio/Videos/Instagram/FINAL_VERCEL_ACTIVATION_AUDIT.md)) — do not delete the Neon database.
3. **Verify Neon History Window ≥ 7 Days & Execute Linux Encrypted Backup + Isolated Branch Restore Drill** (see §4 of [FINAL_VERCEL_ACTIVATION_AUDIT.md](file:///c:/Users/Scorpio/Videos/Instagram/FINAL_VERCEL_ACTIVATION_AUDIT.md)) prior to starting Stage 69 Beta.
4. **External Providers & Billing:** Keep Resend, Gemini, Meta, Redis/Cron, public registration, and Stripe billing disabled until individually approved stage-by-stage.
