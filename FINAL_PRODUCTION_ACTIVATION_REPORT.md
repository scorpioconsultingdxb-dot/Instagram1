# VIEWORA — Final Production Activation & Infrastructure Protection Report

**Generated:** 2026-11-26  
**Canonical Production URL:** https://instagram1-beta.vercel.app  
**Vercel Team / Project:** `scorpioconsultingdxb-9036` / `instagram1`  
**Active Production Deployment:** `dpl_BfPjyS8kbSMSNongfZgcsqqXWqy1` (`readyState: READY`, aliased to `https://instagram1-beta.vercel.app`)  
**Hosted Database:** Neon PostgreSQL `18.7 (3190d2f)` (`neon-bisque-harbor` / branch `main` / database `neondb` / AWS US East 1)  
**Activation Posture:** Hardened Controlled Pre-Launch (`PAYMENTS_ENABLED=false`, `PUBLIC_REGISTRATION_ENABLED=false`, `DEMO_MODE_ENABLED=false`, all external providers `disabled`)

---

## 1. Executive Summary

Viewora's hosted Vercel production deployment and Neon PostgreSQL 18.7 database have completed full infrastructure hardening, restricted-role enforcement, hosted Super Admin verification, and **complete isolation of all 10 privileged Neon Marketplace owner credentials from Vercel Production**.

| Activation Pillar | Status | Verified Result |
|---|---|---|
| **Live Production Deployment** | **PASS** | `dpl_BfPjyS8kbSMSNongfZgcsqqXWqy1` (`READY`), aliased to `https://instagram1-beta.vercel.app`, live `/api/health` HTTP `200` (`latencyMs: 257`) |
| **Restricted Runtime DB Role** | **PASS** | Live `pg_roles` introspection confirms `connectedRole.role: "viewora_app"` (`rolsuper=false`, `rolcreatedb=false`, `rolcreaterole=false`, `rolbypassrls=false`) |
| **Privileged Credential Isolation (Task 3)** | **PASS — COMPLETED** | All **10** privileged Neon Marketplace variables unscoped from Vercel **Production**; **0** owner credentials injected into Production runtime; Neon database, Preview env, and integration intact |
| **Hosted Super Admin (Task 1)** | **PASS — VERIFIED LIVE** | Unique UUID `346bf4be-1922-49de-819d-d0c57af98244` (`Scorpio Marketing Agency`, `super_admin`, `agency`, `active`, `$2b$12$` bcrypt, `admin.bootstrap.created` audit record, `1` active DB session) |
| **Live Authenticated App Testing (Task 2)** | **PARTIAL / OWNER ACTION PENDING** | Live DB confirms owner authentication & revocable session persistence (`sessions_count: 1`); live interactive UI walkthrough across all routes & live dark-mode screenshots await the owner's interactive browser session (zero tests fabricated) |
| **Encrypted Backup & Branch Restore (Task 4)** | **SCRIPT READY / LINUX RUNNER PENDING** | Turnkey AES-256 + SHA-256 + isolated Neon branch restore script created at `deploy/scripts/neon-encrypted-backup-drill.sh`; awaiting authorized Linux CI/runner (no WSL/Docker on local Windows workstation; Windows Application Control respected) |
| **Local PostgreSQL Preservation** | **PASS — UNTOUCHED** | Local PostgreSQL `14.25` (`viewora`) healthy (`users: 1`, original UUID `0d507549-f807-4df8-8746-7f84ea3441d8`, `plans: 5`, `featureFlags: 5`) |
| **Code Quality & Security Suite (Task 5)** | **PASS** | `typecheck` 0 errors, `lint` 0 errors, `npm test` 24/24 files (120/120 tests), `npm run build` 322 static pages, `npm audit` 0 vulnerabilities, `npm audit --omit=dev` 0 vulnerabilities |

---

## 2. Live Production Deployment Information

