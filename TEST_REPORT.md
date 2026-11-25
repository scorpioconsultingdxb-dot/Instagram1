# Viewora — Automated Test & Browser Verification Report (Stage 1)

**Date:** 2026-11-25  
**Environment:** Windows · Node.js `v24.19.0` · Next.js `15.5.29` · Prisma `6.19.3` · Vitest `3.2.7` · Headless Google Chrome (CDP)

## 1. Static Analysis, Prisma Validation, Unit/Integration, Build & E2E Gates

| Command | Result | Details |
| :--- | :--- | :--- |
| `npx.cmd prisma validate` | **PASS** | 40-model `prisma/schema.prisma` validated cleanly |
| `npx.cmd prisma generate` | **PASS** | Prisma Client `v6.19.3` generated cleanly |
| `npm.cmd run lint` | **PASS** | ESLint — 0 errors, 0 warnings |
| `npm.cmd run typecheck` | **PASS** | `tsc --noEmit` — 0 errors |
| `npm.cmd run test` | **PASS** | 12/12 test files passed, **56 passed | 1 skipped** (`TEST_DATABASE_URL` live Postgres check skips cleanly until PostgreSQL is running) |
| `npm.cmd run build` | **PASS** | Production Next.js 15 App Router build compiled cleanly (284 routes generated) |
| `npm.cmd run test:e2e` | **PASS** | All **9/9** strict headless Chrome CDP suites passed (`375px`–`1920px`, 5 languages, `/api/health` PostgreSQL check, independent auth UI, **0 console errors**, **0 page errors**) |

## 2. Unit & Integration Test Coverage (Vitest)

| Test File | Tests | Scope Verified |
| :--- | ---: | :--- |
| `src/lib/storage/db-persistence.test.ts` | 4 | Independent Prisma repository flows: atomic user registration + workspace creation (0 auto demo profiles), bcrypt credential verification, revocable DB sessions, single-use email verification & password reset tokens, password change session revocation, **explicit cross-account & cross-workspace authorization rejection (`WorkspaceAuthorizationError`)** on saved profiles/private notes/folders/notifications, account deletion cascade + audit preservation, plans/entitlements/locked `payments_enabled`, support ticket status history, admin user updates, and `LocalFileStorage` owner isolation |
| `src/lib/auth/auth-security.test.ts` | 5 (4 run, 1 live-DB gated) | bcrypt cost >= 12 hashing & verification, sliding-window login rate limiting & reset, open-redirect blocking (`sanitizeRedirectPath`), PostgreSQL `DATABASE_URL` detection, disabled payments default, and optional live `TEST_DATABASE_URL` `SELECT 1` test |
| `src/lib/storage/persistence.test.ts` | 7 | Personal Digital HQ preferences, shortcut/redirect sanitization, clean workspace initialization, durable 5-tier plan config, RBAC capabilities, SHA-256 user IDs & account purge, CMS & funnel analytics |
| `src/lib/tools/engines.test.ts` | 7 | All 12 canonical tool slugs and deterministic calculators |
| `src/lib/entitlements/entitlements.test.ts` | 6 | 5-tier matrix, `15%` quarterly / `30%` annual discounts, overrides, kill-switches, disabled Stripe guard |
| `src/lib/providers/phase4.test.ts` | 6 | Resilience controller, Meta HMAC webhook verifier, AI prompt-injection sandboxing, job queue, email dedupe, referrals |
| `src/lib/providers/registry.test.ts` | 5 | Demo provenance labeling, private-account refusal, non-spoofing invariant, Story honesty |
| `src/lib/instagram/normalize.test.ts` | 4 | Username/URL normalization & reserved-path blocking |
| `src/i18n/i18n.test.ts` | 4 | All 5 locales (`en`, `pt-BR`, `es`, `de`, `fr`), `hreflang` matrix, and translated UI coverage |
| `src/lib/integration/api.test.ts` | 4 | Session cookie signing & tamper rejection, payments disabled, sitemap & `robots.txt` |
| `src/lib/admin/admin.test.ts` | 3 | Admin RBAC (`401`/`403`/`200`), locked `payments_enabled`, audit logs |
| `src/lib/reports/export.test.ts` | 2 | Provenance-stamped CSV exports and structured template insights |

## 3. Browser E2E Verification (`scripts/e2e-browser-tests.mjs`)

- **Zero-Supabase Health Check:** Verified `GET /api/health` returns `services.database.engine === "postgresql"`, `services.payments.enabled === false`, and zero `supabase` strings.
- **Independent Auth UI Pages:** Verified `/en/login`, `/en/forgot-password`, `/en/reset-password`, and `/en/verify-email` render cleanly with zero Supabase copy and captured fresh screenshots (`stage1_login_1440px.png`, `stage1_reset_password_1440px.png`).
- **Multi-Viewport & 5-Language Matrix:** Strictly verified `375px`, `390px`, `768px`, `1024px`, `1440px`, and `1920px` (zero horizontal overflow), plus `/en`, `/pt-BR`, `/es`, `/de`, `/fr` public and authenticated journeys.
- **Observed Local Performance (Homepage 1440px):** TTFB `31ms`, DOMContentLoaded `81ms`, Load Complete `82ms`.

## 4. Not Executed Locally Due to Missing Host Binaries (Verified Environment Blocker)

- **Docker Desktop & PostgreSQL CLI (`docker`, `psql`, `pg_dump`, `pg_restore`, WSL) are not installed on this Windows machine.**
- Therefore, live container startup (`npm run db:up`), live `prisma migrate deploy` + `prisma db seed` against a running PostgreSQL 16 engine, live `TEST_DATABASE_URL` test execution, live container restart persistence test, and live `pg_dump`/`pg_restore` backup recovery execution could **not** be executed on this workstation and are transparently reported as environment blockers in [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md).
