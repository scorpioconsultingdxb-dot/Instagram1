# Viewora — Final Vercel Activation & Pending Tasks Audit

**Date:** 2026-11-26  
**Live Website Audited:** `https://instagram1-beta.vercel.app`  
**Vercel Project:** `instagram1`  
**Hosted Database:** Neon PostgreSQL **`18.7`** (`neon-bisque-harbor`, `main`, `neondb`, AWS US East 1)  
**Security Guarantee:** Zero credentials, passwords, or raw connection strings appear anywhere in this report. No unauthorized deployment, payment activation, external API activation, public registration opening, or local database modification was executed.

---

## 1. Master Task Classification Table (Tasks 1–10)

**Classification Legend:** `Completed and verified` · `Configured but not verified` · `Pending owner action` · `Blocked by external access` · `Failed` · `Intentionally disabled`

| Task | Current Status | Actual Verification Evidence | Remaining Action | Owner Intervention Required? |
| :--- | :---: | :--- | :--- | :---: |
| **Task 1 — Vercel CLI & Production Env Audit** | **`Blocked by external access`** *(partially `Configured but not verified`)* | Local workstation check confirmed `VERCEL_CLI_INSTALLED: False` and `.vercel/project.json` absent. Prior owner screenshot showed `AUTH_SECRET` & `VIEWORA_DATABASE_URL` added to Production; live `POST /api/auth/signup` returned HTTP `503 ("Authentication service is not configured securely.")` proving `AUTH_URL`/`NEXT_PUBLIC_APP_URL` or post-secret redeploy is not yet active live. | Add `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `VIEWORA_ENABLE_DEMO_PROVIDER=false`, `EMAIL_NOTIFICATIONS_ENABLED=false`, `PROVIDER_PUBLIC_DATASET_ENABLED=false`, and all explicit `false` flags in Vercel Production (see §2). | **YES** |
| **Task 2 — Production Database Security** | **`Configured but not verified`** *(live Vercel)* / **`Completed and verified`** *(Neon & local code)* | On Neon (`db:hosted:verify`), `viewora_app` verified `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`, `owned_tables: 0`, `member_of: []`, `audit_logs` append-only, pooled TLS `sslmode=require&pgbouncer=true`. Strict Vercel non-fallback & `viewora_app`-only enforcement verified in local code & unit tests (`120/120`), **not yet deployed to Vercel**. Marketplace-managed `neondb_owner` vars (`DATABASE_URL`, `PGPASSWORD`, `POSTGRES_*`) remain present in Vercel runtime — ignoring them in app code is defense-in-depth, **NOT full credential isolation**. | Deploy strict `VIEWORA_DATABASE_URL` hardening to Vercel, verify `services.database.security` on live `/api/health`, and remove/unscope unnecessary privileged Neon Marketplace env vars (`DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`, `PGPASSWORD`) from Vercel Production where supported. | **YES** |
| **Task 3 — Live Deployment Inspection** | **`Failed`** *(Outdated Deployment Live)* | `git rev-list HEAD...origin/main = 0 0` at `5c9a5c1` (`DB`), while 5 hardened files (`src/lib/env.ts`, `src/app/api/auth/signup/route.ts`, `src/app/api/health/route.ts`, `src/lib/integration/phase7-stage-68.test.ts`, `NEON_DATABASE_ACTIVATION_REPORT.md`) remain uncommitted locally. Live `/api/health` lacks `services.database.security` and `services.registration`, confirming production is running pre-hardening `5c9a5c1`. | Commit & push the 5 local security-hardening files to `origin/main` and trigger a controlled Vercel Production redeploy **after** Task 1 env vars are saved. | **YES** |
| **Task 4 — Live HTTPS `/api/health` Check** | **`Failed`** *(Partial Pass — Missing Hardening Telemetry)* | Actual `GET https://instagram1-beta.vercel.app/api/health` returned **HTTP `200`** (`x-vercel-id: true`, `database.status: "healthy"`, `latencyMs: 213`, `demoMode.enabled: false`, `payments.enabled: false`, `backgroundJobs.enabled: false`, `emailDelivery.enabled: false`, all 4 paid providers `disabled`), **but** `database.security` (`source: VIEWORA_DATABASE_URL`, `restrictedRoleVerified`, `adminUrlAbsentFromRuntime`) and `registration.publicOpen` were absent because the outdated commit is live, and `demo_fixture` showed `configured: true`. | Re-verify `GET https://instagram1-beta.vercel.app/api/health` after setting `VIEWORA_ENABLE_DEMO_PROVIDER=false` and deploying the hardened commit. | **YES** |
| **Task 5 — Hosted Neon DB Verification** | **`Completed and verified`** | `npm run db:hosted:verify` & `db:hosted:health` passed live via pooled `viewora_app`: **58 tables, 6 migrations, 74 FKs, 147 indexes, 24 RLS policies, 1 `trg_audit_logs_immutable`, 5 plans, 15 billing options, 65 entitlements, 5 flags (`paymentsEnabled: false`), 6 CMS entries, `usersCount: 0`, `supportTicketsCount: 0`**, RLS `set_config` & `pg_advisory_xact_lock` verified. Local PG 14.25 untouched (`users: 1`). | None — no migrations or seeds need re-running. | **NO** |
| **Task 6 — Hosted Super Admin Readiness** | **`Pending owner action`** | `db:hosted:verify` confirmed **`usersCount: 0`** on Neon `neondb` (zero hosted administrators exist). `npm run db:hosted:bootstrap-admin` (`scripts/db/create-admin.ts`) is verified ready; zero local password hashes or sessions copied. | Owner runs `npm.cmd run db:hosted:bootstrap-admin` interactively locally with fresh strong credentials (≥ 12 chars, mixed classes) once ready. | **YES** |
| **Task 7a — Live Public Pages Testing** | **`Completed and verified`** *(10/10 Public Routes)* | Actual HTTPS `GET` probes against `https://instagram1-beta.vercel.app` returned **HTTP `200`** with `hasSupabaseMention: false` across all 10 routes: `/en`, `/en/login`, `/en/register`, `/en/pricing`, `/en/tools`, `/en/launch`, `/en/beta`, `/en/data-transparency`, `/en/privacy`, `/en/terms`. | None for public static rendering. | **NO** |
| **Task 7b — Live Registration Closure & Auth Flows** | **`Failed`** *(Registration Closure Not Live)* / **`Pending owner action`** *(Authenticated Admin Test)* | Non-destructive `POST /api/auth/signup` returned HTTP `503 ("Authentication service is not configured securely.")` instead of `403 REGISTRATION_CLOSED` (outdated deploy + pending `AUTH_URL`/redeploy). `POST /api/beta` returned `400` on missing required fields. Authenticated dashboard/admin/session/logout tests cannot run honestly until hosted Super Admin is bootstrapped and latest commit deployed. | Deploy hardened commit + set `AUTH_URL`/`NEXT_PUBLIC_APP_URL`/`PUBLIC_REGISTRATION_ENABLED=false` → re-probe `POST /api/auth/signup` (expect `403 REGISTRATION_CLOSED`) → after Super Admin bootstrap, verify live login, dashboard, admin console, reload persistence & logout. | **YES** |
| **Task 8 — Neon Backup & Recovery** | **`Pending owner action`** *(Blocked locally by Windows App Control)* | Official Neon Instant Restore (PITR) windows verified (`neon.com`): **Free: 6 hours (1 GB cap)** · **Launch: 1 day default / up to 7 days (\$0.20/GB-mo)** · **Scale: 1 day default / up to 30 days (\$0.20/GB-mo)**. Local workstation Windows App Control blocks `pg_dump.exe`/`pg_restore.exe` (never bypassed). Turnkey Linux encrypted backup & isolated restore procedure documented in §5. | Confirm Neon project plan/History Window in Neon Console (upgrade to Launch/Scale 7–30d before beta/launch) and run an encrypted `pg_dump -Fc` + isolated Neon branch restore drill from a Linux CI/runner. | **YES** |
| **Task 9 — Final Local Regression & Audit** | **`Completed and verified`** | Executed fresh: `typecheck` (`0` errors) · `lint` (`0` errors, `0` warnings) · `npm test` (**`24/24` suites, `120/120` tests**) · `npm run build` (**`322/322` static pages**, `103 kB` FLJS) · `npm audit` (`0` vulns) · `npm audit --omit=dev` (`0` vulns) · `.gitignore` excludes `.env`, `.env.local`, `.env.hosted.local`, `.env.production.local`. | None. | **NO** |
| **Commercial Payments, External APIs & Public Registration** | **`Intentionally disabled`** | `PAYMENTS_ENABLED=false`, `NEXT_PUBLIC_PAYMENTS_ENABLED=false`, `PUBLIC_REGISTRATION_ENABLED=false` (default closed on Vercel Prod), `BETA_PUBLIC_REGISTRATION_ENABLED=false`, `BACKGROUND_JOBS_ENABLED=false`, all `PROVIDER_*_ENABLED=false`. | Remain locked until separate stage-by-stage owner approvals. | **YES** *(future gates)* |