| Attribute | Value |
|---|---|
| **Canonical Production URL** | `https://instagram1-beta.vercel.app` |
| **Current Deployment ID** | `dpl_BfPjyS8kbSMSNongfZgcsqqXWqy1` (post-credential-isolation controlled redeployment) |
| **Deployment Preview URL** | `https://instagram1-nwyx3am19-scorpioconsultingdxb-9036.vercel.app` |
| **Inspector URL** | `https://vercel.com/scorpioconsultingdxb-9036/instagram1/BfPjyS8kbSMSNongfZgcsqqXWqy1` |
| **Prior Hardened Deployment** | `dpl_8AW3VMX12PsZdWKZTTD8NV4qH2M9` (superseded after credential isolation) |
| **Ready State** | `READY` (`target: production`, `environment: production`) |
| **Framework / Runtime** | Next.js `15.5.29` (App Router, 322 statically generated pages + dynamic API routes) |
| **Vercel CLI** | `67.0.0` (authenticated under team `scorpioconsultingdxb-9036`, linked via git-ignored `.vercel/`) |
| **Deployment Protection** | `vercel_authentication` (Vercel preview protection active; public production alias served over HTTPS) |

---

## 3. Database Architecture

### 3.1 Hosted Production Database (Neon PostgreSQL 18.7)

| Property | Value |
|---|---|
| **Provider / Project** | Neon (`neon-bisque-harbor`) |
| **Region** | AWS US East 1 (`us-east-1`) |
| **Branch / Database** | `main` / `neondb` |
| **PostgreSQL Engine** | `PostgreSQL 18.7 (3190d2f)` (`wal_level=replica`, `max_connections=112`, TLS enforced) |
| **Runtime Connection** | Pooled PgBouncer endpoint via `VIEWORA_DATABASE_URL` (`pgbouncer=true`, `sslmode=require`) |
| **Runtime Database Role** | `viewora_app` (`NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS`) |
| **Admin Database Role** | `neondb_owner` — **strictly offline** in local git-ignored `.env.hosted.local` (`DATABASE_ADMIN_URL`); completely absent from Vercel Production |
| **Schema Inventory** | **58** public tables, **74** foreign keys, **147** indexes, **6** applied Prisma migrations |
| **Row-Level Security & Immutability** | **24** active RLS policies on `public` schema + `trg_audit_logs_immutable` append-only audit log trigger |
| **Baseline Seed State** | Double-idempotent seed verified: **5** plans, **15** billing records, **65** entitlements, **5** feature flags (`payments=false`), **6** CMS records |

### 3.2 Local Operational Database Preservation

- **Engine:** Local PostgreSQL `14.25` (`viewora` database via `.env.local`).
- **Status:** Healthy (`latencyMs: 310`), completely untouched (`users: 1`, local Super Admin UUID `0d507549-f807-4df8-8746-7f84ea3441d8`, created `2026-11-25T19:02:53.945Z`, `plans: 5`, `featureFlags: 5`).
- **Isolation:** Zero local credentials, password hashes, or sessions were copied to Neon.

---

## 4. Security Verification

### 4.1 Live Runtime Role & Strict Enforcement (`/api/health` on `dpl_BfPjyS8kbSMSNongfZgcsqqXWqy1`)

Verified via direct HTTPS request to `https://instagram1-beta.vercel.app/api/health` (`correlationId: cebb91b0-a12a-4f2d-affa-1cb84e72adf1`, `2026-11-26T11:07:22.605Z`):

- `services.database.status`: `"healthy"` (`latencyMs: 257`, `configured: true`, `reachable: true`)
- `services.database.connectedRole`:
  - `role`: `"viewora_app"`
  - `rolsuper`: `false`
  - `rolcreatedb`: `false`
  - `rolcreaterole`: `false`
  - `rolbypassrls`: `false`
  - `restrictedPrivilegeVerified`: `true`
- `services.database.security`:
  - `source`: `"VIEWORA_DATABASE_URL"`
  - `restrictedRoleVerified`: `true`
  - `vercelProductionStrict`: `true`
  - `adminUrlAbsentFromRuntime`: `true`

### 4.2 Vercel Production Environment Variable Audit (Post-Isolation)

Verified via `vercel env ls --environment production` (**27 total variables**: **19** Viewora application variables + **8** non-secret Neon metadata variables; **0** privileged Neon credentials; **0** `DATABASE_ADMIN_URL`):

