# Viewora — API Cost Control & Usage Governance Report

**Date:** 2026-11-26  
**Current Paid External Spend:** **\$0.00** (all paid/external providers disabled by default)

## 1. Multi-Layer Cost Protection Architecture

Viewora protects against runaway API bills through 5 stacked enforcement layers before any paid external request can execute:

| Layer | Control | Configuration / Enforcement Point |
| :--- | :--- | :--- |
| **1. Default-Off Feature Flags** | Every external provider defaults to `false` (`PROVIDER_META_ENABLED`, `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED`, `PROVIDER_LICENSED_THIRD_PARTY_ENABLED`, `PROVIDER_PUBLIC_DATASET_ENABLED`, `PROVIDER_GEMINI_ENABLED`, `PROVIDER_RESEND_ENABLED`). | [env.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/env.ts), [credentials.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/credentials.ts) |
| **2. Server-Side TTL Caching & Deduplication** | Identical lookups within `PROVIDER_CACHE_TTL_SECONDS` (default `900s`; `3600s` for licensed partners; `1800s` for Gemini) return cached results at **\$0 incremental cost**; concurrent duplicate requests coalesce via in-flight deduplication. | [gateway.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/gateway.ts) |
| **3. Per-Provider Rate Limits & Circuit Breakers** | Sliding-window per-provider caps (`maxRequestsPerMinute`, e.g., `20–30 req/min`) and circuit breakers (`3` failures → `60s` cooldown) stop retry storms against failing endpoints. | [gateway.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/gateway.ts) |
| **4. Customer Membership Quotas** | Authenticated searches enforce plan `daily_searches` entitlement limits (`HTTP 429 DAILY_SEARCH_LIMIT_REACHED`) in [search/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/search/route.ts); AI reports enforce `ai_profile_reports` monthly quotas and fallback cleanly to \$0 deterministic templates for demo profiles. | [search/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/search/route.ts), [gemini.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/ai/gemini.ts) |
| **5. Hard Daily/Monthly USD Ceilings & Kill Switches** | `API_DAILY_COST_CAP_USD` (default `\$15`), `API_MONTHLY_COST_CAP_USD` (default `\$200`), `AI_DAILY_BUDGET_USD` (`\$10`), `AI_MONTHLY_BUDGET_USD` (`\$150`), plus `setGlobalKillSwitch()` and `setProviderKillSwitch()` immediately block spend with `outcome: 'budget_exceeded'` or `'disabled'`. | [gateway.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/gateway.ts), [gemini.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/ai/gemini.ts) |

## 2. Observability & Persistence Notes

- **Super Admin Visibility:** The Integration Center displays real-time Daily Spend / Cap, Monthly Spend / Cap, Global Kill Switch status, per-provider call count, cache hit count, error count, and estimated spend.
- **Multi-Instance Hosted Scaling Note (Phase 5):** In-memory sliding windows, caches, and daily search counters work accurately in single-process deployments. Before scaling horizontally across multiple stateless Next.js containers in Phase 5 production, wire the existing `UPSTASH_REDIS_REST_URL` / PostgreSQL `cost_budgets` & `search_events` tables as shared backing stores so caps remain globally synchronized across pods.
