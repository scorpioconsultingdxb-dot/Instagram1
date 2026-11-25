# Viewora — Critical Runtime Recovery & End-User Functionality Audit Report

**Date:** 2026-11-25  
**Application:** Viewora (`Explore More. Discover More.`) · Next.js `15.5.29`  
**Verification Scope:** Production runtime recovery (`next start`), read-only / serverless filesystem resilience, public route audit across 5 locales, customer-facing authentication UX cleanup, strict zero-tolerance browser QA, and local PostgreSQL 16 environment assessment.

---

## 1. Root Cause Analysis (Reproduced — Zero Guessing)

### A. Homepage Rendering Failure (`Error reference: 4119342153`) & Pricing Crash
- **Exact Failing Chain:**
  1. `src/app/[locale]/page.tsx:61` called `await loadConfiguredPlans()` (and `src/app/[locale]/pricing/page.tsx:37` called the same loader).
  2. When PostgreSQL `DATABASE_URL` was absent or unreachable, `loadConfiguredPlans()` (`src/lib/entitlements/service.ts:139`) fell back to `loadPlans()` → `readJsonStore('plans-config.json', ...)`.
  3. `readJsonStore()` (`src/lib/storage/persistence.ts:18`) invoked `resolveFilePath()` **outside** its `try/catch` block.
  4. `resolveFilePath()` (`src/lib/storage/persistence.ts:12`) unconditionally executed `fs.mkdirSync(path.join(process.cwd(), '.viewora-data'), { recursive: true })` **even for read-only lookups**.
- **Why It Happened in Production / Serverless Hosts (e.g., Vercel `/var/task`) Yet Passed Earlier Local Runs:**
  - On a local writable Windows folder, `.viewora-data` could be created silently, masking the bug.
  - On any **read-only filesystem** (such as Vercel serverless `/var/task`, locked Docker containers, or unwritable app directories), `fs.mkdirSync` threw an uncaught `EROFS` / `EACCES` / `ENOENT` error during SSR, triggering `src/app/[locale]/error.tsx` (`"Something went wrong loading this view"` + Next.js error digest).
  - **Reproduced Locally:** Running production `next start` with `VIEWORA_DATA_DIR=Z:\readonly-sim\.viewora-data` reproduced the exact `HTTP 500` crash on `/en`, `/en/data-transparency`, `/en/pricing`, and `/en/about` while `/en/tools`, `/en/login`, and `/en/register` returned `HTTP 200`.

### B. Data Transparency & Public Info Pages Failure (`Error reference: 809743254`)
- **Exact Failing Chain:**
  1. `src/app/[locale]/[slug]/page.tsx:88` called `getPublishedCmsBySlug(info.slug, safeLocale)` for all 11 public informational pages (`data-transparency`, `about`, `faq`, `contact`, `privacy`, `terms`, `responsible-use`, `cookies`, `resources`, `glossary`, `blog`).
  2. `getPublishedCmsBySlug()` (`src/lib/admin/store.ts:342`) called `listCmsContent()` → `loadAdminState()` → `readJsonStore('admin-store.json', ...)`, hitting the exact same uncaught `fs.mkdirSync` crash outside `try/catch`.
  3. Additionally, `PublicSlugPage` did not query PostgreSQL CMS when `DATABASE_URL` was configured, nor did it wrap optional CMS lookups in a defensive fallback.

### C. Exposed Developer Configuration Messages on Login, Registration & Recovery Pages
- `src/components/auth/LoginForm.tsx:199-207` displayed `"Live Authentication Not Configured Yet"` alongside raw internal environment variables (`DATABASE_URL`, `AUTH_SECRET`, `DEMO_MODE_ENABLED=false`) and technical redirect strings (`/en/dashboard`).
- `src/components/auth/SignupForm.tsx:151-158` displayed `"PostgreSQL Database Configuration Required"` with `DATABASE_URL` and `DEMO_MODE_ENABLED=false`, left submission enabled when registration was offline, and had `trackingAlerts` pre-checked instead of explicit opt-in.
- `src/components/auth/ForgotPasswordForm.tsx:56-60`, `src/app/api/auth/login/route.ts:121`, `src/app/api/auth/signup/route.ts:161`, `src/app/[locale]/checkout/page.tsx:22`, `src/app/[locale]/page.tsx:82`, and all 5 i18n dictionaries (`en`, `pt-BR`, `es`, `de`, `fr`) exposed internal variable names (`DATABASE_URL`, `PAYMENTS_ENABLED=false`).
- `src/app/[locale]/error.tsx:31` made an unverified promise (`"Your saved data remains safe."`).