| Category | Variables Present in Production | Verified State |
|---|---|---|
| **Database & Auth Secrets (2)** | `VIEWORA_DATABASE_URL`, `AUTH_SECRET` | Marked `Secret`, Production-only (`viewora_app` pooled TLS + 64-char hex secret) |
| **Canonical URLs (2)** | `AUTH_URL`, `NEXT_PUBLIC_APP_URL` | `https://instagram1-beta.vercel.app` (HTTPS cookies & canonical origin enforced) |
| **Registration & Safety Gates (9)** | `DEMO_MODE_ENABLED`, `NEXT_PUBLIC_DEMO_MODE`, `VIEWORA_ENABLE_DEMO_PROVIDER`, `PAYMENTS_ENABLED`, `NEXT_PUBLIC_PAYMENTS_ENABLED`, `PUBLIC_REGISTRATION_ENABLED`, `BETA_PUBLIC_REGISTRATION_ENABLED`, `BACKGROUND_JOBS_ENABLED`, `EMAIL_NOTIFICATIONS_ENABLED` | All `false` (verified via live `/api/health` and `403 REGISTRATION_CLOSED` gate) |
| **External Provider Flags (6)** | `PROVIDER_META_ENABLED`, `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED`, `PROVIDER_LICENSED_THIRD_PARTY_ENABLED`, `PROVIDER_PUBLIC_DATASET_ENABLED`, `PROVIDER_GEMINI_ENABLED`, `PROVIDER_RESEND_ENABLED` | All `false` (all 5 providers including `demo_fixture` reported `"status": "disabled", "configured": false`) |
| **Non-Secret Neon Metadata (8)** | `POSTGRES_HOST`, `PGHOST`, `PGHOST_UNPOOLED`, `PGDATABASE`, `POSTGRES_DATABASE`, `NEON_PROJECT_ID`, `NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_URL` | Hostname / database name / project metadata only (no usernames, passwords, or connection strings) |
| **Removed Privileged Vars (10)** | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`, `POSTGRES_PRISMA_URL`, `PGPASSWORD`, `POSTGRES_PASSWORD`, `PGUSER`, `POSTGRES_USER` | **Removed from Production** (retained on Preview only) |
| **Admin URL (1)** | `DATABASE_ADMIN_URL` | **Absent from Vercel** (local git-ignored `.env.hosted.local` only) |

### 4.3 Credential File Protection & Dependency Audits

- `.gitignore` verified via `git check-ignore -v`:
  - `.vercel` → `.gitignore:54`
  - `.env.local` → `.gitignore:55`
  - `.env.hosted.local` → `.gitignore:55`
- `npm audit`: **0 vulnerabilities** (`info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0`)
- `npm audit --omit=dev`: **0 vulnerabilities** (`total: 0`)

---

## 5. Hosted Super Admin Verification (Task 1)

Inspected directly against hosted Neon `neondb` using restricted read verification (zero credentials or password hashes printed):

| Check | Hosted Neon `neondb` | Local PostgreSQL `14.25` | Result |
|---|---|---|---|
| **User UUID** | `346bf4be-1922-49de-819d-d0c57af98244` | `0d507549-f807-4df8-8746-7f84ea3441d8` | **PASS — Distinct hosted identity** |
| **Full Name** | `Scorpio Marketing Agency` | `Scorpio Marketing Agency` | **PASS** |
| **Role** | `super_admin` | `super_admin` | **PASS** |
| **Membership / Segment** | `agency` | `agency` | **PASS** |
| **Account Status** | `active` (`email_verified: true`) | `active` (`email_verified: true`) | **PASS** |
| **Password Hash Format** | Valid 60-char bcrypt (`$2b$12$`) | Valid 60-char bcrypt (`$2b$12$`) | **PASS — Strong cost-12 bcrypt** |
| **Bootstrap Timestamp** | `2026-11-26T10:57:03.885Z` | `2026-11-25T19:02:53.945Z` | **PASS — Fresh hosted bootstrap** |
| **Immutable Audit Log** | `admin.bootstrap.created` (`2026-11-26T10:57:07.179Z`) | 2 prior local entries (`audit_logs: 6`) | **PASS — Audited & immutable** |
| **Active Hosted Sessions** | `sessions_count: 1` (live revocable session) | `sessions_count: 1` (local only) | **PASS — Live login persisted to Neon** |
| **Cross-Environment Copy Check** | Zero local hashes or sessions copied | Local DB completely unchanged | **PASS** |

---

## 6. Live Authenticated Application Testing (Task 2)

### 6.1 Honest Verification Status

- **Verified via Hosted Database Evidence:** The owner's hosted Super Admin account (`346bf4be-1922-49de-819d-d0c57af98244`) has `1` active revocable session stored in Neon `neondb`, confirming live hosted HTTPS login and PostgreSQL session creation succeeded.
- **Unauthenticated Access Protection Verified Live:** Private API endpoints reject unauthenticated requests on `https://instagram1-beta.vercel.app` (verified live HTTP `401` responses; zero data leakage).
- **Pending Owner Interactive Browser Session:** Because this agent does **not** hold the owner's hosted Super Admin password and never reads external browser cookies or fabricates authentication tests, the interactive authenticated route walkthrough across live `https://instagram1-beta.vercel.app` (Dashboard, Super Admin Console, Personal Digital HQ, Saved Profiles, Research Workspace, Report Builder, AI Studio, Membership Management, Notifications, Account Settings, browser reload persistence, secure logout, desktop/mobile responsive checks, and **live authenticated dark-mode screenshots**) remains **Pending Owner Interactive Verification**.
  - *Note on prior visual baseline:* The 42 redacted dark-mode screenshots archived in `viewora_dark_mode_product_screenshots.zip` were captured against the local `viewora_test` environment and are **not** counted as live Vercel production screenshots.
  - *How to complete cleanly:* The owner can either perform the 5-minute interactive checklist directly in their signed-in browser session on `https://instagram1-beta.vercel.app` (capturing Dashboard + Super Admin Console screenshots) or sign in interactively inside the workspace browser pane when ready for automated screenshot capture.

