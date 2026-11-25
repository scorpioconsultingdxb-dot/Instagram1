# Viewora — External API Integration Architecture (Stage 41)

**Date:** 2026-11-26  
**Status:** Implemented & Verified — **All External Paid/Live Providers Strictly Disabled by Default**

## 1. Architectural Overview

Viewora routes all external API interactions through a centralized, modular integration layer under [src/lib/integrations/](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/index.ts), sitting cleanly beneath domain adapters ([src/lib/providers/](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/providers/registry.ts), [src/lib/ai/gemini.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/ai/gemini.ts)) and surfaced via the RBAC-protected Super Admin Integration Center ([/api/admin/integrations](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/admin/integrations/route.ts) & [AdminConsole.tsx](file:///c:/Users/Scorpio/Videos/Instagram/src/components/admin/AdminConsole.tsx)).

```
Customer / API Request (/api/search, /api/ai/report, /api/stories)
   │
   ├── 1. Input Validation & Customer Membership Quota Check (daily_searches / ai_profile_reports)
   ├── 2. ProviderRegistry Priority Orchestration (stops immediately on private_account)
   └── 3. ExternalApiGateway (src/lib/integrations/gateway.ts)
          ├── Gate A: Explicit Provider Feature Flag (PROVIDER_*_ENABLED === 'true')
          ├── Gate B: Server-Side Credential Presence + Placeholder Rejection
          ├── Gate C: Global & Per-Provider Kill Switches + Daily/Monthly USD Cost Caps
          ├── Gate D: Server-Side TTL Cache + In-Flight Request Deduplication
          ├── Gate E: Circuit Breaker (closed -> open -> half_open)
          ├── Gate F: Per-Provider Sliding-Window Rate Limiter (req/min)
          ├── Gate G: AbortController Timeout + Bounded Exponential Backoff Retries (408/429/5xx only)
          ├── Gate H: Strict Zod Upstream Response Validation & Normalization
          └── Gate I: Secret/PII-Redacted Telemetry & Usage Accounting
```

## 2. Core Modules

| Module | File | Responsibility |
| :--- | :--- | :--- |
| Typed Contracts | [types.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/types.ts) | `IntegrationProviderId`, `ProviderCapabilities` (hard-typed `supportsPrivateAccounts: false`, `requiresInstagramCredentials: false`), `ProviderPolicyConfig`, `ProviderIntegrationStatus`, `SanitizedApiLogEntry`, `IntegrationCenterSnapshot`. |
| Capability & Policy Catalog | [catalog.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/catalog.ts) | Declarative registry of all 7 adapters (`meta_official`, `authorized_insights`, `licensed_third_party`, `permitted_public_dataset`, `gemini_ai`, `resend_email`, `demo_fixture`), required env vars, default resilience policies, commercial models, and compliance rules. |
| Server Credential & Flag Guard | [credentials.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/credentials.ts) | `checkProviderCredentials()`, `isProviderEffectivelyEnabled()` (requires BOTH `PROVIDER_*_ENABLED=true` AND non-placeholder secrets), and `redactSecretsAndPii()`. |
| Execution Gateway | [gateway.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/gateway.ts) | `ExternalApiGateway` enforcing flags, kill switches, USD caps, TTL cache, deduplication, rate limits, circuit breakers, timeouts, bounded retries, Zod validation, and redacted ring-buffer logs. |
| Domain Adapters | [meta-official.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/providers/meta-official.ts), [licensed-third-party.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/providers/licensed-third-party.ts), [authorized-insights.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/providers/authorized-insights.ts), [permitted-public-dataset.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/providers/permitted-public-dataset.ts), [gemini.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/ai/gemini.ts) | Domain-specific HTTP mapping, normalization into `PublicProfileData` / `AiReportOutput`, and explicit unavailable/disabled state handling. |
| Super Admin Integration Center | [integrations/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/admin/integrations/route.ts), [AdminConsole.tsx](file:///c:/Users/Scorpio/Videos/Instagram/src/components/admin/AdminConsole.tsx) | Read-only operational dashboard showing non-secret readiness, circuit state, policies, spend vs. caps, and redacted logs. |

## 3. Graceful Disabled & Unavailable States

- When a provider flag is `false` or credentials are missing, `ExternalApiGateway` short-circuits with `outcome: 'disabled'` and performs **zero outbound network requests**.
- When an upstream call fails, times out, hits a rate limit, or trips its circuit breaker, adapters return structured `availability: 'unavailable'` responses with explicit `limitations` and `notice` metadata — never fabricating metrics or mislabeling demo data as live.
- Customer search endpoints enforce authenticated daily membership quotas (`daily_searches`) server-side in [search/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/search/route.ts), returning `HTTP 429` (`DAILY_SEARCH_LIMIT_REACHED`) when a plan limit is reached.
