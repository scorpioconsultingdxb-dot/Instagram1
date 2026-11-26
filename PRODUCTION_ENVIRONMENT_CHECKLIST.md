# Viewora — Production Environment & Secret Configuration Checklist (Stage 61)

**Date:** 2026-11-26  
**Security Rule:** Store ALL secrets strictly inside the hosted platform's encrypted secret manager / KMS. Never commit secrets to Git, never reuse staging secrets in production, and never expose server secrets under `NEXT_PUBLIC_*`.

---

## 1. Mandatory Production Environment Variable Checklist

| Category | Variable | Required Production Setting | Verification Rule |
| :--- | :--- | :--- | :--- |
| **Runtime** | `NODE_ENV` | `production` | Mandatory |
| **Runtime** | `NEXT_TELEMETRY_DISABLED` | `1` | Mandatory |
| **Origin** | `NEXT_PUBLIC_APP_URL` / `AUTH_URL` | `https://<canonical-domain>` | HTTPS only; exact match for CSRF & OAuth redirects |
| **Database (Runtime)** | `DATABASE_URL` | `postgresql://viewora_app:<vault>@<private-host>:5432/viewora?sslmode=verify-full&pgbouncer=true` | Restricted `NOBYPASSRLS` role; TLS verified |
| **Database (Admin CI Only)** | `DATABASE_ADMIN_URL` | Direct non-pooled admin URL (CI/migration runner ONLY) | **Must NOT be set in runtime web containers** |
| **Database Hygiene** | `TEST_DATABASE_URL` | **UNSET / OMITTED** | Never expose test DB config in production |
| **Auth Crypto** | `AUTH_SECRET` | Unique ≥ 64-char CSPRNG secret (`openssl rand -hex 32`) | Distinct from staging; 90-day rotation procedure |
| **OAuth Crypto** | `OAUTH_TOKEN_ENCRYPTION_KEY` | Unique 32-byte hex/base64 key (`openssl rand -hex 32`) | Used for AES-256-GCM `provider_connections` |
| **Demo Lock** | `DEMO_MODE_ENABLED` & `NEXT_PUBLIC_DEMO_MODE` | **`false`** | Production demo fallback permanently prohibited |
| **Billing Lock** | `PAYMENTS_ENABLED` & `NEXT_PUBLIC_PAYMENTS_ENABLED` | **`false`** *(separate final approval gate)* | Must remain `false` until Stage 68 sandbox & Stage 70 owner sign-off |
| **Beta Gate** | `BETA_PUBLIC_REGISTRATION_ENABLED` | **`false`** | Keep invitation-only until GA authorization |
| **Email (Stage 63)** | `PROVIDER_RESEND_ENABLED` / `EMAIL_NOTIFICATIONS_ENABLED` / `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` / `EMAIL_FROM` | `false` until Stage 63 domain + live inbox test pass | Verify SPF/DKIM/DMARC & Svix signature first |
| **AI (Stage 64)** | `PROVIDER_GEMINI_ENABLED` / `GEMINI_API_KEY` / `GEMINI_MODEL` | `false` until Stage 64 owner budget + model sign-off | Pair with hard micro-USD daily/monthly caps |
| **Meta (Stage 65)** | `PROVIDER_META_ENABLED` / `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED` / `META_APP_ID` / `META_APP_SECRET` / `META_WEBHOOK_VERIFY_TOKEN` | `false` until Stage 65 Meta App Review & live acceptance pass | Confirm Data Deletion Callback URL registered |
| **Licensed Data (Stage 66)** | `PROVIDER_LICENSED_THIRD_PARTY_ENABLED` + vendor credentials | `false` until written SaaS redistribution license signed | Must pass SSRF allowlist & unit economics review |
| **Redis (Stage 67)** | `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` | Provision before scaling ≥ 2 stateless containers | TLS REST endpoint; confirm rate-limit & lock sync |
| **Scheduler (Stage 67)** | `BACKGROUND_JOBS_ENABLED` & `CRON_SECRET` (≥ 32 bytes) | `false` until external cron authenticated & tested | Constant-time Bearer auth on `POST /api/jobs/run` |
| **Cost Guardrails** | `API_DAILY_COST_CAP_USD` & `API_MONTHLY_COST_CAP_USD` | Conservative owner-approved ceilings (e.g. \$10/day, \$100/mo initial) | Enforced atomically via `pg_advisory_xact_lock` |
| **Backup Crypto** | `BACKUP_ENCRYPTION_KEY` | Dedicated AES-256 encryption passphrase in separate vault | Never stored in same bucket as `.dump.enc` files |

---

## 2. Pre-Boot Automated Guard Checks

- Confirm `npm run env:check` passes with `0` errors and `0` Supabase variables.
- Confirm `GET /api/health` never exposes secrets, connection strings, or stack traces.
- Confirm `audit_logs` WORM archival IAM role has **write-only / PutObject** permissions on the off-host archive bucket (cannot delete or overwrite historical logs).
