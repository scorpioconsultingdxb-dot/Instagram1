# Viewora — Transparent Instagram Analytics SaaS

Viewora is a freemium SaaS platform for transparent public Instagram profile analysis, free analytics tools, historical tracking, competitor benchmarking, and multi-workspace agency reporting.

## Core Principles

- **Trust-First Data Provenance**: Every data card and export explicitly distinguishes `Live Data`, `Cached Snapshot`, `Estimate`, and `Demo Data`.
- **No Private Account Access or Prohibited Scraping**: Viewora never claims access to private Instagram accounts and supports only Official Meta APIs, Authorized Connected-Account Insights, Licensed Third-Party Providers, Permitted Public Datasets, and Labeled Demo Fixtures.
- **Centralized Entitlements**: All plan quotas and premium features flow through `src/lib/entitlements/` backed by database tables.
- **Internationalized from Day One**: Built with locale-aware URLs (`en`, `pt-BR`, `es`, `de`, `fr`), typed dictionaries, `hreflang` alternates, and a localized `sitemap.xml`.
- **Stripe-Ready, Payments Disabled by Default**: Demo pricing (`$0`, `$9.99`, `$19.99`, `$39.99`, `$99.99`) with monthly/quarterly/annual discounts; live payments stay disabled until explicitly approved.

## Quick Start

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Verification Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Documentation

- Environment variables: [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md)
- Production deployment & Stripe activation guide: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- Database schema & RLS migrations: [supabase/migrations/](./supabase/migrations/)
- Seed data: [supabase/seed.sql](./supabase/seed.sql)
