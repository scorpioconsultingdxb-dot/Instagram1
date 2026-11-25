# Viewora — Automated Test & Browser Verification Report

**Date:** 2026-11-25  
**Environment:** Windows · Node.js `v24.19.0` · Next.js `15.5.29` · Vitest `3.2.7` · Headless Google Chrome (CDP)

## 1. Static Analysis, Unit/Integration & Build Gates

| Command | Result | Details |
| --- | --- | --- |
| `npm.cmd run lint` | **PASS** | ESLint — 0 errors, 0 warnings |
| `npm.cmd run typecheck` | **PASS** | `tsc --noEmit` — 0 errors |
| `npm.cmd run test` | **PASS** | 10 test files, **45/45 tests passed** |
| `npm.cmd run build` | **PASS** | Production App Router build compiled cleanly (281 static pages generated) |
| `npm.cmd run test:e2e` | **PASS** | 7 end-to-end browser suites passed with 0 console errors and 0 page errors |

## 2. Unit & Integration Test Coverage (Vitest)

| Test File | Tests | Scope Verified |
| --- | ---: | --- |
| `src/lib/instagram/normalize.test.ts` | 4 | Plain usernames, `@handles`, full/shorthand URLs, reserved paths, malformed handles |
| `src/lib/providers/registry.test.ts` | 5 | Demo provenance labeling, refusal to invent unknown handles, private-account refusal, non-spoofing invariant, honest Story unavailability |
| `src/lib/tools/engines.test.ts` | 7 | All 12 canonical tool slugs, ERF/ERR formulas, growth velocity, bio scorer, hashtag tiers, influencer evaluation, post diagnostics, caption & content idea generators |
| `src/lib/entitlements/entitlements.test.ts` | 6 | Reconciled 5 plans, `15%` quarterly / `30%` annual discounts, centralized overrides, kill-switches, quota enforcement, A/B determinism, disabled Stripe guard |
| `src/i18n/i18n.test.ts` | 3 | All 5 locales (`en`, `pt-BR`, `es`, `de`, `fr`), `Accept-Language` matching, `hreflang` matrix |
| `src/lib/reports/export.test.ts` | 2 | Provenance-stamped CSV exports, structured template insights |
| `src/lib/admin/admin.test.ts` | 3 | Admin RBAC (`401`/`403`/`200`), locked `payments_enabled` flag refusal, immutable audit logs |
| `src/lib/integration/api.test.ts` | 4 | HMAC session cookie signing & tamper rejection, payments disabled default, localized sitemap, `robots.txt` exclusions |
| `src/lib/providers/phase4.test.ts` | 6 | TTL cache, rate limiter, circuit breaker, Meta HMAC-SHA256 webhook signature & replay blocking, AI prompt-injection sandboxing & kill switch, durable job queue, email deduplication, referral anti-abuse, open-redirect sanitization |
| `src/lib/storage/persistence.test.ts` | 5 | Durable Personal Digital HQ preferences & user isolation, shortcut/redirect sanitization, clean workspace init (zero forced demo profiles) + durable folders/reports/exports/read-states, 5-tier plan persistence & reset, least-privilege admin capabilities + CMS/ticket/broadcast/metrics persistence |

## 3. Browser E2E Verification (`scripts/e2e-browser-tests.mjs`)

- **Multi-Viewport Responsive Matrix:** Verified `375px`, `390px`, `768px`, `1024px`, `1440px`, and `1920px` — all zero horizontal overflow, H1 present, skip-to-content link present, hero search visible.
- **Light & Dark Theme Verification:** Verified light canvas and programmatic dark canvas (`rgb(8, 13, 25)` Midnight Navy) with visual screenshot inspection.
- **Five-Language Coverage:** Verified `/en`, `/pt-BR`, `/es`, `/de`, `/fr` HTML `lang` attribute, clean titles (no duplicate brand suffix), and non-empty localized copy.
- **Free Tools & Honesty:** Verified `/tools` directory, deterministic Engagement Calculator formula box (`4.72%`), and Story Viewer honest `UNAVAILABLE` disclosure.
- **Persistent Customer Workspace & Personal HQ:** Verified clean initial dashboard (0 forced demo profiles), saving `@viewora.studio` into a created research folder with private note & tags, full page reload persistence, accessible analytics table, mobile `390px` dashboard layout, and Personal Digital HQ persistence across reload.
- **Pricing & Admin Operations:** Verified 5-tier pricing with `PAYMENTS_ENABLED=false`, Admin Console rendering as `super_admin`, and server `403` refusal when attempting to toggle locked `payments_enabled`.
- **Observed Local Performance (Homepage 1440px):** TTFB ~113ms, DOMContentLoaded ~346ms, Load Complete ~349ms.

## 4. Not Yet Verified Against Live External Services
- Live Supabase Postgres migration execution (`20261125000004_experience_upgrade.sql`) and live Supabase Auth / OAuth (excluded by scope / awaiting credentials).
- Live Meta Graph API, licensed Instagram data providers, live Gemini API, Resend email dispatch, and Stripe billing (explicitly out of scope / disabled).