---

## 2. Complete Vercel Production Environment Variable Verification Against Source Code (`src/lib/env.ts`)

| Exact Source Code Variable | Required Vercel Production Value | Purpose / Notes |
| :--- | :--- | :--- |
| `VIEWORA_DATABASE_URL` | Restricted pooled `viewora_app` URI from local `.env.hosted.local` (**Sensitive**, no outer quotes) | **Mandatory** — strict Vercel Prod runtime DB (no fallback to `DATABASE_URL`) |
| `AUTH_SECRET` | Unique 64-char hex secret from local `.env.hosted.local` (**Sensitive**, no outer quotes) | **Mandatory** — session signing & HKDF-SHA256 AES-256-GCM OAuth token root |
| `AUTH_URL` | `https://instagram1-beta.vercel.app` | **Mandatory** — required by `assertValidProductionAuthConfig()` & `__Host-viewora_session` cookies |
| `NEXT_PUBLIC_APP_URL` | `https://instagram1-beta.vercel.app` | **Mandatory** — canonical URL, SEO, CSRF origin check & email links |
| `DEMO_MODE_ENABLED` | `false` | Safety lock |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | Safety lock |
| `VIEWORA_ENABLE_DEMO_PROVIDER` *(additional source code var)* | `false` | **Recommended** — disables `demo_fixture` provider adapter in Production `/api/health` |
| `PAYMENTS_ENABLED` | `false` | Safety lock |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | `false` | Safety lock |
| `PUBLIC_REGISTRATION_ENABLED` | `false` | Keeps `POST /api/auth/signup` cleanly returning `403 REGISTRATION_CLOSED` |
| `BETA_PUBLIC_REGISTRATION_ENABLED` | `false` | Keeps `/api/beta` invitation-only (`403 BETA_CLOSED`) |
| `BACKGROUND_JOBS_ENABLED` | `false` | Safety lock |
| `EMAIL_NOTIFICATIONS_ENABLED` *(additional source code var)* | `false` | Safety lock paired with `PROVIDER_RESEND_ENABLED` |
| `PROVIDER_RESEND_ENABLED` | `false` | Safety lock |
| `PROVIDER_GEMINI_ENABLED` | `false` | Safety lock |
| `PROVIDER_META_ENABLED` | `false` | Safety lock |
| `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED` | `false` | Safety lock |
| `PROVIDER_LICENSED_THIRD_PARTY_ENABLED` | `false` | Safety lock |
| `PROVIDER_PUBLIC_DATASET_ENABLED` *(additional source code var)* | `false` | Safety lock |