### 6.2 Feature Readiness Matrix — Operational Now vs. Awaiting External API Activation

| Feature Area | Live Production Status | Notes |
|---|---|---|
| **Authentication, RBAC, Revocable DB Sessions, Audit Logs** | **Operational Now** | Backed by Neon PostgreSQL 18.7 (`viewora_app` + 24 RLS policies) |
| **Super Admin Console (`/en/admin`)** | **Operational Now** | User management, plans/entitlements, CMS, feature flags, audit log viewer, support tickets |
| **Customer Dashboard & Workspace Core** | **Operational Now** | Personal Digital HQ, Saved Profiles, Folders, Private Notes, Notifications, Account Settings, Membership view |
| **Report Builder & Export Engine** | **Operational Now** | Workspace-scoped report drafting and structured export |
| **12 Free Public Creator Tools (`/en/tools`)** | **Operational Now** | Client/server calculators & generators available without login |
| **Public Registration (`/en/register`, `/api/auth/signup`)** | **Intentionally Closed (`403 REGISTRATION_CLOSED`)** | Controlled pre-launch gate active (`PUBLIC_REGISTRATION_ENABLED=false`) |
| **Live Instagram Profile Sync / Graph Insights** | **Awaiting External API Activation** | Requires Meta App Review + `PROVIDER_META_ENABLED=true` / `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=true` |
| **AI Intelligence Studio Live Generation** | **Awaiting External API Activation** | Requires `GEMINI_API_KEY` + `PROVIDER_GEMINI_ENABLED=true` (daily budget cap `\$10` & kill-switch ready) |
| **Transactional Email Verification & Alerts** | **Awaiting External API Activation** | Requires Resend domain verification + `PROVIDER_RESEND_ENABLED=true` + `EMAIL_NOTIFICATIONS_ENABLED=true` |
| **Scheduled Background Jobs / Sync Workers** | **Awaiting External API Activation** | Requires Redis/Cron worker infrastructure + `BACKGROUND_JOBS_ENABLED=true` |
| **Checkout, Subscriptions & Invoicing** | **Intentionally Disabled (Phase 7 Gate)** | `PAYMENTS_ENABLED=false`, `NEXT_PUBLIC_PAYMENTS_ENABLED=false`, DB feature flag `payments=false` |

---

## 7. Privileged Neon Credential Isolation Results (Task 3)

### 7.1 Pre-Flight Verification

