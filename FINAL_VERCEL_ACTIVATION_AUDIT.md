# Viewora — Final Vercel Activation & Production Configuration Audit

**Date:** 2026-11-26  
**Vercel Team / Project:** `scorpioconsultingdxb-9036` / `instagram1`  
**Live Production URL:** `https://instagram1-beta.vercel.app` (Latest Ready Deployment: `instagram1-cbjut942w-scorpioconsultingdxb-9036.vercel.app`)  
**Hosted Database:** Neon PostgreSQL **`18.7`** (`neon-bisque-harbor`, `main`, `neondb`, AWS US East 1)  
**Security Guarantee:** Zero secrets, passwords, raw connection strings, or OIDC tokens appear anywhere in this report. No existing sensitive Production variable (`VIEWORA_DATABASE_URL`, `AUTH_SECRET`) was overwritten, no automatic redeploy was triggered, payments/external APIs/public registration remain disabled, and local PostgreSQL `14.25` remains 100% intact.

---

## 1. Master Task Classification Table

**Classification Legend:** `Completed and verified` · `Configured but not verified` · `Pending owner action` · `Blocked by external access` · `Failed` · `Intentionally disabled`

| Task | Current Status | Actual Verification Evidence | Remaining Action | Owner Intervention Required? |
| :--- | :---: | :--- | :--- | :---: |
| **1. Local Config & `.gitignore` Protection** | **`Completed and verified`** | `git check-ignore -v .vercel .env.local .env.hosted.local` confirmed all 3 ignored. `.env.local` retained all 9 original local PG keys (plus `VERCEL_OIDC_TOKEN` from `vercel link`, never displayed). `npm run env:check` passed (`4/4` local PG pools reachable, `0` errors); `npm run db:health` passed (`healthy`, `161ms`, `users: 1`, `plans: 5`, `featureFlags: 5`). `.env.hosted.local` intact. | None. | **NO** |
| **2. Vercel Production Env Audit (`vercel env ls`)** | **`Completed and verified`** | Authenticated Vercel CLI `67.0.0` (`whoami: scorpioconsultingdxb-9036`) inspected all Production env vars (names only). Confirmed `AUTH_SECRET` & `VIEWORA_DATABASE_URL` already existed, `DATABASE_ADMIN_URL` is **absent**, 18 Neon Marketplace vars exist, and 17 Viewora runtime/safety vars were missing. | None — audit complete. | **NO** |
| **3. Missing Production Config Added (17 Vars)** | **`Configured but not verified`** *(takes effect on next deploy)* | Added all **17** missing non-secret Production variables cleanly via stdin (zero trailing newlines, zero overwrites to `AUTH_SECRET` or `VIEWORA_DATABASE_URL`): `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `DEMO_MODE_ENABLED`, `NEXT_PUBLIC_DEMO_MODE`, `VIEWORA_ENABLE_DEMO_PROVIDER`, `PAYMENTS_ENABLED`, `NEXT_PUBLIC_PAYMENTS_ENABLED`, `PUBLIC_REGISTRATION_ENABLED`, `BETA_PUBLIC_REGISTRATION_ENABLED`, `BACKGROUND_JOBS_ENABLED`, `EMAIL_NOTIFICATIONS_ENABLED`, `PROVIDER_META_ENABLED`, `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED`, `PROVIDER_LICENSED_THIRD_PARTY_ENABLED`, `PROVIDER_PUBLIC_DATASET_ENABLED`, `PROVIDER_GEMINI_ENABLED`, `PROVIDER_RESEND_ENABLED`. Verified all 17 present in `vercel env ls --environment production`. | Trigger a controlled Production redeploy after resolving the `VIEWORA_DATABASE_URL` value format finding below. | **YES** |
| **4. Live `VIEWORA_DATABASE_URL` Format Finding (CRITICAL)** | **`Failed`** *(Fail-Closed Guard Worked — Value Format Needs Fix)* | Live `GET https://instagram1-beta.vercel.app/api/health` on latest deployment `cbjut942w` returned `services.database.status: "not_configured"` and **`security.source: "blocked_missing_viewora_database_url"`** (`vercelProductionStrict: true`, `adminUrlAbsentFromRuntime: true`). Our strict fail-closed guard successfully **blocked fallback to Marketplace `neondb_owner` `DATABASE_URL`**, and revealed that the `VIEWORA_DATABASE_URL` value stored in Vercel 51m ago does **not** begin directly with `postgresql://` (most likely pasted with surrounding quotes `"postgresql://..."` or the `VIEWORA_DATABASE_URL=` key prefix). | **Owner approval required** to update `VIEWORA_DATABASE_URL` in Vercel Production with the raw unquoted `postgresql://viewora_app:...&pgbouncer=true` URI from `.env.hosted.local` (either in Vercel UI or by authorizing CLI replacement via stdin), then redeploy. | **YES** |
| **5. Privileged Neon Marketplace Credential Isolation** | **`Pending owner action`** | Audited all **18** Marketplace-managed Neon variables present in Preview & Production (10 privileged owner/credential vars + 8 host/metadata vars; see §3). Ignoring them in app code is defense-in-depth, **not** full credential isolation. | Do **not** disconnect Neon or delete the DB. Review §3 safe isolation procedure and authorize unscoping/removing unnecessary privileged owner vars from Vercel Production runtime after `VIEWORA_DATABASE_URL` is verified live. | **YES** |
| **6. Live Registration Closure & Public Pages** | **`Completed and verified`** | Latest live deploy `cbjut942w` passed `POST https://instagram1-beta.vercel.app/api/auth/signup` → **HTTP `403`** (`code: "REGISTRATION_CLOSED"`), cleanly distinguished from DB unavailability (`503`), and `/api/health` reported `registration: { publicOpen: false, mode: "invitation_only_closed" }`. All 10/10 public routes returned HTTP `200` with zero Supabase mentions. | After fixing `VIEWORA_DATABASE_URL` + redeploying + bootstrapping Super Admin, test authenticated login, dashboard, admin console, reload persistence & logout. | **YES** *(post-deploy auth test)* |
| **7. Hosted Neon PostgreSQL 18.7 Verification** | **`Completed and verified`** | `npm run db:hosted:verify` & `db:hosted:health` passed live via pooled `viewora_app`: **58 tables, 6 migrations, 74 FKs, 147 indexes, 24 RLS policies, 1 audit trigger, 5 plans, 15 billing, 65 entitlements, 5 flags (`payments=false`), 6 CMS, `users: 0`, `tickets: 0`**, `status: "healthy"`. | None — no migrations or seeds repeated. | **NO** |
| **8. Hosted Super Admin Readiness** | **`Pending owner action`** | Confirmed `users: 0` on Neon `neondb`; `npm.cmd run db:hosted:bootstrap-admin` verified ready (never copies local password hash or sessions). | Owner runs `npm.cmd run db:hosted:bootstrap-admin` interactively locally with fresh strong credentials once ready. | **YES** |
| **9. Regression, Build & Zero-CVE Security** | **`Completed and verified`** | Verified: `typecheck` (`0`) · `lint` (`0`) · `npm test` (**24/24 suites · 120/120 tests**) · `npm run build` (**322/322 static pages**, `103 kB` FLJS) · `npm audit` (`0`) · `npm audit --omit=dev` (`0`). | None. | **NO** |
| **10. Neon Backup/PITR & Commercial Gates** | **`Pending owner action`** / **`Intentionally disabled`** | Neon Instant Restore: Free `6h` · Launch up to `7d` · Scale up to `30d`. Local `pg_dump` remains blocked by Windows App Control. Payments, external APIs, background jobs & public registration remain `Intentionally disabled`. | Confirm Neon History Window ≥ 7d, run Linux encrypted dump + isolated branch restore drill, and clear separate provider/legal/beta/billing gates before commercial launch. | **YES** |

