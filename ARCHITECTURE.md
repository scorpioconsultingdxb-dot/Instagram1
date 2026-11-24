# Viewora — System Architecture

## 1. High-Level Layers

1. **Presentation & Routing (`src/app/[locale]/`)**:
   - Next.js 15 App Router with locale middleware (`src/middleware.ts`) supporting `en`, `pt-BR`, `es`, `de`, and `fr`.
   - Public SEO routes statically prerendered (`/[locale]`, `/[locale]/instagram-*`, `/[locale]/about|contact|faq|blog|privacy|terms|cookies|data-transparency|responsible-use`, `/sitemap.xml`, `/robots.txt`).
   - Authenticated customer routes (`/[locale]/dashboard/*`) and administrative routes (`/[locale]/admin/*`) explicitly forced dynamic (`export const dynamic = 'force-dynamic'`) with server-side session and role enforcement.
2. **Modular Data Provider Layer (`src/lib/providers/`)**:
   - Uniform `InstagramDataProvider` contract returning `ProviderResponse<T>` with explicit `dataClass` (`live` | `cached` | `estimate` | `demo`), `availability` (`available` | `partial` | `unavailable` | `private_account` | `unauthorized`), `freshness`, `confidence`, and `limitations`.
   - `ProviderRegistry` enforces a hard invariant that `demo_fixture` responses can never claim `live` or `cached` provenance.
   - `ProviderResilienceController` provides TTL caching, request deduplication, sliding-window rate limits, and circuit breaking.
3. **Centralized Entitlements & Pricing (`src/lib/entitlements/`)**:
   - Single authoritative `INITIAL_PLANS` & `resolveEntitlements()` engine merging plan entitlements, user overrides, and global feature flags.
   - Server-side `assertEntitlement()` gates exports, AI reports, and profile tracking limits.
4. **AI Intelligence (`src/lib/ai/gemini.ts`)**:
   - Official Google Gemini REST integration (`GEMINI_MODEL`, default `gemini-2.5-flash`) with Zod JSON validation, `<UNTRUSTED_PROFILE_DATA>` prompt-injection sandboxing, daily/monthly USD budget caps, AI kill switch, and transparent deterministic fallback when `GEMINI_API_KEY` is unset.
5. **Automation, Email, Health & Referrals**:
   - `src/lib/jobs/queue.ts` — atomic job claiming, idempotency, exponential backoff, dead-letter handling, and `CRON_SECRET` endpoint.
   - `src/lib/email/resend.ts` — 12 branded transactional email templates with deduplication, disabled unless `EMAIL_NOTIFICATIONS_ENABLED=true`.
   - `src/lib/referrals/service.ts` — referral code generation & anti-self-referral attribution (payouts strictly disabled).
   - `src/app/api/health/route.ts` — measured configuration & subsystem status with `x-request-id` correlation headers.
6. **Database & Row-Level Security (`supabase/migrations/`)**:
   - 38 normalized tables across 3 SQL migrations with foreign keys, check constraints, indexes, and strict RLS enforcing workspace isolation and admin-only operational access (private user research notes intentionally excluded from admin read policies).
