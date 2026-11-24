# Viewora — Explore More. Discover More.

A privacy-first social intelligence SaaS platform for exploring legitimately accessible public Instagram content, running 12 free analytics & planning tools, analyzing profile performance, and unlocking transparent AI-powered insights.

## Highlights

- **Trust-First Provenance**: Every result explicitly identifies `LIVE`, `CACHED`, `ESTIMATED`, `DEMO`, or `UNAVAILABLE` data. Private accounts are never accessed.
- **12 Free SEO Tools**: Public Viewer, Story Availability Checker, Profile Analyzer, Engagement Calculator, Follower Growth Checker, Bio Analyzer, Hashtag Generator, Competitor Analysis, Influencer Analyzer, Post Analyzer, Caption Generator, and Content Ideas Generator.
- **5 Initial Markets**: English (`en`), Brazilian Portuguese (`pt-BR`), Spanish (`es`), German (`de`), and French (`fr`) with `hreflang` alternates and localized `sitemap.xml`.
- **Production-Grade Modular Backend**: Supabase Auth & PostgreSQL RLS, server-controlled `DEMO_MODE_ENABLED=false`, centralized entitlement engine, Meta OAuth/Webhook verifier, Gemini AI with prompt-injection sandboxing & USD cost budgets, durable background jobs, Resend transactional emails, 21-route Super Admin Control Center, and `/api/health`.
- **Stripe Reserved (Phase 7)**: Payments remain strictly disabled (`PAYMENTS_ENABLED=false`) until separately authorized.

## Local Development

```bash
cp .env.example .env.local
npm install
npm run dev
```

To test dashboard & admin flows locally without a Supabase project, set `DEMO_MODE_ENABLED=true` in `.env.local` (never enable in production).

## Verification Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Project Documentation

- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
- [TASKS.md](./TASKS.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [TEST_REPORT.md](./TEST_REPORT.md)
- [SECURITY_REVIEW.md](./SECURITY_REVIEW.md)
- [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)
- [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
