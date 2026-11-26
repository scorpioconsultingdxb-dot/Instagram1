# Viewora — Production Environment & Deployment Package Checklist (Updated Task 2)

**Date:** 2026-11-26  
**Deployment Artifacts Validated:**
- [`Dockerfile`](file:///c:/Users/Scorpio/Videos/Instagram/Dockerfile) (non-root `nextjs` user, Node 22-bookworm-slim, built-in `/api/health` `HEALTHCHECK`)
- [`.dockerignore`](file:///c:/Users/Scorpio/Videos/Instagram/.dockerignore) (excludes `.env*`, `backups/`, `executive_visual_evidence/`, `*.zip`)
- [`.env.production.example`](file:///c:/Users/Scorpio/Videos/Instagram/.env.production.example) (complete zero-secret template matching `src/lib/env.ts` 1:1)
- [`deploy/scripts/startup-check.mjs`](file:///c:/Users/Scorpio/Videos/Instagram/deploy/scripts/startup-check.mjs) (verified pass on valid prod env; verified fail-closed `exit 1` on `DEMO_MODE_ENABLED=true`)
- [`deploy/staging/digitalocean-app.yaml`](file:///c:/Users/Scorpio/Videos/Instagram/deploy/staging/digitalocean-app.yaml) *(Primary)* & [`deploy/staging/render.yaml`](file:///c:/Users/Scorpio/Videos/Instagram/deploy/staging/render.yaml) *(Alternative)*

---

## 1. Exact Runtime Environment Variable Checklist (Aligned 1:1 With `src/lib/env.ts`)

| Variable | Staging / Prod Setting | Security / Governance Verification |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Mandatory |
| `NEXT_TELEMETRY_DISABLED` | `1` | Mandatory |
| `NEXT_PUBLIC_APP_URL` & `AUTH_URL` | `https://staging.<domain>` / `https://<domain>` | HTTPS required; enforced by `startup-check.mjs` |
| `DATABASE_URL` | Private VPC TLS URI using restricted `viewora_app` (`NOBYPASSRLS`) + `&pgbouncer=true` | Zero public DB exposure; validated by `startup-check.mjs` |
| `DATABASE_ADMIN_URL` | **CI / Migration Runner ONLY — MUST NOT exist on web containers** | `startup-check.mjs` aborts boot if present in runtime web container |
| `TEST_DATABASE_URL` | **UNSET in Staging & Production** | `startup-check.mjs` aborts boot if present in production |
| `AUTH_SECRET` | Unique ≥ 64-char CSPRNG hex per environment (`openssl rand -hex 32`) | Also serves as HKDF-SHA256 root for AES-256-GCM OAuth token encryption (`src/lib/security/token-crypto.ts`) |
| `DEMO_MODE_ENABLED` / `NEXT_PUBLIC_DEMO_MODE` | **`false`** | `startup-check.mjs` & `isDemoModeEnabled()` permanently block production demo fallback |
| `PAYMENTS_ENABLED` & `NEXT_PUBLIC_PAYMENTS_ENABLED` | **`false`** *(locked separate gate)* | Flip only after Step 12 sandbox test & Managing Director order |
| `BETA_PUBLIC_REGISTRATION_ENABLED` | **`false`** | Keeps `/beta` strictly invitation-only (`403 BETA_CLOSED`) |
| `PROVIDER_RESEND_ENABLED` & `EMAIL_NOTIFICATIONS_ENABLED` | `false` → `true` only after Step 4 inbox test | Paired with `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO` |
| `PROVIDER_GEMINI_ENABLED` | `false` → `true` only after Step 5 budget sign-off | Paired with `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_DAILY_BUDGET_USD=2.00`, `AI_MONTHLY_BUDGET_USD=15.00` |
| `API_DAILY_COST_CAP_USD` & `API_MONTHLY_COST_CAP_USD` | `5.00` / `25.00` (Staging) · Owner cap (Prod) | Enforces global ceiling across all external providers atomically |
| `PROVIDER_META_ENABLED` & `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED` | `false` → `true` only after Step 6 App Review | Paired with `META_APP_ID`, `META_APP_SECRET`, `META_API_VERSION`, `META_WEBHOOK_VERIFY_TOKEN`, `META_OAUTH_REDIRECT_URI` |
| `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` | Provision before scaling ≥ 2 replicas (Step 7) | TLS REST endpoint in same region as compute |
| `BACKGROUND_JOBS_ENABLED` & `CRON_SECRET` | `false` → `true` only after Step 8 cron verified | Constant-time Bearer auth on `POST /api/jobs/run` |
| `PROVIDER_LICENSED_THIRD_PARTY_ENABLED` | **`false`** | Locked until signed SaaS redistribution contract & commercial approval |