---

## 2. Corrections Implemented

| File | Fix Applied |
| --- | --- |
| `src/lib/storage/persistence.ts` | Separated pure `resolveReadPath()` (zero `fs.mkdirSync`) from `resolveWritePath()`. Wrapped the entire `readJsonStore()` body in `try/catch` returning `fallback()` cleanly on any read-only or unavailable path. |
| `src/lib/entitlements/service.ts` | Updated `loadConfiguredPlans()`, `loadUserEntitlementOverrides()`, and `resolveEntitlements()` to never perform local filesystem I/O in production (`NODE_ENV === 'production'`); returns reviewed static `INITIAL_PLANS` cleanly when PostgreSQL is unavailable. |
| `src/lib/admin/store.ts` | Added async `loadPublishedCmsBySlug()` that queries PostgreSQL when configured, falls back to in-memory reviewed default CMS items in production without disk I/O, and never throws on public pages. |
| `src/app/[locale]/page.tsx` | Wrapped `checkAllHealth()` and `loadConfiguredPlans()` in independent `.catch(...)` fallbacks so optional sections degrade gracefully without breaking the homepage. Added `data-page-ready="homepage"` and removed `(PAYMENTS_ENABLED=false)` from FAQ copy. |
| `src/app/[locale]/[slug]/page.tsx` | Switched to `await loadPublishedCmsBySlug(...).catch(() => null)` so all 11 public info pages render static reviewed content even without DB or writable disk. Added `data-page-ready="info-<slug>"` / `tool-<slug>`. |
| `src/app/[locale]/pricing/page.tsx` | Wrapped `loadConfiguredPlans()` and `getCurrentSessionUser()` in `.catch(...)` fallbacks and added `data-page-ready="pricing"`. |
| `src/app/[locale]/r/[code]/page.tsx` & `tools/page.tsx` | Guarded referral visit tracking in `try/catch` for read-only filesystem safety; added `data-page-ready` markers. |
| `src/app/[locale]/error.tsx` | Removed unsupported data-safety promise, added `data-error-boundary="locale"` marker and direct `Explore Free Tools` recovery CTA. |
| `src/app/[locale]/login/page.tsx`, `register/page.tsx`, `LoginForm.tsx`, `SignupForm.tsx`, `ForgotPasswordForm.tsx`, `checkout/page.tsx` | Removed ALL internal env var names (`DATABASE_URL`, `AUTH_SECRET`, `DEMO_MODE_ENABLED`, `PAYMENTS_ENABLED`). Disabled submit buttons cleanly when account services are unavailable. Added branded Viewora headers, friendly redirect wording, explicit opt-in checkboxes under progressive disclosure, and direct **Explore Free Tools / Return to Homepage / Contact Support** links. |
| `src/app/api/auth/login/route.ts`, `signup/route.ts`, `src/i18n/dictionaries/*.ts` | Removed `(DATABASE_URL)` and `(PAYMENTS_ENABLED=false)` from customer-facing responses and all 5 language dictionaries; changed `trackingAlerts` default to `false` (explicit opt-in). |
| `src/lib/integration/runtime-recovery.test.ts` | Added 4 dedicated regression tests covering unwritable `VIEWORA_DATA_DIR`, production no-DB plan/CMS loading, completeness of all 11 info pages & 12 tools, and zero exposed env var strings in customer files. |

---

## 3. Database Connectivity Status (Task 5)

**Local Windows Workstation Audit Results (Verified via PowerShell):**
- Native PostgreSQL 16 binaries (`psql`, `pg_dump`, `pg_restore`, `postgres`, `C:\Program Files\PostgreSQL`, Windows `*postgres*` service): **Not installed**
- Local port `5432`: **Closed / Not listening**
- Docker Desktop (`docker`): **Not installed**
- Environment files: Only `.env.example` present (no `.env.local`)

