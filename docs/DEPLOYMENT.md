# Viewora Production Deployment Guide

> **Safety Gate:** Do not push to GitHub, deploy to production, or enable live payments without explicit authorization.

## 1. Prerequisites

- Node.js 20+ (tested on Node.js 24.x)
- Supabase project (Postgres 15+ with Auth enabled)
- Hosting platform supporting Next.js App Router (Vercel, Cloudflare/Node container, or Docker)
- Authorized Instagram data provider credentials (Official Meta Graph API and/or Licensed Provider)

## 2. Supabase Database Setup

1. Create a new Supabase project.
2. Apply migrations in order:
   - `supabase/migrations/20261124000001_initial_schema.sql`
   - `supabase/migrations/20261124000002_rls_policies.sql`
3. Run the idempotent seed script to populate the 5 pricing plans, billing discounts, entitlements, feature flags, and localized CMS disclosures:
   - `supabase/seed.sql`
4. Verify Row-Level Security (RLS) is enabled on all 23 tables in the `public` schema.
5. Promote your initial administrator account securely via SQL (never via client APIs):
   ```sql
   update public.profiles set role = 'super_admin' where email = 'admin@yourdomain.com';
   ```

## 3. Environment Variables

Configure all required environment variables documented in `docs/ENVIRONMENT.md`:

- Set `NEXT_PUBLIC_APP_URL` to your canonical HTTPS production origin (required for `hreflang` and `sitemap.xml`).
- Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Keep `PAYMENTS_ENABLED=false` and `NEXT_PUBLIC_PAYMENTS_ENABLED=false` until payment launch is explicitly approved.
- Configure authorized data providers (`META_GRAPH_API_ACCESS_TOKEN`, `META_INSTAGRAM_BUSINESS_ACCOUNT_ID`, or `LICENSED_PROVIDER_*`).
- Decide whether `VIEWORA_ENABLE_DEMO_PROVIDER` should remain `true` (clearly labeled sample profiles) or `false` in production.

## 4. Build & Verification Checklist

Before deploying any release, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Verify:
- Desktop & mobile responsive layouts in both Light and Dark themes.
- All 5 locales (`/en`, `/pt-BR`, `/es`, `/de`, `/fr`), canonical URLs, `hreflang` tags, and `/sitemap.xml`.
- Protected `/dashboard` redirects unauthenticated users; `/admin` returns `403`/redirect for non-admin users.
- Stripe checkout & webhook routes remain disabled while `PAYMENTS_ENABLED=false`.

## 5. Activating Stripe Payments (When Explicitly Approved)

1. Create matching Products and recurring Prices (Monthly, Quarterly, Annual) in Stripe.
2. Update `plans.stripe_product_id` and `plan_billing_options.stripe_price_id` via the Admin Dashboard or SQL.
3. Configure the Stripe webhook endpoint pointing to `https://yourdomain.com/api/webhooks/stripe`.
4. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
5. Unlock and enable `payments_enabled` in `feature_flags`, and set `PAYMENTS_ENABLED=true` and `NEXT_PUBLIC_PAYMENTS_ENABLED=true`.
6. Complete an end-to-end test in Stripe Test Mode before switching to Live Mode.
