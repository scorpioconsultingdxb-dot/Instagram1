# Viewora — Automated & Browser Test Report

**Date:** 2026-11-25  
**Scope:** Cumulative verification across Phase 1 (Stages 1–10) and Phase 2 (Stages 11–20)

---

## 1. Local Automated Verification Summary

| Suite / Command | Status | Actual Measured Result |
| :--- | :--- | :--- |
| `npm.cmd run lint` (`eslint .`) | **PASS (Locally tested)** | `0` errors, `0` warnings |
| `npm.cmd run typecheck` (`tsc --noEmit`) | **PASS (Locally tested)** | `0` TypeScript errors |
| `npm.cmd run test` (`vitest run`) | **PASS (Locally tested)** | **13/13 test files, 66/66 tests passed** (`0` skipped) |
| `npm.cmd run build` (`next build`) | **PASS (Locally tested)** | Compiled in `4.5s`; **296/296 static pages** generated cleanly |
| `npm.cmd run test:db` (`postgres.integration.test.ts`) | **Pending infrastructure** | Mandatory fail-closed gate verified locally (exits `1` when `TEST_DATABASE_URL` is absent); ready for live PostgreSQL 16 execution |

### Vitest Unit, Security & Repository Harness Breakdown (`66/66` Passed)
1. `src/lib/tools/engines.test.ts` — 7 tests (deterministic engagement, growth, bio, hashtag, competitor, influencer, caption/ideas engines)
2. `src/lib/providers/registry.test.ts` — 5 tests (provenance invariants, private account refusal, demo fixture boundaries)
3. `src/lib/providers/phase4.test.ts` — 6 tests (resilience cache/rate-limit/circuit-breaker, Meta webhook HMAC, AI prompt sandboxing, job queue, email dedupe, referrals)
4. `src/lib/entitlements/entitlements.test.ts` — 6 tests (5-tier `$0`/`$9.99`/`$19.99`/`$39.99`/`$99.99` pricing, 15%/30% discounts, overrides, feature flag kill-switches, disabled Stripe checkout)
5. `src/lib/admin/admin.test.ts` — 3 tests (RBAC 401/403, locked `payments_enabled`, immutable audit logs)
6. `src/lib/reports/export.test.ts` — 2 tests (provenance-stamped PDF & CSV export generation)
7. `src/i18n/i18n.test.ts` — 4 tests (5-locale resolution, dictionary integrity)
8. `src/lib/instagram/normalize.test.ts` — 4 tests (username/URL normalization & validation)
9. `src/lib/integration/api.test.ts` — 4 tests (signed cookies, disabled payments, sitemap hreflang coverage across all 12 tools & 11 info pages, `robots.txt` private disallows)
10. `src/lib/auth/auth-security.test.ts` — 7 tests (production `AUTH_SECRET` rejection, zero prod fallbacks/demo mode, CSRF validation, bcrypt cost >= 12, rate limiting, open redirect prevention, PostgreSQL detection)
11. `src/lib/storage/persistence.test.ts` — 7 tests (local dev file store isolation, Personal HQ prefs, workspace state, synchronized plans, admin RBAC, collision-free user IDs, funnel persistence)
12. `src/lib/storage/db-persistence.test.ts` — 6 tests (relational Prisma harness: atomic user/workspace creation, email verification & password reset single-use, cross-account/workspace isolation, locked payments flag, session expiration/suspension/role removal/quota rejection, active session listing & cross-user revocation isolation)
13. `src/lib/integration/stages-3-to-9.test.ts` — 5 tests (CSRF across all mutating endpoints, contact/resend rate limits, admin `manage_users`/`manage_entitlements` RBAC, 5-locale parity & zero Supabase leakage, disabled payments)

---

## 2. Headless Chromium QA Verification Summary (Stage 20)

- **6 Viewports Verified (`0` Horizontal Overflow):** `375x812`, `390x844`, `768x1024`, `1024x768`, `1440x900`, `1920x1080`
- **5 Locales Verified (`0` Overflow, Single `<h1>`, `0` Supabase Copy):** `en`, `pt-BR`, `es`, `de`, `fr`
- **Themes Verified:** Light (`#F8FAFC`) & Dark (`#080D19`)
- **Interactive Stage 11–19 Checks:** All passed (Tools mode filter + count, Pricing Plan Assistant, Glossary JSON-LD, Profile HQ 9 tabs + `My Research`, Dashboard `Customize Layout`, Analytics `Metric formulas`, AI Studio 7-template cards, Admin membership distribution + RBAC Override/Suspend controls)
- **Errors:** `0` uncaught page errors, `0` unexpected console errors.
- **Screenshots Captured:** 11 desktop & mobile PNGs saved in the conversation artifact directory.

---

## 3. Real PostgreSQL 16 Verification Status (Previously Executed + Pending)

- **Independently Verified in CI Run [`45636280310`](https://github.com/scorpioconsultingdxb-dot/Instagram1/actions/runs/45636280310):** PostgreSQL 16 container startup, restricted `viewora_app` role (`NOSUPERUSER NOBYPASSRLS`), all 3 Prisma SQL migrations, double-run `db:seed` idempotency, and `db:health` under `viewora_app`.
- **Pending Infrastructure (Awaiting Owner Manual Push / Local PG16):** `npm run test:db`, `pg_dump`/`pg_restore` parity (`verify-backup-restore.mjs`), `scripts/e2e-postgres.mjs` with production app restart persistence, and PostgreSQL container restart persistence.
