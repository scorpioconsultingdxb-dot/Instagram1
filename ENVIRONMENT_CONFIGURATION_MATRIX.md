# Viewora — Environment Configuration Matrix (Stage 51)

**Date:** 2026-11-26  
**Security Rule:** Never store production or staging credentials in Git, container images, or `NEXT_PUBLIC_*` variables. Every environment must use distinct cryptographic keys (`AUTH_SECRET`, `OAUTH_TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`).

---

## 1. Environment-by-Environment Variable Matrix

| Variable | Scope | Local Dev | Automated Test (`viewora_test`) | HTTPS Staging | Production |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Server | `development` | `test` | `production` | `production` |
| `NEXT_PUBLIC_APP_URL` | Public | `http://127.0.0.1:3000` | `http://127.0.0.1:3100` | `https://staging.<domain>` | `https://<domain>` |
| `DATABASE_URL` | Server Secret | `viewora_app@127.0.0.1/viewora` | `viewora_test_app@127.0.0.1/viewora_test` | Managed PG 16/17 (`viewora_app` + TLS `sslmode=require`) | Managed PG 16/17 HA (`viewora_app` + TLS `sslmode=verify-full` + pooler) |
| `DATABASE_ADMIN_URL` | CI / Ops Secret Only | `postgres@127.0.0.1/viewora` | `postgres@127.0.0.1/viewora_test` | Migration-only secret (never injected in app runtime) | Migration-only secret (never injected in app runtime) |
| `TEST_DATABASE_URL` | Dev/CI Only | `viewora_test_app@127.0.0.1/viewora_test` | Required | Omitted | **Must be omitted** |
| `AUTH_SECRET` | Server Secret (≥32 bytes) | Local unique random | Test unique random | Staging vault unique random | Prod HSM/vault unique random (90-day rotation plan) |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | Server Secret (32-byte hex/base64) | Local unique random | Test unique random | Staging vault unique random | Prod HSM/vault unique random |
| `DEMO_MODE` / `NEXT_PUBLIC_DEMO_MODE` | Feature Flag | `false` | `false` | `false` | **`false` (mandatory)** |
| `PAYMENTS_ENABLED` | Billing Gate | **`false`** | **`false`** | **`false`** (until Stage 54 sandbox owner sign-off) | **`false`** (until Stage 60 commercial launch approval) |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | Public Billing Gate | **`false`** | **`false`** | **`false`** | **`false`** (must match `PAYMENTS_ENABLED`) |
| `BETA_PUBLIC_REGISTRATION_ENABLED` | Beta Gate | **`false`** | **`false`** | **`false`** (invitation-only) | **`false`** (until owner opens beta/GA) |
| `PROVIDER_META_ENABLED` | Provider Flag | **`false`** | **`false`** | `false` → `true` only after Stage 52 checklist | `false` → `true` only after staging acceptance |
| `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED` | Provider Flag | **`false`** | **`false`** | `false` → `true` only after Meta App Review | `false` → `true` only after staging acceptance |
| `PROVIDER_LICENSED_THIRD_PARTY_ENABLED` | Provider Flag | **`false`** | **`false`** | `false` → `true` only after signed contract | `false` → `true` only after staging acceptance |
| `PROVIDER_GEMINI_ENABLED` | AI Flag | **`false`** | **`false`** | `false` → `true` only after budget cap approval | `false` → `true` only after staging acceptance |
| `PROVIDER_RESEND_ENABLED` & `EMAIL_NOTIFICATIONS_ENABLED` | Email Flags | **`false`** | **`false`** | `false` → `true` only after SPF/DKIM/DMARC verified | `false` → `true` only after staging bounce/webhook test |
| `BACKGROUND_JOBS_ENABLED` | Worker Flag | **`false`** | **`false`** | `false` → `true` with `CRON_SECRET` | `false` → `true` with external managed cron |
| `CRON_SECRET` | Server Secret | Optional local | Test secret | Staging vault unique ≥32 bytes | Prod vault unique ≥32 bytes |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | Optional Cache Secret | Unset | Unset (mock-tested) | Optional staging Redis | Required before scaling ≥2 stateless pods |
| `API_DAILY_COST_CAP_USD` / `API_MONTHLY_COST_CAP_USD` | Financial Guard | Conservative low cap | Conservative test cap | Strict staging cap (e.g., \$5/day, \$25/mo) | Owner-approved commercial budget cap |

---

## 2. Hard Invariants Validated by `npm run env:check`

1. **Zero Supabase:** Any `SUPABASE_*` or `NEXT_PUBLIC_SUPABASE_*` variable triggers validation failure.
2. **Secret Hygiene:** Placeholders (`your-key`, `changeme`, `test-placeholder`) are automatically rejected by `src/lib/integrations/credentials.ts`.
3. **Explicit Double Opt-In:** Supplying a provider API key **never** activates a provider while its `PROVIDER_*_ENABLED` flag remains `false`.
4. **Test DB Isolation:** Automated destructive suites refuse to execute unless targeting a database explicitly named `*_test` (`viewora_test`).