- **Additional Hygiene Note on `.env.hosted.local`:** Non-secret key scan showed `DATABASE_ADMIN_URL` appeared twice (the old placeholder line plus the real Neon URI below it). Although the loader uses the later real value, remove the obsolete placeholder line locally for tidiness.
- **Privileged Marketplace Credential Isolation Warning:** Even though Viewora's hardened code refuses to use `DATABASE_URL` / `POSTGRES_*` / `PGPASSWORD` in Vercel Production, having `neondb_owner` credentials present in the Vercel runtime environment means any future third-party dependency compromise could still read `process.env.DATABASE_URL`. Review Vercel's Neon integration settings and remove/unscope privileged owner variables (`DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`, `PGPASSWORD`, and `DATABASE_URL` if Marketplace allows disconnecting auto-sync) from the Production runtime environment.

---

## 3. Actual Live HTTPS Verification Output (`https://instagram1-beta.vercel.app`)

### Sanitized `GET /api/health` (Recorded `2026-11-26T10:13:21Z` — HTTP `200`)
```json
{
  "ok": true,
  "correlationId": "7c8c5ff8-ef9a-473e-958f-66534d1a7ca5",
  "checkedAt": "2026-11-26T10:13:21.003Z",
  "uptimeMeasured": "unavailable_external_monitor_required",
  "services": {
    "database": { "engine": "postgresql", "configured": true, "reachable": true, "status": "healthy", "latencyMs": 213 },
    "demoMode": { "enabled": false },
    "payments": { "enabled": false, "phase": "Phase 7 Reserved — Disabled" },
    "backgroundJobs": { "enabled": false, "total": 0, "queued": 0, "running": 0, "completed": 0, "deadLetter": 0, "cancelled": 0, "lastHeartbeatAt": null },
    "emailDelivery": { "enabled": false },
    "aiEngine": { "geminiConfigured": false, "killSwitchActive": false, "dailySpentUsd": 0, "dailyBudgetUsd": 10 },
    "providers": [
      { "id": "meta_official", "status": "disabled", "configured": false },
      { "id": "authorized_insights", "status": "disabled", "configured": false },
      { "id": "licensed_third_party", "status": "disabled", "configured": false },
      { "id": "permitted_public_dataset", "status": "disabled", "configured": false },
      { "id": "demo_fixture", "status": "healthy", "configured": true }
    ]
  }
}
```
- **Live Public Routes (10/10 HTTP `200`, `0` Supabase mentions):** `/en`, `/en/login`, `/en/register`, `/en/pricing`, `/en/tools`, `/en/launch`, `/en/beta`, `/en/data-transparency`, `/en/privacy`, `/en/terms`.
- **Live `POST /api/auth/signup` Probe:** HTTP `503` — `{"ok":false,"error":"Authentication service is not configured securely."}` (confirms Vercel has not yet redeployed with `AUTH_SECRET` + `AUTH_URL` and lacks the latest `403 REGISTRATION_CLOSED` hardening).

