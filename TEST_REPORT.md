# Viewora — Automated Test & Verification Report

**Date:** 2026-11-24
**Environment:** Windows · Node.js `v24.19.0` · Next.js `15.5.29` · Vitest `3.2.7`

## 1. Static Analysis & Build Gates

| Command | Result | Details |
| --- | --- | --- |
| `npm.cmd run lint` | **PASS** | 0 errors, 0 warnings |
| `npm.cmd run typecheck` | **PASS** | `tsc --noEmit` — 0 errors |
| `npm.cmd run test` | **PASS** | 9 test files, **40/40 tests passed** |
| `npm.cmd run build` | **PASS** | Production App Router build succeeded |

## 2. Automated Test Suite Coverage

| Test File | Tests | Scope Verified |
| --- | ---: | --- |
| `src/lib/instagram/normalize.test.ts` | 4 | Plain usernames, `@handles`, full/shorthand URLs, reserved paths, malformed handles |
| `src/lib/providers/registry.test.ts` | 5 | Demo provenance labeling, refusal to invent unknown handles, private-account refusal, non-spoofing invariant, honest Story unavailability |
| `src/lib/tools/engines.test.ts` | 7 | All 12 canonical tool slugs, ERF/ERR formulas, growth velocity, bio scorer, hashtag tiers, influencer evaluation, post diagnostics, caption & content idea generators |
| `src/lib/entitlements/entitlements.test.ts` | 6 | Reconciled 5 plans, `15%` quarterly / `30%` annual discounts, centralized overrides, kill-switches, quota enforcement, A/B determinism, disabled Stripe guard |
| `src/i18n/i18n.test.ts` | 3 | All 5 locales (`en`, `pt-BR`, `es`, `de`, `fr`), `Accept-Language` matching, `hreflang` matrix |
| `src/lib/reports/export.test.ts` | 2 | Provenance-stamped CSV exports, structured template insights |
| `src/lib/admin/admin.test.ts` | 3 | Admin RBAC (`401`/`403`/`200`), locked `payments_enabled` flag refusal, immutable audit logs |
| `src/lib/integration/api.test.ts` | 4 | HMAC session cookie signing & tamper rejection, payments disabled default, localized sitemap (120 URLs), `robots.txt` exclusions |
| `src/lib/providers/phase4.test.ts` | 6 | TTL cache, rate limiter, circuit breaker, Meta HMAC-SHA256 webhook signature & replay blocking, AI prompt-injection sandboxing & kill switch, durable job claiming/retries/dead-letter, email deduplication, referral self-referral/duplicate blocking, open-redirect sanitization |

## 3. Not Yet Verified Against Live External Services
- Live Supabase Postgres migration execution & OAuth sign-in (awaiting Supabase credentials).
- Live Meta Graph API & OAuth flow (awaiting Meta App credentials & review).
- Live Gemini API & Resend email dispatch (awaiting API keys & DNS verification).