**Action Taken:** Preserved 100% of the existing PostgreSQL 16 + Prisma architecture (40 models, 3 SQL migrations, RLS policies, `viewora_app` restricted runtime role, `npm run test:db`), did **not** replace PostgreSQL with temporary production JSON storage, and created the step-by-step installation & setup guide in [WINDOWS_POSTGRESQL_SETUP.md](file:///c:/Users/Scorpio/Videos/Instagram/WINDOWS_POSTGRESQL_SETUP.md).

---

## 4. Two-Scenario Verification Matrix (Tasks 12, 13 & 14)

### Scenario A — PostgreSQL Unavailable + Unwritable/Read-Only Production Filesystem (`next start`)
Executed with our **strict zero-tolerance browser QA harness** (`strict_recovery_qa.mjs`) that explicitly fails on error boundaries, forbidden developer strings, missing `[data-page-ready]` / `<h1>` / main content, `HTTP 5xx`, browser console/page errors, or server `stderr` errors:

| Verification Check | Result | Status |
| --- | --- | --- |
| Clean `.next` wipe + `npm.cmd run lint` | `0` errors, `0` warnings | **Verified** |
| `npm.cmd run typecheck` (`tsc --noEmit`) | `0` errors | **Verified** |
| `npm.cmd run test` (Vitest) | **16 / 16 test files · 81 / 81 tests passed** | **Verified** |
| Clean `npm.cmd run build` | **302 / 302 static pages generated** | **Verified** |
| Public routes verified in prod `next start` (read-only `VIEWORA_DATA_DIR` + no DB) | **78 / 78 routes HTTP 200** (5 locales × Homepage, 5 locales × all 11 Info Pages, Tools Directory, all 12 individual Free Tools, 5 locales × Pricing) | **Verified** |
| Interactive Engagement Calculator (no DB) | Computed deterministic result cleanly | **Verified** |
| Login, Registration & Forgot Password unavailable state | Professional unavailable notice, submit disabled, Explore Free Tools / Homepage / Support CTAs, **0 exposed env vars** | **Verified** |
| 6 Viewports (`375px`, `390px`, `768px`, `1024px`, `1440px`, `1920px`) + Dark Mode | `0px` horizontal overflow across all 6 viewports | **Verified** |
| Console Errors / Page Errors / 5xx Requests / Server `stderr` Errors | **`0` / `0` / `0` / `0`** | **Verified** |

### Scenario B — Live PostgreSQL 16 Available
| Capability | Status | Notes |
| --- | --- | --- |
| Live PostgreSQL Registration, Login, Session Revocation, Suspension, Dashboard & Admin Persistence | **Pending Infrastructure (Local Workstation)** | Native PostgreSQL 16 / Docker not installed on this Windows machine. Core PG16 migrations, 2× seed, and `viewora_app` RLS were previously verified in CI Run `45636280310`; follow `WINDOWS_POSTGRESQL_SETUP.md` to run `npm run test:db` and Scenario B locally. |
| Isolated Fixture Verification (Dashboard, Profile HQ 2.0, Admin Console) | **Locally Verified (Non-Production Isolated Demo Mode)** | Verified in Phase 3 (`phase3_*.png`) with `0` console/page errors — strictly distinguished from live PostgreSQL verification. |

---

## 5. Updated Verified Production Screenshots (Scenario A — Read-Only Prod, No DB)

All screenshots were captured **only after** `[data-page-ready]`, `<h1>`, main page content, zero error boundary, and zero exposed developer strings passed:
- Homepage (Desktop `1440×900`): `recovery_homepage_1440px.png`
- Homepage Dark Mode (Mobile `390×844`): `recovery_homepage_390px_mobile.png`
- Data Transparency (`1440×900`): `recovery_data_transparency_1440px.png`
- Free Tools Directory (`1440×900`): `recovery_tools_1440px.png`
- Pricing (`1440×900`): `recovery_pricing_1440px.png`
- Login (`1440×900`): `recovery_login_1440px.png`
- Registration (`1440×900`): `recovery_register_1440px.png`
- Isolated Demo Dashboard, Profile HQ 2.0 & Admin Console (`1440×900`): `phase3_research_pro_1440px.png`, `phase3_profile_hq_1440px.png`, `phase3_admin_1440px.png`

---

## 6. Remaining Infrastructure Blockers Before Commercial Launch

1. **Install & Provision PostgreSQL 16** (local workstation via `WINDOWS_POSTGRESQL_SETUP.md` and managed PostgreSQL 16 in production hosting), configure `DATABASE_URL` (`viewora_app`), `DATABASE_ADMIN_URL`, and a strong `AUTH_SECRET`, apply migrations, seed plans, and execute Scenario B (`npm.cmd run test:db` + live registration/login verification).
2. **External APIs & Billing (Intentionally Excluded):** Meta Graph API, Gemini live API, Resend email, and Stripe billing (`PAYMENTS_ENABLED=false`) remain disabled until explicitly authorized.
