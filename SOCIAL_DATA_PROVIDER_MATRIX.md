# Viewora — Social Data Provider Matrix (Stage 42)

**Date:** 2026-11-26  
**Governing Rule:** Every external data provider in Viewora is registered in [catalog.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/catalog.ts), evaluated deterministically by [router.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/router.ts), and **disabled by default** (`PROVIDER_*_ENABLED=false`).

---

## 1. Registered Provider Adapters (7 Total)

| Provider ID | Category | Default Flag (`false`) | Capabilities | Private Accounts | IG Passwords | Allowed Outbound Host(s) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `authorized_insights` | First-party OAuth | `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED` | `publicProfiles`, `recentPublicPosts`, `authorizedOwnStories`, `historicalSnapshots` | **Blocked** | **Never** | `graph.facebook.com`, `graph.instagram.com` |
| `meta_official` | Official Platform API | `PROVIDER_META_ENABLED` | `publicProfiles`, `recentPublicPosts` | **Blocked** | **Never** | `graph.facebook.com` |
| `licensed_third_party` | Commercial Licensed Vendor | `PROVIDER_LICENSED_THIRD_PARTY_ENABLED` | `publicProfiles`, `recentPublicPosts`, `historicalSnapshots` | **Blocked** | **Never** | Exact configured HTTPS origin (`LICENSED_SOCIAL_PROVIDER_BASE_URL`) |
| `permitted_public_dataset` | Open / Permitted Dataset | `PROVIDER_PUBLIC_DATASET_ENABLED` | `publicProfiles` | **Blocked** | **Never** | Local/approved permitted dataset endpoint |
| `gemini_ai` | AI Summary Engine | `PROVIDER_GEMINI_ENABLED` | `aiSummaries` | **N/A** | **Never** | `generativelanguage.googleapis.com` |
| `resend_email` | Transactional Email | `PROVIDER_RESEND_ENABLED` | `emailDelivery` | **N/A** | **Never** | `api.resend.com` |
| `demo_fixture` | Explicit Sample Preview | `DEMO_MODE_ENABLED` (`false` in prod) | `publicProfiles`, `recentPublicPosts` (labeled `DEMO`) | **Blocked** | **Never** | None (in-process static fixtures) |

---

## 2. Deterministic Capability Routing Priority (`evaluateProviderRouting`)

When Viewora resolves a request for a capability (e.g., `publicProfiles`), `evaluateProviderRouting()` evaluates every registered adapter in strict priority order:

1. `authorized_insights` (priority `1`) — Only if the customer holds an active, non-expired first-party OAuth token for the target account.
2. `meta_official` (priority `2`) — Official Meta Business Discovery for public Business/Creator accounts.
3. `licensed_third_party` (priority `3`) — Only if explicitly enabled, vendor contract rights match requested operation (`requireExportRights`, `requireAiProcessingRights`), and budget permits.
4. `permitted_public_dataset` (priority `4`) — Open/permitted public datasets when enabled.
5. `demo_fixture` (priority `99`) — **Only** when `allowDemoFallback: true` is explicitly passed; strictly excluded on manual live refreshes (`refresh_profile`) and production live lookups.

Every candidate fails closed if:
- Capability is unsupported;
- Explicit `PROVIDER_*_ENABLED` flag is `false` or server credentials are missing/placeholder;
- Persistent PostgreSQL kill switch is active (`cost_budgets.kill_switch_active = true`);
- Circuit breaker state is `open`;
- Commercial rights disallow requested export or AI processing;
- Customer membership quota or daily/monthly USD budget ceiling is exhausted.

---

## 3. Tenant-Scoped Cache Isolation (`buildTenantScopedCacheKey`)

- Public business discovery responses use `scope:public` keys (`<providerId>:public:<operation>:<subject>`).
- Authorized owner insights ALWAYS include `userId` and/or `workspaceId` (`<providerId>:authorized_owner:u:<userId>:w:<workspaceId>:<operation>:<subject>`), preventing cross-customer cache bleed even when two workspaces inspect the same handle.
