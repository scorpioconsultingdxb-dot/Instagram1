# Changelog

## 0.2.0 — Master Platform Expansion (2026-11-24)
- **Design System**: Applied official Viewora palette (`#080D19`, `#131C2E`, `#7957FF`, `#A99AFF`, `#22D3EE`, `#F8FAFC`), Plus Jakarta Sans & Inter fonts, reduced-motion support, `UNAVAILABLE` provenance badge, and consent-aware `CookieConsentBanner`.
- **Homepage & Public Pages**: Rebuilt 14-section homepage (`Explore More. Discover More.`), expanded to all 12 dedicated `/[locale]/instagram-*` SEO free tool routes (added Caption Generator and Content Ideas Generator), and added all 9 public information/legal draft routes (`/about`, `/contact`, `/faq`, `/blog`, `/privacy`, `/terms`, `/cookies`, `/data-transparency`, `/responsible-use`) plus `/api/contact`.
- **Auth Security Hardening**: Strictly isolated demo auth behind `DEMO_MODE_ENABLED=false` default; added `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/onboarding`, `/auth/callback` (with open-redirect sanitization), `/api/auth/export-data`, and `/api/auth/delete-account`.
- **Pricing Reconciliation**: Aligned authoritative plan matrix (`1/1/3/10/30` saved profiles, `0/3/15/50/150` monthly AI reports, `15%` quarterly / `30%` annual discounts) and added reserved disabled checkout routes.
- **Phase 4 Operational Architecture**: Added provider resilience controller, Meta OAuth & HMAC webhook verifier, Gemini AI engine with prompt-injection sandboxing & USD budgets, durable background job queue, Resend 12-template email service, referral attribution, `/api/health`, 21-route `/admin/*` Super Admin Control Center, and migration `20261124000003_master_expansion.sql`.
- **Security & Testing**: Added CSP header, expanded automated Vitest suite to 40 passing tests across 9 suites, and verified rendered desktop & mobile layouts in headless Chrome.

## 0.1.0 — Initial Six-Phase Foundation (2026-11-24)
- Scaffolded Next.js 15 App Router, 5-locale i18n, Supabase initial schema + RLS + seed, modular Instagram data providers, 10 initial free tools, customer dashboard, and initial admin console.