---

## 2. Complete Verified Vercel Production Environment Variable Inventory (37 Total)

### A. Existing Preserved Viewora Sensitive Variables (2 — Untouched)
- `AUTH_SECRET` *(Secret · Production — added 33m ago)*
- `VIEWORA_DATABASE_URL` *(Secret · Production — added 51m ago — **format fix requires Owner approval**)*

### B. Newly Added Viewora Production Variables (17 — Added & Verified via `vercel env ls`)
- `AUTH_URL` = `https://instagram1-beta.vercel.app`
- `NEXT_PUBLIC_APP_URL` = `https://instagram1-beta.vercel.app`
- `DEMO_MODE_ENABLED` = `false`
- `NEXT_PUBLIC_DEMO_MODE` = `false`
- `VIEWORA_ENABLE_DEMO_PROVIDER` = `false`
- `PAYMENTS_ENABLED` = `false`
- `NEXT_PUBLIC_PAYMENTS_ENABLED` = `false`
- `PUBLIC_REGISTRATION_ENABLED` = `false`
- `BETA_PUBLIC_REGISTRATION_ENABLED` = `false`
- `BACKGROUND_JOBS_ENABLED` = `false`
- `EMAIL_NOTIFICATIONS_ENABLED` = `false`
- `PROVIDER_META_ENABLED` = `false`
- `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED` = `false`
- `PROVIDER_LICENSED_THIRD_PARTY_ENABLED` = `false`
- `PROVIDER_PUBLIC_DATASET_ENABLED` = `false`
- `PROVIDER_GEMINI_ENABLED` = `false`
- `PROVIDER_RESEND_ENABLED` = `false`

