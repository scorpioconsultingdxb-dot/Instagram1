# Viewora Environment Variables Guide

Copy `.env.example` to `.env.local` for local development. Never commit `.env.local` or production secrets to Git.

## Core Application

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | `http://localhost:3000` | Public canonical origin used for `hreflang`, canonical URLs, and sitemaps. |
| `NEXT_PUBLIC_APP_NAME` | No | `Viewora` | Brand display name. |

## Supabase (Database & Authentication)

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | Supabase public anon key (safe for browser, protected by RLS). |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Server-only service role key used exclusively in server-side admin/webhook operations. |

## Payments & Stripe (Disabled by Default)

> **Important:** Payments remain disabled until explicitly authorized. Both `PAYMENTS_ENABLED` and `NEXT_PUBLIC_PAYMENTS_ENABLED` must be set to `true` before checkout endpoints activate.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PAYMENTS_ENABLED` | No | `false` | Server-side master switch for payment processing. |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | No | `false` | Client-side indicator for payment UI state. |
| `STRIPE_SECRET_KEY` | Only when enabled | `""` | Stripe secret API key (server-only). |
| `STRIPE_WEBHOOK_SECRET` | Only when enabled | `""` | Stripe webhook signing secret. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Only when enabled | `""` | Stripe publishable key. |

## Modular Instagram Data Providers

Viewora never performs prohibited scraping or private-account bypasses. Configure one or more authorized data sources below:

| Variable | Provider | Description |
| --- | --- | --- |
| `VIEWORA_ENABLE_DEMO_PROVIDER` | Demo Fixtures | Defaults to `true`. Serves clearly labeled `Demo Data` sample profiles for development and preview. |
| `META_GRAPH_API_ACCESS_TOKEN` | Official Meta Graph API | Official Business Discovery access token. |
| `META_INSTAGRAM_BUSINESS_ACCOUNT_ID` | Official Meta Graph API | Authorized IG Business Account ID used for Business Discovery queries. |
| `META_GRAPH_API_VERSION` | Official Meta Graph API | Defaults to `v22.0`. |
| `META_OAUTH_APP_ID` / `META_OAUTH_APP_SECRET` | Connected-Account Insights | Meta OAuth app credentials for first-party account-owner insights. |
| `LICENSED_PROVIDER_NAME` / `LICENSED_PROVIDER_API_URL` / `LICENSED_PROVIDER_API_KEY` | Licensed Third-Party | Optional pluggable licensed commercial data partner. |
| `PUBLIC_DATASET_ENDPOINT_URL` | Permitted Public Datasets | Optional permitted public benchmark dataset endpoint. |

## AI Insights (Optional)

| Variable | Required | Description |
| --- | --- | --- |
| `AI_PROVIDER_API_KEY` | No | Optional LLM API key. When omitted, Viewora renders clearly labeled structured template insights. |
| `AI_PROVIDER_MODEL` | No | Optional model identifier for the configured AI provider. |
