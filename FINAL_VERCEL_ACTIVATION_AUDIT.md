# Viewora — Final Vercel Production Activation & Verification Audit

**Date:** 2026-11-26  
**Vercel Team / Project:** `scorpioconsultingdxb-9036` / `instagram1`  
**Live Canonical Production URL:** `https://instagram1-beta.vercel.app`  
**Verified Ready Production Deployment:** `dpl_8AW3VMX12PsZdWKZTTD8NV4qH2M9` (`https://instagram1-1uwzrmu1n-scorpioconsultingdxb-9036.vercel.app`, `readyState: READY`)  
**Hosted Database:** Neon PostgreSQL **`18.7`** (`neon-bisque-harbor`, `main`, `neondb`, AWS US East 1)  
**Security Guarantee:** Zero credentials, passwords, raw connection strings, or OIDC tokens appear anywhere in this report. Payments, external APIs, background jobs, demo mode, demo fixture provider, and public registration remain strictly disabled. Local PostgreSQL `14.25` remains 100% untouched.

---

## 1. Master Task Classification Table

**Classification Legend:** `Completed and verified` · `Configured but not verified` · `Pending owner action` · `Blocked by external access` · `Failed` · `Intentionally disabled`

| Task | Current Status | Actual Verification Evidence | Remaining Action | Owner Intervention Required? |
| :--- | :---: | :--- | :--- | :---: |
| **Task 1 — Correct `VIEWORA_DATABASE_URL` in Vercel** | **`Completed and verified`** | Sanitized `VIEWORA_DATABASE_URL` from `.env.hosted.local` (stripped quotes/whitespace, verified `viewora_app` @ `ep-raspy-king-bc4ymzob-pooler.c-16.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true` live against Neon), replaced cleanly via stdin (`--environment production --sensitive --force --yes`, `Type: Secret`, `secretPrinted: false`). Existing `AUTH_SECRET` preserved untouched. | None. | **NO** |
| **Task 2 — All 19 Production Config Variables Verified** | **`Completed and verified`** | Verified via `vercel env ls --environment production`: `VIEWORA_DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `DEMO_MODE_ENABLED=false`, `NEXT_PUBLIC_DEMO_MODE=false`, `VIEWORA_ENABLE_DEMO_PROVIDER=false`, `PAYMENTS_ENABLED=false`, `NEXT_PUBLIC_PAYMENTS_ENABLED=false`, `PUBLIC_REGISTRATION_ENABLED=false`, `BETA_PUBLIC_REGISTRATION_ENABLED=false`, `BACKGROUND_JOBS_ENABLED=false`, `EMAIL_NOTIFICATIONS_ENABLED=false`, and all 6 `PROVIDER_*_ENABLED=false`. `DATABASE_ADMIN_URL` confirmed absent. Local PG `14.25` untouched (`db:health` → `healthy`, `220ms`, `users: 1`). | None. | **NO** |
| **Task 3 — Controlled Production Redeployment** | **`Completed and verified`** | Executed single authorized deployment `vercel deploy --prod --yes` with `.vercelignore` excluding `.env*`, backups, and screenshot archives. Reached `readyState: READY` (`dpl_8AW3VMX12PsZdWKZTTD8NV4qH2M9`) and aliased to `https://instagram1-beta.vercel.app`. | Commit local `src/lib/db/prisma.ts`, `src/app/api/health/route.ts`, `.vercelignore`, and reports to Git when ready so GitHub matches live Vercel 1:1. | **YES** *(optional git sync)* |
| **Task 4 — Live Production Acceptance (14/14 Checks)** | **`Completed and verified`** | Actual HTTPS probe of `https://instagram1-beta.vercel.app/api/health` returned **HTTP `200`** with **14/14 checks PASS**: `database.status: "healthy"` (`268ms`), `security.source: "VIEWORA_DATABASE_URL"`, `restrictedRoleVerified: true`, `vercelProductionStrict: true`, `adminUrlAbsentFromRuntime: true`, **actual live PG `connectedRole`**: `role: "viewora_app"`, `rolsuper: false`, `rolcreatedb: false`, `rolcreaterole: false`, `rolbypassrls: false`, `restrictedPrivilegeVerified: true`; `registration.publicOpen: false`; `payments.enabled: false`; `demoMode.enabled: false`; **all 5 providers (incl. `demo_fixture`) `disabled`**. All **10/10 public pages** returned HTTP `200` with zero Supabase mentions. `POST /api/auth/signup` returned **HTTP `403`** (`code: "REGISTRATION_CLOSED"`). | None for public & DB acceptance. | **NO** |
| **Task 5 — Hosted Super Admin Bootstrap** | **`Pending owner action`** | Hosted Neon `neondb` confirmed clean (`users: 0`). Interactive bootstrap command `npm.cmd run db:hosted:bootstrap-admin` verified ready. Zero local password hashes or sessions copied. | Owner runs `npm.cmd run db:hosted:bootstrap-admin` locally to enter fresh strong administrator credentials privately, then verifies live login, Dashboard, Admin Console, reload persistence & logout. | **YES** |
| **Task 6 — Privileged Neon Marketplace Credential Isolation** | **`Pending owner action`** | Identified 18 Marketplace-managed variables in Vercel (`10` privileged owner/credential vars + `8` host/metadata vars). Live app is verified running strictly on `VIEWORA_DATABASE_URL` (`viewora_app`), with zero fallback to Marketplace `DATABASE_URL`. No integration disconnected or credentials deleted without separate approval. | Follow §3 isolation procedure when ready to remove/unscope unnecessary privileged owner env vars (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL*`, `PGPASSWORD`, `POSTGRES_PASSWORD`, `PGUSER`, `POSTGRES_USER`) from Vercel Production runtime. | **YES** |
| **Task 7 — Hosted Backup & Isolated Restoration** | **`Pending owner action`** *(Blocked locally by Windows App Control)* | Neon Instant Restore retention verified (`Free: 6h / 1 GB`, `Launch: up to 7d`, `Scale: up to 30d` at \$0.20/GB-mo). Turnkey Linux encrypted `pg_dump -Fc` + isolated Neon branch restore procedure prepared in §4. Never bypassed Windows App Control. | Confirm Neon History Window ≥ 7d in Neon Console and execute encrypted backup + isolated Neon branch restore drill on a Linux CI/runner before beta. | **YES** |
| **Task 9 (Prior) — Local Regression & Zero-CVE Security** | **`Completed and verified`** | `typecheck` (`0`) · `lint` (`0`) · `npm test` (**24/24 suites · 120/120 tests**) · `npm run build` (**322/322 static pages**) · `npm audit` (`0`) · `npm audit --omit=dev` (`0`). `.vercel`, `.env.local`, `.env.hosted.local` verified git-ignored. | None. | **NO** |
| **Payments, External APIs & Public Registration** | **`Intentionally disabled`** | All verified `false` / `disabled` live on `https://instagram1-beta.vercel.app/api/health`. | Keep disabled until separate stage-by-stage owner approvals (Resend → Gemini → Meta → Legal → 14-day Beta → Billing). | **YES** *(future gates)* |

---

## 2. Sanitized Live Production `/api/health` Output (Verified `2026-11-26T10:51:27Z`)

**Endpoint:** `GET https://instagram1-beta.vercel.app/api/health` → **HTTP `200`**

```json
{
  "ok": true,
  "correlationId": "21af9270-cd56-4e4f-bc7b-78e6426f93c7",
  "checkedAt": "2026-11-26T10:51:27.383Z",
  "uptimeMeasured": "unavailable_external_monitor_required",
  "services": {
    "database": {
      "engine": "postgresql",
      "configured": true,
      "reachable": true,
      "status": "healthy",
      "latencyMs": 268,
      "connectedRole": {
        "role": "viewora_app",
        "rolsuper": false,
        "rolcreatedb": false,
        "rolcreaterole": false,
        "rolbypassrls": false,
        "restrictedPrivilegeVerified": true
      },
      "security": {
        "source": "VIEWORA_DATABASE_URL",
        "restrictedRoleVerified": true,
        "vercelProductionStrict": true,
        "adminUrlAbsentFromRuntime": true
      }
    },
    "registration": { "publicOpen": false, "mode": "invitation_only_closed" },
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
      { "id": "demo_fixture", "status": "disabled", "configured": false }
    ]
  }
}
```
- **Live Public Routes (10/10 HTTP `200`, `0` Supabase mentions):** `/en`, `/en/login`, `/en/register`, `/en/pricing`, `/en/tools`, `/en/launch`, `/en/beta`, `/en/data-transparency`, `/en/privacy`, `/en/terms`.
- **Live `POST /api/auth/signup`:** **HTTP `403`** — `{"ok":false,"code":"REGISTRATION_CLOSED","error":"Public account registration is currently closed during controlled pre-launch. Request invitation-only beta access or continue using our 12 free public tools."}`.

---

## 3. Final Privileged Neon Marketplace Credential Isolation Procedure (Task 6 — Owner Approval Required)

Live production is now proven to run 100% on `VIEWORA_DATABASE_URL` (`viewora_app`), with zero runtime dependency on the 18 Marketplace-managed variables:
- **10 Privileged Owner / Credential Vars:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`, `POSTGRES_PRISMA_URL`, `PGPASSWORD`, `POSTGRES_PASSWORD`, `PGUSER`, `POSTGRES_USER`
- **8 Non-Secret Host / Metadata Vars:** `PGHOST`, `PGHOST_UNPOOLED`, `POSTGRES_HOST`, `PGDATABASE`, `POSTGRES_DATABASE`, `NEON_PROJECT_ID`, `NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_URL`

**Safe Non-Destructive Isolation Steps (Execute ONLY When Owner Approves — Never Delete Neon DB):**
1. Open **Vercel Dashboard → Team `scorpioconsultingdxb-9036` → Storage / Integrations → Neon (`neon-bisque-harbor`) → Connected Projects**.
2. Unlink/unscope auto-injected Marketplace environment variables from **`instagram1` (Production)** (confirming the Neon project itself stays active in Neon Console and is **not** deleted), **or** remove the 10 privileged variables from `instagram1` Production if editable individually.
3. Redeploy once and re-confirm `GET https://instagram1-beta.vercel.app/api/health` remains `healthy` (`connectedRole.role: "viewora_app"`).

---

## 4. Hosted Neon Encrypted Backup & Isolated Restoration Procedure (Task 7)

1. **Neon Instant Restore (PITR):** Under **Neon Console → `neon-bisque-harbor` → Settings → Postgres → History retention**, confirm plan supports **≥ 7 days** (Launch up to 7d / Scale up to 30d at \$0.20/GB-mo; Free is capped at 6h / 1 GB).
2. **Independent Encrypted Logical Dump & Isolated Branch Restore Drill (Run on Linux CI/Runner — Never Over `main` `neondb`):**
   ```bash
   umask 077
   TS="$(date -u +%Y%m%dT%H%M%SZ)"
   # 1. Encrypted custom-format logical dump via direct unpooled Neon admin URI
   pg_dump --format=custom --no-owner --no-privileges "$NEON_DATABASE_ADMIN_URL" \
     | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_ENCRYPTION_KEY \
     > "viewora_neon_${TS}.dump.enc"

   # 2. Restore strictly into a disposable Neon child branch or isolated drill database
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_ENCRYPTION_KEY \
     -in "viewora_neon_${TS}.dump.enc" \
     | pg_restore --no-owner --no-privileges --dbname="$NEON_RESTORE_DRILL_BRANCH_URL"

   # 3. Verify 58 tables, 6 migrations, 24 RLS policies & immutable audit trigger on drill branch
   psql "$NEON_RESTORE_DRILL_BRANCH_URL" -c "
     SELECT
       (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations') AS tables,
       (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS migrations,
       (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS rls_policies,
       (SELECT count(*) FROM pg_trigger WHERE tgname='trg_audit_logs_immutable') AS audit_trigger;
   "
   ```

---

## 5. Exact Remaining Owner Actions

1. **Bootstrap Hosted Super Admin Interactively (Task 5):**
   ```powershell
   npm.cmd run db:hosted:bootstrap-admin
   ```
   Enter fresh strong credentials privately in your terminal, then sign in at `https://instagram1-beta.vercel.app/en/login` to verify Dashboard, Admin Console, page reload session persistence, and Logout.
2. **Sync Final Hardening Changes to Git (Recommended):** Commit `src/lib/db/prisma.ts`, `src/app/api/health/route.ts`, `.vercelignore`, and updated reports when ready so `origin/main` matches the live Vercel deployment (`dpl_8AW3VMX12PsZdWKZTTD8NV4qH2M9`).
3. **Approve Privileged Neon Marketplace Env Var Isolation (§3)** and **Verify Neon ≥ 7-Day History Window + Linux Encrypted Restore Drill (§4)** before starting controlled external provider activations (Resend → Gemini → Meta → Legal → 14-Day Beta → Separate Billing Gate).