---

## 4. Hosted Neon Backup & Isolated Restoration Procedure (Task 8)

1. **Neon Built-In Instant Restore (PITR) Retention:**
   - **Free:** 6 hours max (1 GB history cap) — insufficient for commercial operations.
   - **Launch:** up to **7 days** (\$0.20/GB-month change history).
   - **Scale:** up to **30 days** (\$0.20/GB-month change history).
   - *Action:* Confirm active Neon plan under **Neon Console → `neon-bisque-harbor` → Settings → Postgres → History retention** and set to **≥ 7 days** before opening beta.
2. **Encrypted Independent `pg_dump` + Isolated Neon Branch Restore Drill (Run on Linux CI/Runner — Never Bypass Windows App Control):**
   ```bash
   # 1. Encrypted custom-format logical dump from Neon direct unpooled admin URI
   umask 077
   pg_dump --format=custom --no-owner --no-privileges "$NEON_DATABASE_ADMIN_URL" \
     | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_ENCRYPTION_KEY \
     > "viewora_neon_$(date -u +%Y%m%dT%H%M%SZ).dump.enc"

   # 2. Restore ONLY into an isolated disposable Neon branch/database (NEVER over main neondb)
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_ENCRYPTION_KEY \
     -in "<latest>.dump.enc" \
     | pg_restore --no-owner --no-privileges --dbname="$NEON_RESTORE_DRILL_BRANCH_URL"
   ```

---

## 5. Minimal Ordered Owner Action List to Make Viewora Operational on Vercel

1. **Add Missing Vercel Production Variables (`instagram1` → Settings → Environment Variables → Production):**
   - Add `AUTH_URL=https://instagram1-beta.vercel.app`, `NEXT_PUBLIC_APP_URL=https://instagram1-beta.vercel.app`, `VIEWORA_ENABLE_DEMO_PROVIDER=false`, `EMAIL_NOTIFICATIONS_ENABLED=false`, `PROVIDER_PUBLIC_DATASET_ENABLED=false`, and all explicit `false` flags from §2.
   - Remove/unscope unnecessary privileged Neon owner env vars from Production runtime if Vercel Marketplace permits.
2. **Commit & Push the 5 Hardened Local Files → Trigger Vercel Production Deploy:**
   - Deploy `src/lib/env.ts`, `src/app/api/auth/signup/route.ts`, `src/app/api/health/route.ts`, `src/lib/integration/phase7-stage-68.test.ts`, and reports so strict `VIEWORA_DATABASE_URL` + `viewora_app` enforcement and `403 REGISTRATION_CLOSED` go live.
3. **Verify Live Post-Deploy Endpoints:**
   - Confirm `GET https://instagram1-beta.vercel.app/api/health` shows `database.status: "healthy"`, `database.security.source: "VIEWORA_DATABASE_URL"`, `restrictedRoleVerified: true`, `adminUrlAbsentFromRuntime: true`, `registration.publicOpen: false`, `payments.enabled: false`.
   - Confirm `POST https://instagram1-beta.vercel.app/api/auth/signup` returns HTTP **`403`** (`code: "REGISTRATION_CLOSED"`).
4. **Bootstrap Hosted Super Admin (Interactive, Fresh Credentials):**
   - Run `npm.cmd run db:hosted:bootstrap-admin` locally, then sign into `https://instagram1-beta.vercel.app/en/login` to verify Dashboard, Admin Console, reload session persistence, and Logout.
5. **Confirm Neon History Window (≥ 7 days) & Run Linux Encrypted Backup/Restore Drill** before inviting Stage 69 beta participants.
