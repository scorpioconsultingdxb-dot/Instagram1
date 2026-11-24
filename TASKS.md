# Viewora — Master Task Checklist

## Completed Locally & Verified
- [x] Audit existing workspace & analyze reference positioning (`dolphinradar.com`)
- [x] Implement Viewora brand design system (`#080D19`, `#131C2E`, `#7957FF`, `#A99AFF`, `#22D3EE`, Plus Jakarta Sans + Inter, reduced-motion, light/dark modes)
- [x] Implement 5-locale i18n (`en`, `pt-BR`, `es`, `de`, `fr`) with `hreflang` & locale-prefixed URLs
- [x] Build 14-section public homepage with `Explore More. Discover More.` hero & username/URL normalizer
- [x] Build all 12 dedicated SEO free tool routes (`/[locale]/instagram-*`) including Caption Generator & Content Ideas Generator
- [x] Build all 9 public information pages (`/about`, `/contact`, `/faq`, `/blog`, `/privacy`, `/terms`, `/cookies`, `/data-transparency`, `/responsible-use`) with honeypot-protected `/api/contact`
- [x] Isolate demo authentication strictly behind `DEMO_MODE_ENABLED=false` default
- [x] Implement `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/callback`, `/onboarding`, `/api/auth/export-data`, `/api/auth/delete-account`
- [x] Reconcile authoritative 5-tier pricing & centralized entitlement matrix (`Free` $0, `Starter` $9.99, `Premium` $19.99, `Pro` $39.99, `Agency` $99.99; `15%` quarterly / `30%` annual)
- [x] Build dedicated customer dashboard routes (`/dashboard`, `/dashboard/profiles`, `/dashboard/profiles/[id]`, `/dashboard/analytics`, `/dashboard/activity`, `/dashboard/calendar`, `/dashboard/competitors`, `/dashboard/ai-insights`, `/dashboard/reports`, `/dashboard/notifications`, `/dashboard/subscription`, `/dashboard/billing`, `/dashboard/settings`, `/dashboard/support`)
- [x] Build provider resilience controller (TTL cache, deduplication, rate limiting, circuit breaker) & commercial evaluation matrix
- [x] Implement Meta OAuth starter (`/api/meta/oauth/start`), Meta webhook GET/POST HMAC-SHA256 verification & replay protection (`/api/webhooks/meta`)
- [x] Implement Gemini AI intelligence engine (7 report types, Zod schema validation, `<UNTRUSTED_PROFILE_DATA>` prompt-injection sandboxing, USD daily/monthly budget caps, deterministic fallback)
- [x] Implement background job engine (atomic claiming, idempotency, retries, exponential backoff, dead-letter, heartbeats, `CRON_SECRET` guard)
- [x] Implement Resend transactional email service (12 branded templates, deduplication, disabled by default)
- [x] Implement referral & affiliate attribution engine (self-referral blocking, duplicate prevention, payouts disabled)
- [x] Implement 21-route Super Admin Control Center (`/admin/*`) with server-side least-privilege RBAC & immutable audit logging
- [x] Implement `/api/health` measured system health endpoint with correlation IDs
- [x] Author 3 Supabase PostgreSQL migrations + RLS policies + idempotent seed script
- [x] Pass ESLint (0 errors), TypeScript strict (0 errors), 40/40 automated Vitest tests, Next.js production build, and live browser verification

## Blocked / Awaiting External Credentials or Authorization
- [ ] Configure live Supabase project credentials (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and execute migrations against a live Postgres instance
- [ ] Configure Official Meta App credentials (`META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_GRAPH_API_ACCESS_TOKEN`, `META_INSTAGRAM_BUSINESS_ACCOUNT_ID`) and pass Meta App Review
- [ ] Evaluate & license optional third-party data vendor (`LICENSED_DATA_PROVIDER_API_KEY`)
- [ ] Configure `GEMINI_API_KEY` for live Gemini AI generation
- [ ] Configure `RESEND_API_KEY` and verify sending domain SPF, DKIM, and DMARC records
- [ ] Install `git` on local workstation to initialize repository and record local Git commits
- [ ] Complete formal legal counsel review of draft Privacy Policy, Terms of Service, and Cookie Policy (GDPR, LGPD, UAE PDPL)
- [ ] **Phase 7 (Future — Do Not Activate Now):** Authorize and implement live Stripe checkout, webhooks, and affiliate payouts
