# Viewora — Hosted Neon PostgreSQL Database Activation Report (`neon-bisque-harbor`)

**Date:** 2026-11-26  
**Target Live Vercel App:** `https://instagram1-beta.vercel.app/en`  
**Target Neon Resource:** `neon-bisque-harbor`  
**Activation Execution Status:** **TOOLING, ISOLATION & CODE READY — LIVE NEON CONNECTION AWAITING REAL `DATABASE_ADMIN_URL` IN `.env.hosted.local`**

> **Honest Execution Disclosure (Zero Fabrication):** When `.env.hosted.local` was inspected (keys and format shapes only — zero secrets printed), `DATABASE_ADMIN_URL` contained a **32-character placeholder value** (`StartsPg: False`, `HasNeon: False`, `IsPlaceholder: True`). In strict accordance with Viewora's safety rules, the hosted runner refused to fall back to local PostgreSQL (`127.0.0.1`), zero changes were made to local `.env.local` or local PostgreSQL `14.25`, and live Neon connectivity, role creation, migrations, and seeding remain **pending** until the owner pastes Neon's direct unpooled admin URI (`DATABASE_URL_UNPOOLED`) into `.env.hosted.local`.

---

## 1. Completed Independently Executable Preparation (Tasks 1–8)

### Task 1 — Environment Isolation & Explicit Hosted Commands (COMPLETED & VERIFIED)
- **Git Exclusion Secured:** Added `.env.hosted.local` and `.env.*.local` to [`.gitignore`](file:///c:/Users/Scorpio/Videos/Instagram/.gitignore) and verified via `git check-ignore -v .env.hosted.local .env.local` (both ignored).
- **Zero Local Fallback Guard:** Built [`scripts/db/hosted-env-loader.mjs`](file:///c:/Users/Scorpio/Videos/Instagram/scripts/db/hosted-env-loader.mjs), which loads **exclusively** `.env.hosted.local`, strips any local `DATABASE_*`/`PG*` environment variables, blocks `localhost`/`127.0.0.1`/`::1`/Supabase hosts, and never prints passwords or raw URIs.
- **Explicit Hosted npm Scripts Added (`package.json`):**
  - `npm run db:hosted:inspect` — Read-only Neon version, DB name, role, privilege, TLS, schema & migration audit ([`scripts/db/hosted-inspect.mjs`](file:///c:/Users/Scorpio/Videos/Instagram/scripts/db/hosted-inspect.mjs))
  - `npm run db:hosted:setup-role` — Creates/hardens `viewora_app` (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`, zero elevated Neon role membership, zero table ownership), writes restricted pooled `VIEWORA_DATABASE_URL` directly to `.env.hosted.local` without printing the password ([`scripts/db/hosted-setup-role.mjs`](file:///c:/Users/Scorpio/Videos/Instagram/scripts/db/hosted-setup-role.mjs))
  - `npm run db:hosted:migrate` & `npm run db:hosted:migrate:status` — Forward-only `prisma migrate deploy` via direct `DATABASE_ADMIN_URL`
  - `npm run db:hosted:seed` — Production-safe idempotent reference data seed (`prisma/seed.ts`)
  - `npm run db:hosted:verify` — Non-destructive runtime verification exclusively via pooled `viewora_app` ([`scripts/db/hosted-verify-runtime.mjs`](file:///c:/Users/Scorpio/Videos/Instagram/scripts/db/hosted-verify-runtime.mjs))
  - `npm run db:hosted:health` — Runtime health check via pooled `viewora_app`
  - `npm run db:hosted:bootstrap-admin` — Interactive/env-based hosted Super Admin creator (never copies local admin hash or sessions)
- **Local Baseline Preserved:** `.env.local` and local PostgreSQL `14.25` (`viewora` & `viewora_test`) remain 100% untouched (`users: 1`, `plans: 5`, `featureFlags: 5`).

### Task 4 & Task 5 — Pre-Execution Neon Compatibility Audit (6 Migrations + Seed)
All 6 existing forward-only migrations in `prisma/migrations/` and `prisma/seed.ts` were audited for Neon compatibility without modifying any previously applied migration file:
1. `20261125000001_initial_viewora_schema` — Standard PostgreSQL DDL (58 tables, 74 FKs, 147 indexes). Compatible with Neon PostgreSQL 15/16/17.
2. `20261125000002_postgres_rls_and_roles` — Creates `app` schema, RLS helper functions (`set_config(..., true)` transaction-local), 23 RLS policies, and conditional `IF EXISTS (viewora_app)` grants. Compatible with `neondb_owner`.
3. `20261125000003_rls_hardening_and_least_privilege` — Hardens RLS policies and re-grants `viewora_app`. Compatible with `neondb_owner`.
4. `20261125000004_runtime_role_grants_and_test_role` — Loops over `['viewora_app', 'viewora_test_app']` with `IF EXISTS`, granting schema/table/sequence/function privileges and `ALTER DEFAULT PRIVILEGES`. Because `viewora_test_app` is skipped when absent on production Neon, **no production test role is required** (use a separate Neon branch for destructive integration testing).
5. `20261125000005_audit_immutability_and_hardening` — Executes `REVOKE CREATE ON SCHEMA public FROM PUBLIC`, revokes `UPDATE/DELETE/TRUNCATE` on `public.audit_logs` from `viewora_app`, and installs `trg_audit_logs_immutable`. Compatible with `neondb_owner`.
6. `20261126000001_profile_snapshots_rls` — Enables 24th RLS policy (`profile_snapshots_workspace_isolation`). Compatible with `neondb_owner`.
7. `prisma/seed.ts` — Pure `upsert`-based idempotent seeding: **5 plans, 15 billing options, 65 entitlements, 5 feature flags (`payments_enabled: false` locked), 6 CMS disclosures**, **0 demo customer accounts, 0 synthetic support tickets**.

> **Important Ordering Requirement:** Execute `npm run db:hosted:setup-role` **BEFORE** `npm run db:hosted:migrate` so `viewora_app` already exists when Migrations 2, 3, 4, and 5 execute their `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'viewora_app')` privilege grants and `audit_logs` revocations!

---

## 2. Live Execution Results Ledger (To Populate After Real `DATABASE_ADMIN_URL` Is Set)

| Verification Item | Target | Current Observed Result | Status |
| :--- | :--- | :--- | :---: |
| `.env.hosted.local` Git Exclusion | Ignored by Git | `.gitignore:22:.env.*.local` verified | **PASS** |
| Direct Neon Connectivity & PG Version | Neon `neon-bisque-harbor` + TLS | Blocked: placeholder in `.env.hosted.local` | **PENDING OWNER URI** |
| Restricted `viewora_app` Role Audit | `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`, 0 elevated memberships, 0 owned tables | Script ready (`db:hosted:setup-role`) | **PENDING OWNER URI** |
| 6 Prisma Migrations Applied | 58 tables · 6 migrations · 74 FKs · 147 indexes · 24 RLS policies | Script ready (`db:hosted:migrate`) | **PENDING OWNER URI** |
| Double Idempotent Seed | 5 plans · 15 billing · 65 entitlements · 5 flags (`payments=false`) · 6 CMS · 0 users · 0 tickets | Script ready (`db:hosted:seed`) | **PENDING OWNER URI** |
| Pooled Runtime Verification (`viewora_app`) | PgBouncer pooling + RLS `set_config` + `pg_advisory_xact_lock` + `audit_logs` immutability + DB health | Script ready (`db:hosted:verify`) | **PENDING OWNER URI** |

---

## 3. Exact Owner Execution Sequence (Once Real Neon URI Is Placed in `.env.hosted.local`)

1. Open `.env.hosted.local` locally (never paste secrets in chat) and replace the `DATABASE_ADMIN_URL` placeholder with Neon's **`DATABASE_URL_UNPOOLED`** (direct non-pooled admin connection for `neon-bisque-harbor`, ending in `?sslmode=require`).
2. Run the exact verified sequence in your local terminal (zero local DB fallback):

```powershell
# 1. Read-only inspection: confirm PG version, Neon host, DB name, TLS & empty schema
npm.cmd run db:hosted:inspect

# 2. Create/harden restricted viewora_app role & write pooled VIEWORA_DATABASE_URL into .env.hosted.local
npm.cmd run db:hosted:setup-role

# 3. Apply all 6 forward-only migrations via direct admin connection (never prisma db push)
npm.cmd run db:hosted:migrate
npm.cmd run db:hosted:migrate:status

# 4. Run production-safe seed TWICE to verify idempotency
npm.cmd run db:hosted:seed
npm.cmd run db:hosted:seed

# 5. Verify restricted pooled runtime role, 58 tables, 24 RLS policies, locks & audit immutability
npm.cmd run db:hosted:verify
npm.cmd run db:hosted:health
```

---

## 4. Vercel Production Environment Configuration (Task 7 — Marketplace-Safe)

### Solving Vercel Marketplace-Managed `DATABASE_URL`
When Neon (`neon-bisque-harbor`) is connected via the Vercel Marketplace integration, Vercel manages `DATABASE_URL`, `POSTGRES_URL`, and `POSTGRES_PRISMA_URL` using the privileged `neondb_owner` role and may lock or re-sync those variables.

To guarantee the live Vercel application **NEVER runs as `neondb_owner`**, Viewora's runtime database loader ([`src/lib/env.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/env.ts) & [`src/lib/db/prisma.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/prisma.ts)) now **strictly prioritizes `VIEWORA_DATABASE_URL` over `DATABASE_URL`**.

### Exact Environment Variables to Configure in Vercel (`instagram1` Project → Settings → Environment Variables → Production)

| Variable Name | Value / Source | Notes |
| :--- | :--- | :--- |
| **`VIEWORA_DATABASE_URL`** | Copy the restricted `viewora_app` pooled URI generated into `.env.hosted.local` by `db:hosted:setup-role` (`...-pooler...neon.tech/neondb?sslmode=require&pgbouncer=true`) | **Overrides Marketplace `DATABASE_URL` at runtime** so Vercel NEVER uses `neondb_owner` |
| **`AUTH_SECRET`** | Generate a fresh unique 64-char hex secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) | Must NOT reuse local `.env.local` secret; also derives AES-256-GCM OAuth encryption key via HKDF-SHA256 |
| **`AUTH_URL`** | `https://instagram1-beta.vercel.app` | Must match canonical HTTPS origin |
| **`NEXT_PUBLIC_APP_URL`** | `https://instagram1-beta.vercel.app` | Must match canonical HTTPS origin |
| **`DEMO_MODE_ENABLED`** | `false` | Permanently locked off in production |
| **`NEXT_PUBLIC_DEMO_MODE`** | `false` | Permanently locked off in production |
| **`PAYMENTS_ENABLED`** | `false` | Keep disabled until separate billing approval |
| **`NEXT_PUBLIC_PAYMENTS_ENABLED`** | `false` | Keep disabled until separate billing approval |
| **`BETA_PUBLIC_REGISTRATION_ENABLED`** | `false` | Keep invitation-only closed beta |
| **`BACKGROUND_JOBS_ENABLED`** | `false` | Keep disabled until Stage 67 cron approval |
| **`PROVIDER_RESEND_ENABLED`** | `false` | Keep disabled until Stage 63 approval |
| **`EMAIL_NOTIFICATIONS_ENABLED`** | `false` | Keep disabled until Stage 63 approval |
| **`PROVIDER_GEMINI_ENABLED`** | `false` | Keep disabled until Stage 64 approval |
| **`PROVIDER_META_ENABLED`** | `false` | Keep disabled until Stage 65 approval |
| **`PROVIDER_AUTHORIZED_INSIGHTS_ENABLED`** | `false` | Keep disabled until Stage 65 approval |
| **`PROVIDER_LICENSED_THIRD_PARTY_ENABLED`** | `false` | Keep disabled until Stage 66 approval |

- **CRITICAL:** Do **NOT** add `DATABASE_ADMIN_URL` or `DATABASE_URL_UNPOOLED` as runtime app credentials in Vercel. If Vercel Marketplace allows deleting/unlinking `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING` / `POSTGRES_URL_NO_SSL` from the Production runtime, remove them as defense-in-depth; regardless, Viewora runtime code only connects via `VIEWORA_DATABASE_URL`.
- **Redeploy Rule:** Do **not** redeploy Vercel until `db:hosted:verify` passes locally against Neon AND the owner has configured `VIEWORA_DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL` in Vercel Production settings.

---

## 5. Hosted Super Admin Bootstrap Procedure (Task 8)

- **Zero Hash/Session Copying:** Never copy password hashes or active sessions from local PostgreSQL `14.25`.
- **Execution Timing:** Run **only after** `db:hosted:verify` succeeds and the owner supplies fresh hosted Super Admin credentials directly in their local terminal (never in chat):

```powershell
# Interactive prompt (password never saved in shell history or files)
npm.cmd run db:hosted:bootstrap-admin
```

The bootstrap script (`scripts/db/create-admin.ts`) enforces strong password complexity (`≥ 12` chars, mixed character classes), hashes with `bcrypt` cost `12`, creates the `super_admin` (`agency` segment) account transactionally, and appends an immutable `admin.bootstrap.created` entry to `public.audit_logs`.

---

## 6. Remaining Blockers

1. **Real Neon Unpooled Admin URI in `.env.hosted.local`:** Replace the 32-char placeholder for `DATABASE_ADMIN_URL` with Neon's `DATABASE_URL_UNPOOLED`, then run `db:hosted:inspect` → `db:hosted:setup-role` → `db:hosted:migrate` → `db:hosted:seed` (×2) → `db:hosted:verify`.
2. **Vercel Environment Configuration & Redeploy:** Owner sets `VIEWORA_DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, and `NEXT_PUBLIC_APP_URL` (plus all locked `false` flags) in Vercel before redeploying `https://instagram1-beta.vercel.app/en`.
3. **Owner Hosted Super Admin Credentials:** Run `npm.cmd run db:hosted:bootstrap-admin` once Neon initialization passes and the owner supplies credentials.
4. **Isolated Neon Test Branch (Optional):** Before running destructive live PostgreSQL integration tests (`test:db`) against Neon, create a separate Neon branch (e.g., `test`) so production `neon-bisque-harbor` remains 100% free of synthetic test records.