Before removing any Marketplace variables from Production:
1. Verified `npx prisma generate` completes cleanly in `657 ms` with both `DATABASE_URL=""` and `VIEWORA_DATABASE_URL=""` (zero build-time dependency on Marketplace `DATABASE_URL`).
2. Audited all **18** Neon Marketplace variables and confirmed zero application references to any of the **10** privileged credential variables in Vercel Production (`src/lib/db/prisma.ts` strictly requires `VIEWORA_DATABASE_URL` with zero fallback).

### 7.2 Isolation Execution Results

All **10** privileged Neon Marketplace variables were cleanly unscoped from Vercel **Production** via `vercel env rm <NAME> --environment production --confirm-name <NAME>`:

1. `POSTGRES_URL_NO_SSL` — **Removed from Production** (`383ms`)
2. `DATABASE_URL_UNPOOLED` — **Removed from Production** (`379ms`)
3. `POSTGRES_URL_NON_POOLING` — **Removed from Production** (`382ms`)
4. `POSTGRES_URL` — **Removed from Production** (`509ms`)
5. `POSTGRES_PRISMA_URL` — **Removed from Production** (`438ms`)
6. `PGPASSWORD` — **Removed from Production** (`446ms`)
7. `POSTGRES_PASSWORD` — **Removed from Production** (`369ms`)
8. `PGUSER` — **Removed from Production** (`499ms`)
9. `POSTGRES_USER` — **Removed from Production** (`364ms`)
10. `DATABASE_URL` — **Removed from Production** (`420ms`)

**Preserved Intact:**
- `VIEWORA_DATABASE_URL` (Production Secret — `viewora_app` restricted pooled role)
- `AUTH_SECRET` (Production Secret)
- All **17** Viewora application configuration & safety flags
- All **8** non-secret Neon metadata variables (`POSTGRES_HOST`, `PGHOST`, `PGHOST_UNPOOLED`, `PGDATABASE`, `POSTGRES_DATABASE`, `NEON_PROJECT_ID`, `NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_URL`)
- All Preview environment variables and the underlying Neon integration & `neon-bisque-harbor` database

### 7.3 Controlled Post-Isolation Redeployment

- Executed one controlled Production redeployment: `dpl_BfPjyS8kbSMSNongfZgcsqqXWqy1` (`READY`, aliased to `https://instagram1-beta.vercel.app`).
- Re-verified live `/api/health` immediately after cutover: HTTP `200`, `latencyMs: 257`, `connectedRole.role: "viewora_app"`, `restrictedPrivilegeVerified: true`, `vercelProductionStrict: true`, `adminUrlAbsentFromRuntime: true`.

### 7.4 Safe Recovery & Credential Hygiene Procedure

- **If any Marketplace variable is ever needed again in Production:** Re-attach the `Production` target in Vercel Dashboard → Project `instagram1` → Settings → Environment Variables (variables remain listed under `Preview`), or re-sync via Vercel Dashboard → Integrations → Neon.
- **Defense-in-Depth Recommendation:** Because unscoping an environment variable in Vercel does not revoke the underlying `neondb_owner` password in Neon (and Preview still references it), rotate `neondb_owner` in the Neon Console if Preview access is no longer required or after any administrative personnel change, and update local `.env.hosted.local` accordingly.

---

## 8. Hosted Backup & Disaster Recovery Status (Task 4)

### 8.1 Neon Platform Backup & History Posture

- Inspected live Neon `pg_settings`: `server_version: "18.7 (3190d2f)"`, `wal_level: "replica"`, `max_connections: "112"`, `archive_mode: "off"` (Neon manages continuous WAL history internally via Neon Instant Restore / PITR).
- **Neon Instant Restore Tiers (informational — no paid upgrade purchased):**
  - Free tier: up to 6 hours / 1 GB history
  - Launch tier: up to 7 days restore window
  - Scale tier: up to 30 days restore window (`\$0.20/GB-month` history storage)

### 8.2 Turnkey Encrypted Backup & Isolated Branch Restore Script

