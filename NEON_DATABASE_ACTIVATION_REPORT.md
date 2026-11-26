# Viewora — Hosted Neon PostgreSQL 18.7 Activation & Deployment Readiness Report (`neon-bisque-harbor`)

**Date:** 2026-11-26  
**Target Live Vercel App:** `https://instagram1-beta.vercel.app/en`  
**Target Neon Resource:** `neon-bisque-harbor` (`branch: main`, `database: neondb`, `region: AWS US East 1`)  
**Hosted Database Status:** **INITIALIZED, MIGRATED, SEEDED & VERIFIED ON LIVE NEON POSTGRESQL 18.7**  
**Hosted Deployment Readiness Status:** **CODE & DATABASE READY FOR CONTROLLED VERCEL CONFIGURATION & DEPLOYMENT** *(not yet redeployed; payments disabled; external providers disabled; public registration closed by default on Vercel production; hosted Super Admin awaiting owner credentials)*  
**Security Guarantee:** Zero passwords, secrets, or raw connection strings appear anywhere in this report. Local `.env.local` and local PostgreSQL `14.25` remain 100% untouched.

---

## 1. Strict Hosted Database Security Enforcement (Items 1–6)

1. **Strict `VIEWORA_DATABASE_URL` Enforcement on Vercel Production ([`src/lib/env.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/env.ts)):**
   - When `VERCEL === '1'` and `VERCEL_ENV === 'production'`, `getRuntimeDatabaseUrl()` **strictly requires `VIEWORA_DATABASE_URL`** and **NEVER falls back to Marketplace-managed `DATABASE_URL`**.
   - If `VIEWORA_DATABASE_URL` is missing, Viewora fails closed (`source: 'blocked_missing_viewora_database_url'`) rather than connecting as `neondb_owner`.
2. **Restricted `viewora_app` Role Guard:**
   - On Vercel Production, `getRuntimeDatabaseSecurityStatus()` verifies that `VIEWORA_DATABASE_URL` uses exclusively the restricted **`viewora_app`** role. If a privileged role (`neondb_owner`, `neon_superuser`, `postgres`, `viewora_admin`) is mistakenly placed in `VIEWORA_DATABASE_URL`, the runtime refuses it (`source: 'blocked_privileged_role'`).
   - Live Neon PostgreSQL 18.7 `viewora_app` verification (`db:hosted:verify`): `rolsuper: false`, `rolcreatedb: false`, `rolcreaterole: false`, `rolbypassrls: false`, `member_of: []`, `owned_tables: 0`, `audit_logs` (`SELECT` + `INSERT` only; `UPDATE`/`DELETE`/`TRUNCATE` revoked), `public_can_create: false`, pooled host `ep-raspy-king-bc4ymzob-pooler.c-16.us-east-1.aws.neon.tech` (`sslmode=require&pgbouncer=true`).
3. **Isolation of Unnecessary Privileged Neon Marketplace Variables:**
   - Because Vercel's Neon Marketplace integration injects privileged owner variables (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PGPASSWORD`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PASSWORD`, `POSTGRES_URL_NO_SSL`, `POSTGRES_PRISMA_URL`), Viewora's runtime code ignores all `POSTGRES_*`/`PG*` variables and blocks `DATABASE_URL` on Vercel Production.
   - `DATABASE_ADMIN_URL` is **not** required in Vercel runtime (`adminUrlAbsentFromRuntime: true` checked in `GET /api/health`) and must remain strictly local/CI-only. As defense-in-depth, remove or unscope `DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`, and `POSTGRES_URL_NO_SSL` from Vercel Production if the Marketplace UI allows it.
4. **Local PostgreSQL `14.25` Preserved:** Outside Vercel (`VERCEL !== '1'`), local `.env.local` and `DATABASE_URL` workflows continue operating identically (`db:health` → `healthy`, `141ms`, `users: 1`, `plans: 5`, `featureFlags: 5`).

---

## 2. Authentication, HTTPS Cookies, Registration Closure & Health Telemetry (Items 7–10)

- **HTTPS Authentication Cookies ([`src/lib/auth/session.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/auth/session.ts)):**
  - When `NODE_ENV === 'production'` and `AUTH_URL` / `NEXT_PUBLIC_APP_URL` is HTTPS (`https://instagram1-beta.vercel.app`), `isSecureCookieContext()` returns `true`.
  - Session cookies automatically enforce the RFC 6265bis **`__Host-viewora_session`** name prefix with `httpOnly: true`, `sameSite: 'lax'`, `secure: true`, `path: '/'`, and no `domain` attribute.