### C. Confirmed Absent From Vercel Runtime
- `DATABASE_ADMIN_URL` — **NOT present in Vercel** (`adminUrlAbsentFromRuntime: true` verified live on `/api/health`).

---

## 3. Privileged Neon Marketplace Credential Audit & Safe Isolation Procedure (18 Vars)

Vercel's Neon Marketplace integration currently injects **18 variables** into Preview & Production:
- **10 Privileged Owner / Credential Variables (High Priority to Isolate):**
  `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`, `POSTGRES_PRISMA_URL`, `PGPASSWORD`, `POSTGRES_PASSWORD`, `PGUSER`, `POSTGRES_USER`
- **8 Non-Secret Host / Metadata Variables (Low Risk):**
  `PGHOST`, `PGHOST_UNPOOLED`, `POSTGRES_HOST`, `PGDATABASE`, `POSTGRES_DATABASE`, `NEON_PROJECT_ID`, `NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_URL`

### Safe Non-Destructive Isolation Procedure (Execute ONLY With Owner Approval — Never Delete DB)
1. **First:** Fix `VIEWORA_DATABASE_URL` format (raw unquoted `postgresql://viewora_app:...&pgbouncer=true`), redeploy Vercel Production, and verify `GET https://instagram1-beta.vercel.app/api/health` reports `database.status: "healthy"` and `database.security.source: "VIEWORA_DATABASE_URL"`.
2. **Second:** Confirm ZERO active runtime dependency on Marketplace `DATABASE_URL` or `POSTGRES_*` variables (already guaranteed in code for Vercel Production).
3. **Third (Owner Choice in Vercel Dashboard → Integrations → Neon / Environment Variables):**
   - **Preferred:** Edit the Neon Marketplace integration's **Manage / Connected Projects** settings in Vercel to unscope/unlink auto-injected owner env vars from `instagram1` Production (this removes the owner env vars from Vercel runtime **without** deleting the Neon project or database in Neon Console!).
   - **Alternative if Marketplace blocks individual removal:** Rotate `neondb_owner` password in Neon Console only if needed, or migrate `neon-bisque-harbor` to direct Neon-managed billing so Vercel holds **ONLY** `VIEWORA_DATABASE_URL` (`viewora_app`).

---

## 4. Live Production `/api/health` Snapshot (Deployment `cbjut942w` — `2026-11-26T10:39:29Z`)

```json
{
  "ok": true,
  "services": {
    "database": {
      "engine": "postgresql",
      "configured": false,
      "reachable": false,
      "status": "not_configured",
      "latencyMs": null,
      "security": {
        "source": "blocked_missing_viewora_database_url",
        "restrictedRoleVerified": false,
        "vercelProductionStrict": true,
        "adminUrlAbsentFromRuntime": true
      }
    },
    "registration": { "publicOpen": false, "mode": "invitation_only_closed" },
    "demoMode": { "enabled": false },
    "payments": { "enabled": false },
    "backgroundJobs": { "enabled": false },
    "emailDelivery": { "enabled": false },
    "aiEngine": { "geminiConfigured": false, "killSwitchActive": false }
  }
}
```
- Live `POST https://instagram1-beta.vercel.app/api/auth/signup`: **HTTP `403`** (`code: "REGISTRATION_CLOSED"`).

---

## 5. Exact Remaining Owner Actions (Ordered, Minimal)

1. **Fix `VIEWORA_DATABASE_URL` Format in Vercel Production (Approval Required):**
   - Either update `VIEWORA_DATABASE_URL` in Vercel Dashboard with the exact unquoted URI from local `.env.hosted.local` (starting directly with `postgresql://viewora_app:` — **no surrounding `"` quotes and no `VIEWORA_DATABASE_URL=` prefix**), **OR** grant approval for me to replace `VIEWORA_DATABASE_URL` safely via stdin from `.env.hosted.local`.
2. **Trigger One Controlled Production Redeploy in Vercel** (activating the fixed `VIEWORA_DATABASE_URL` AND all 17 newly added Production variables, including `VIEWORA_ENABLE_DEMO_PROVIDER=false`, `AUTH_URL`, and `NEXT_PUBLIC_APP_URL`).
3. **Re-Verify Live `https://instagram1-beta.vercel.app/api/health`:** Confirm `database.status: "healthy"`, `security.source: "VIEWORA_DATABASE_URL"`, `restrictedRoleVerified: true`, `adminUrlAbsentFromRuntime: true`, `registration.publicOpen: false`, and `demo_fixture` disabled.
4. **Bootstrap Hosted Super Admin Interactively:** Run `npm.cmd run db:hosted:bootstrap-admin` locally with fresh credentials, then verify live login, Dashboard, Admin Console, reload persistence, and Logout.
5. **Isolate Privileged Neon Marketplace Owner Env Vars (§3)** and confirm Neon History Window ≥ 7 days + Linux encrypted backup/restore drill before beta.
