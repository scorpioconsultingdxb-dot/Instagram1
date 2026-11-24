# Viewora — Master Implementation Plan

**Brand:** Viewora — *Explore More. Discover More.*
**Model:** Freemium SaaS (Public Free Tools → Profile Insights → Premium Dashboard → Subscriptions & Agency Workspaces)
**Payment Gate:** Phase 7 (Stripe Integration) is strictly reserved and disabled (`PAYMENTS_ENABLED=false`) until separate commercial authorization.

## Phase Overview

| Phase | Scope | Status |
| --- | --- | --- |
| **Phase 1 — Foundation & Design System** | Next.js App Router, strict TypeScript, Tailwind CSS v4, Plus Jakarta Sans & Inter fonts, Viewora palette (`#080D19`, `#131C2E`, `#7957FF`, `#A99AFF`, `#22D3EE`, `#F8FAFC`), 5-locale i18n (`en`, `pt-BR`, `es`, `de`, `fr`), Supabase schema & RLS migrations, modular provider contract. | Implemented & Verified Locally |
| **Phase 2 — Public Website & 12 Free Tools** | 14-section homepage, username/URL search with provenance badges (`LIVE`/`CACHED`/`ESTIMATED`/`DEMO`/`UNAVAILABLE`), 12 standalone SEO tool routes (`/instagram-*`), 9 public info/legal draft pages (`/about`, `/contact`, `/faq`, `/blog`, `/privacy`, `/terms`, `/cookies`, `/data-transparency`, `/responsible-use`). | Implemented & Verified Locally |
| **Phase 3 — Authentication & Customer Dashboard** | Supabase Auth integration, server-controlled `DEMO_MODE_ENABLED=false` isolation, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/callback`, 4-step `/onboarding`, GDPR/LGPD/UAE PDPL export & deletion APIs, dedicated `/dashboard/*` routes, centralized entitlements, reconciled 5-tier pricing (`15%` quarterly / `30%` annual). | Implemented & Verified Locally (Live Supabase Auth awaiting credentials) |
| **Phase 4 — Live Providers, Automation, Email & Super Admin** | Provider resilience (TTL cache, deduplication, rate limiting, circuit breaker), Official Meta OAuth & HMAC webhook verification, Gemini AI engine (7 report types, Zod schema, prompt-injection isolation, USD cost budgets), durable background job engine, Resend email service (12 templates, disabled by default), referral architecture (payouts disabled), `/api/health`, 21-route `/admin/*` Super Admin Control Center. | Implemented & Verified Locally (External API keys awaiting credentials) |
| **Phase 5 — SEO, Performance & Growth** | Canonical URLs, `hreflang` across 5 locales, localized `sitemap.xml` (120 entries), `robots.txt`, JSON-LD structured data, consent-aware analytics banner & funnel instrumentation, A/B testing engine, educational guides. | Implemented & Verified Locally |
| **Phase 6 — Security, Testing & Production Readiness** | CSP & security headers, HMAC cookie signing, open-redirect blocking, server-side RBAC, 40 automated Vitest tests, real headless Chrome desktop/mobile screenshot & overflow verification, complete security & readiness documentation. | Implemented & Verified Locally (External credentials & Git installation noted as blockers) |
| **Phase 7 — Stripe Integration** | Reserved future checkout, webhooks, live invoices, and affiliate payouts. | **Not Started — Reserved & Disabled** |