Created [neon-encrypted-backup-drill.sh](file:///c:/Users/Scorpio/Videos/Instagram/deploy/scripts/neon-encrypted-backup-drill.sh), implementing:
1. Compressed custom-format PostgreSQL 18 dump (`pg_dump --format=custom --compress=9 --no-owner --no-privileges`) from `main`.
2. OpenSSL `AES-256-CBC` encryption with PBKDF2 (`-iter 600000 -salt`) using `BACKUP_ENCRYPTION_KEY` from secret env (never CLI args).
3. `sha256sum` checksum generation and bit-for-bit verification before and after decryption.
4. Hard safety guard that **aborts immediately (`exit 2`)** if `NEON_RESTORE_TARGET_URL` shares the same endpoint host as `NEON_ADMIN_SOURCE_URL` (guaranteeing `main` / production `neondb` can never be overwritten).
5. Isolated Neon child-branch `pg_restore --single-transaction --exit-on-error` + automated verification of:
   - `>= 58` public tables
   - `>= 6` completed Prisma migrations
   - `>= 24` public RLS policies
   - `trg_audit_logs_immutable` trigger
   - `viewora_app` restricted role flags
   - Measured backup duration & restore duration (seconds).

### 8.3 Honest Execution Status

- **Status:** **Pending Authorized Linux Runner / GitHub Actions Execution**
- **Why not executed locally:** Confirmed neither WSL nor Docker is installed on this Windows workstation, and local Windows `pg_dump.exe` / `pg_restore.exe` binaries remain blocked by Windows Application Control (strictly honored, never bypassed).
- **Next Owner Action:** Create a temporary isolated Neon child branch (e.g., `dr-restore-drill`), run `deploy/scripts/neon-encrypted-backup-drill.sh` on a Linux CI runner (with PostgreSQL 18 client tools installed), archive the measured backup/restore durations and SHA-256 checksum, then delete the temporary child branch.

---

## 9. Final Production & Local Regression Verification (Task 5)

| Verification Suite | Scope | Result | Measured Details |
|---|---|---|---|
| **Live HTTPS `/api/health`** | `https://instagram1-beta.vercel.app/api/health` | **PASS (14/14)** | HTTP `200`, `latencyMs: 257`, `viewora_app` verified via live `pg_roles`, all 5 providers `disabled`, `payments: false`, `demoMode: false`, `registration.publicOpen: false` |
| **Live Public Routes (10/10)** | `/en`, `/en/login`, `/en/register`, `/en/pricing`, `/en/tools`, `/en/launch`, `/en/beta`, `/en/data-transparency`, `/en/privacy`, `/en/terms` | **PASS (10/10)** | All HTTP `200`, **0** Supabase references across all rendered HTML |
| **Live Registration Gate** | `POST /api/auth/signup` | **PASS** | HTTP `403`, `{"ok":false,"code":"REGISTRATION_CLOSED",...}` (clearly distinct from DB unavailability) |
| **Live Private API Gates** | `/api/admin/overview`, `/api/auth/profile`, `/api/dashboard/workspace` (unauthenticated) | **PASS** | All three returned HTTP `401` (unauthenticated access strictly blocked) |
| **Vercel Production Env Audit** | `vercel env ls --environment production` | **PASS** | 19 Viewora vars + 8 non-secret Neon metadata vars; **0** privileged Neon vars; **0** `DATABASE_ADMIN_URL` |
| **Hosted Neon DB Health** | `npm run db:hosted:health` | **PASS** | `healthy`, `users: 1`, `plans: 5`, `featureFlags: 5` |
| **Local PG 14.25 Health** | `npm run db:health` | **PASS** | `healthy`, `latencyMs: 310`, `users: 1` (UUID `0d507549-f807-4df8-8746-7f84ea3441d8` untouched) |
| **TypeScript Typecheck** | `npm run typecheck` | **PASS** | `tsc --noEmit` — 0 errors |
| **ESLint** | `npm run lint` | **PASS** | `eslint .` — 0 errors, 0 warnings |
| **Automated Test Suite** | `npm test` | **PASS** | 24/24 test files, **120/120 tests passed** (`10.40s`) |
| **Production Build** | `npm run build` | **PASS** | Next.js `15.5.29` compiled in `12.5s`, **322/322 static pages** generated |
| **Dependency Security Audit** | `npm audit` & `npm audit --omit=dev` | **PASS** | **0** vulnerabilities across all and production-only dependencies |
| **Git Secret Hygiene** | `git check-ignore -v` | **PASS** | `.vercel`, `.env.local`, `.env.hosted.local` all excluded |

---

## 10. Actual Remaining Blockers & Commercial Launch Prerequisites

No critical infrastructure or security blockers remain for controlled pre-launch operation. The actual remaining items before **closed beta** and **commercial launch** are:

1. **Owner Interactive Live Authenticated Walkthrough & Screenshots (Pre-Beta):** Complete live signed-in verification across all authenticated screens on `https://instagram1-beta.vercel.app` (desktop & mobile) and capture live redacted dark-mode screenshots of Dashboard and Super Admin Console.
2. **Encrypted Backup & Isolated Branch Restore Drill Execution (Pre-Beta):** Execute `deploy/scripts/neon-encrypted-backup-drill.sh` on an authorized Linux CI runner (PostgreSQL 18 client tools) and record verified RTO/RPO timings; evaluate upgrading Neon restore window to Launch (7d) or Scale (30d) before onboarding external user data.
3. **External Uptime & Alerting Monitor (Pre-Beta):** Configure external synthetic monitoring (e.g., Better Stack / UptimeRobot / Checkly) targeting `https://instagram1-beta.vercel.app/api/health` (`uptimeMeasured` intentionally reports `unavailable_external_monitor_required` until attached).
4. **Custom Production Domain & Canonical URL Cutover (Pre-Beta):** Attach the official Viewora domain in Vercel, verify TLS certificates, and update `AUTH_URL` and `NEXT_PUBLIC_APP_URL`.
5. **External API Provider Activations (Commercial Launch):** Resend (transactional email), Gemini (AI Studio), Meta Graph API / Authorized Insights (live Instagram analytics), and Redis/Cron background workers.
6. **Legal, Privacy & Compliance Sign-Off (Commercial Launch):** Finalize corporate entity details, GDPR/CCPA data processing disclosures, Meta platform terms compliance, and Terms of Service.
7. **Separate Phase 7 Billing & Payments Gate (Commercial Launch):** Payment processor onboarding, webhook signature verification, tax/invoicing compliance, and explicit owner authorization before setting `PAYMENTS_ENABLED=true`.

---

## 11. Recommended Next Activation Sequence

1. **Stage A — Final Owner Pre-Beta Checks (Now):**
   - Complete interactive authenticated browser walkthrough on `https://instagram1-beta.vercel.app` (confirm Dashboard, Super Admin Console, Digital HQ, Saved Profiles, Research, Report Builder, AI Studio, Membership, Notifications, Settings, reload persistence, and logout).
   - Commit the hardened repository changes (`src/lib/db/prisma.ts`, `src/app/api/health/route.ts`, `.vercelignore`, `deploy/scripts/neon-encrypted-backup-drill.sh`, and activation reports) to Git.
2. **Stage B — Operational Resilience:**
   - Run `deploy/scripts/neon-encrypted-backup-drill.sh` on a Linux CI runner against a temporary Neon child branch and archive the verified DR report.
   - Attach external `/api/health` uptime monitoring + alerting.
   - Cut over to the custom production domain and update `AUTH_URL` / `NEXT_PUBLIC_APP_URL`.
3. **Stage C — Controlled External API Rollout (One Provider at a Time):**
   - **Step 1:** Activate **Resend** (`PROVIDER_RESEND_ENABLED=true`, `EMAIL_NOTIFICATIONS_ENABLED=true`) — unlocks email verification, password reset, and invite emails.
   - **Step 2:** Activate **Gemini** (`PROVIDER_GEMINI_ENABLED=true`) with enforced daily budget cap and kill-switch testing.
   - **Step 3:** Activate **Meta Official / Authorized Insights** (`PROVIDER_META_ENABLED=true`) after Meta App Review approval.
   - **Step 4:** Provision **Redis + Scheduled Workers** (`BACKGROUND_JOBS_ENABLED=true`) for durable rate-limiting and scheduled profile refreshes.
4. **Stage D — 14-Day Controlled Invitation-Only Beta:**
   - Open invite-only onboarding (`BETA_PUBLIC_REGISTRATION_ENABLED=true` or curated Super Admin invitations), monitor error rates, DB latency, and RLS isolation for 14 days.
5. **Stage E — Separate Phase 7 Commercial Billing Gate:**
   - Only after legal sign-off and successful beta metrics, complete payment processor integration and unlock `PAYMENTS_ENABLED=true` under explicit owner sign-off.