- **Canonical URLs & Auth Secret Guards ([`src/lib/auth/secret.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/auth/secret.ts)):**
  - `assertValidProductionAuthConfig()` strictly requires HTTPS `AUTH_URL` / `NEXT_PUBLIC_APP_URL` and a strong `AUTH_SECRET` (`≥ 32` chars, `≥ 10` unique characters, zero placeholder patterns). `isAllowedCsrfOrigin()` verifies mutating request origins against the canonical host.
- **Registration Closure vs. Database Unavailability ([`src/app/api/auth/signup/route.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/auth/signup/route.ts)):**
  - `isPublicRegistrationOpen()` defaults to **`false` (closed)** on hosted Vercel Production until the owner explicitly sets `PUBLIC_REGISTRATION_ENABLED=true`.
  - Intentional closure returns **HTTP `403`** (`code: 'REGISTRATION_CLOSED'`), cleanly distinct from database unavailability which returns **HTTP `503`** (`code: 'DATABASE_UNAVAILABLE'`).
  - `/api/beta` remains separately locked to invitation-only (`BETA_PUBLIC_REGISTRATION_ENABLED=false`, HTTP `403 BETA_CLOSED`).
- **Live Health Verification Endpoint ([`src/app/api/health/route.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/health/route.ts)):**
  - Reports non-secret `services.database.security` (`source`, `restrictedRoleVerified`, `vercelProductionStrict`, `adminUrlAbsentFromRuntime`) and `services.registration` (`publicOpen`, `mode`) alongside measured PostgreSQL health.

---

## 3. Live Neon Database & Full Local Verification Results (Items 11–12)

| Verification Command / Check | Scope | Exact Verified Result |
| :--- | :--- | :--- |
| `npm run db:hosted:inspect` | Neon PG 18.7 direct inspection | **PASS** (`PostgreSQL 18.7`, `neondb`, `sslmode=require`) |
| `npm run db:hosted:setup-role` | Restricted `viewora_app` provisioning | **PASS** (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`, `owned_tables: 0`, `member_of: []`) |
| `npm run db:hosted:migrate` & `status` | 6 forward-only migrations on PG 18.7 | **PASS** (`58` tables, `6` migrations, `74` FKs, `147` indexes, `24` RLS policies, `1` audit trigger) |
| `npm run db:hosted:seed` (× 2) | Double idempotent seed | **PASS** (`5` plans, `15` billing, `65` entitlements, `5` flags [`payments=false`], `6` CMS, `0` users, `0` tickets) |
| `npm run db:hosted:verify` | Pooled `viewora_app` runtime, RLS, locks & immutability | **PASS** (`pooled: true`, `set_config` RLS, `pg_advisory_xact_lock`, `audit_logs` append-only) |
| `npm run db:hosted:health` | Live Neon runtime health (`viewora_app`) | **PASS** (`healthy`, `users: 0`, `plans: 5`, `featureFlags: 5`) |
| `npm run typecheck` & `npm run lint` | Strict TypeScript & ESLint | **PASS** (`0` TS errors, `0` ESLint errors, `0` warnings) |
| `npm audit --omit=dev` & `npm audit` | All 401 workspace dependencies (prod + dev) | **PASS** (`0` production vulnerabilities, `0` total vulnerabilities) |
| `npm test` (`vitest@5.1.2`) | Unit, security, Vercel fail-closed & registration closure tests | **PASS** (`24/24` suites · **`120/120` tests passed**, `9.35s`) |
| `npm run build` (`next@15.5.29`) | Production static + server build | **PASS** (**`322/322` static pages**, `14.0s`, `103 kB` shared FLJS) |
| `npm run db:health` | Local operational PG `14.25` (`viewora`) | **PASS** (`healthy`, `141ms`, `users: 1`, `plans: 5`, `featureFlags: 5` — untouched) |
| `git check-ignore -v` | `.env`, `.env.local`, `.env.hosted.local`, `.env.production.local` | **PASS** (all 4 excluded by `.gitignore`) |

---

## 4. Exact Vercel Production Environment Variables (`instagram1`)

Configure these in **Vercel → `instagram1` → Settings → Environment Variables → Production** (paste values without surrounding quotes):

| Variable Name | Value / Source | Required |
| :--- | :--- | :---: |
| **`VIEWORA_DATABASE_URL`** | Copy from local `.env.hosted.local` (`postgresql://viewora_app:...@ep-raspy-king-bc4ymzob-pooler.c-16.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true`) — mark **Sensitive** | **MANDATORY** |
| **`AUTH_SECRET`** | Generate fresh 64-char hex (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) — mark **Sensitive** | **MANDATORY** |
| **`AUTH_URL`** | `https://instagram1-beta.vercel.app` | **MANDATORY** |
| **`NEXT_PUBLIC_APP_URL`** | `https://instagram1-beta.vercel.app` | **MANDATORY** |
| **`DEMO_MODE_ENABLED`** & **`NEXT_PUBLIC_DEMO_MODE`** | `false` | **MANDATORY** |
| **`PAYMENTS_ENABLED`** & **`NEXT_PUBLIC_PAYMENTS_ENABLED`** | `false` | **MANDATORY** |
| **`PUBLIC_REGISTRATION_ENABLED`** | `false` *(keeps `/api/auth/signup` intentionally closed `403 REGISTRATION_CLOSED` until launch/beta)* | **RECOMMENDED** |
| **`BETA_PUBLIC_REGISTRATION_ENABLED`** | `false` *(keeps `/api/beta` invite-only `403 BETA_CLOSED`)* | **MANDATORY** |
| **`BACKGROUND_JOBS_ENABLED`** | `false` | **MANDATORY** |
| **`PROVIDER_RESEND_ENABLED`** & **`EMAIL_NOTIFICATIONS_ENABLED`** | `false` | **MANDATORY** |
| **`PROVIDER_GEMINI_ENABLED`** | `false` | **MANDATORY** |
| **`PROVIDER_META_ENABLED`** & **`PROVIDER_AUTHORIZED_INSIGHTS_ENABLED`** | `false` | **MANDATORY** |
| **`PROVIDER_LICENSED_THIRD_PARTY_ENABLED`** & **`PROVIDER_PUBLIC_DATASET_ENABLED`** | `false` | **MANDATORY** |

- **DO NOT ADD `DATABASE_ADMIN_URL`** to Vercel Production runtime.

---

## 5. Exact Remaining Owner Actions

1. **Save Environment Variables in Vercel Production** (`VIEWORA_DATABASE_URL`, fresh `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and all locked `false` flags above).
2. **Deploy the Updated Codebase to Vercel** (so the strict `VIEWORA_DATABASE_URL` + `viewora_app` guard and `403 REGISTRATION_CLOSED` separation are active in production).
3. **Verify Live Production Health:** Open `https://instagram1-beta.vercel.app/api/health` and confirm:
   - `services.database.status === "healthy"`
   - `services.database.security.source === "VIEWORA_DATABASE_URL"`
   - `services.database.security.restrictedRoleVerified === true`
   - `services.database.security.adminUrlAbsentFromRuntime === true`
   - `services.registration.publicOpen === false`
   - `services.payments.enabled === false` and `services.demoMode.enabled === false`
4. **Bootstrap Hosted Super Admin (Interactive, Fresh Credentials Only — Never Copy Local Hash/Sessions):**
   ```powershell
   npm.cmd run db:hosted:bootstrap-admin
   ```
5. **Proceed Through Controlled External Activations Only When Approved:** Resend → Gemini → Meta → Redis/Cron → Legal Counsel → 14-Day Beta → Separate Billing Activation Gate.
