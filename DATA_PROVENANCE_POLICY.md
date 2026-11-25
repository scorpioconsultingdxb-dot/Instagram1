# Viewora — Data Provenance & Freshness Policy

**Date:** 2026-11-26  
**Governing Principle:** Every metric, profile card, chart, AI summary, and exported PDF/CSV document in Viewora MUST disclose its exact source class, retrieval timestamp, and methodological boundaries. Viewora never fabricates social intelligence, never scrapes private accounts, and never mislabels demo fixtures or template outputs as live data.

## 1. Authoritative Data Classifications (`DataClass`)

| Badge / Class | Exact Definition | Permitted Sources | Prohibited Uses |
| :--- | :--- | :--- | :--- |
| **`LIVE`** | Freshly retrieved from an official first-party or authorized API within the current request (not served from TTL cache). | `meta_official` (fresh response), `authorized_insights` (account-owner OAuth). | NEVER applied to `demo_fixture`, CSV imports, or template fallbacks. |
| **`CACHED`** | Previously retrieved from an official API, licensed commercial partner, or permitted public dataset and served within its configured server-side TTL (`freshness.ttlSeconds`). | `ExternalApiGateway` TTL cache hits (`fromCache: true`), `licensed_third_party`, `permitted_public_dataset`. | Must always carry original `fetchedAt` ISO timestamp and `isStale` boolean. |
| **`ESTIMATE`** | Deterministically calculated derived metrics (e.g., engagement rate formula, posting cadence, template-generated analytical commentary) or user-provided CSV workspace datasets. | Viewora analytics engine, `Template-Generated` Report Studio briefs, User-Provided CSV imports. | Must never be labeled `LIVE` or `AI-Generated` when generated deterministically. |
| **`DEMO`** | Synthetic sample data strictly for interface exploration and automated QA. | `demo_fixture` (`@viewora.studio`, `@aurora.coffee`, etc.) when explicitly enabled by user or preview toggle. | Hard invariant in [registry.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/providers/registry.ts) forces `dataClass = 'demo'` & `confidence = 'demo_only'`. Never inserted automatically into new customer accounts. |

## 2. Freshness Metadata Contract (`DataFreshness`)

Every `ProviderResponse<T>` returns:
- `fetchedAt`: ISO-8601 UTC timestamp when upstream data was actually fetched (preserved across cache hits).
- `ttlSeconds`: Configured cache expiration window (e.g., `600s` Meta Business Discovery, `3600s` licensed partner, `0s` uncached).
- `isStale`: Boolean indicating whether data has exceeded its freshness window or originated from an unavailable/fallback path.
- `limitations[]` & `notice`: Plain-language disclosures rendered directly in UI provenance badges and exported PDF/Markdown reports.

## 3. Hard Privacy & Compliance Invariants

1. **Private Accounts Strictly Refused:** When any provider reports `availability: 'private_account'`, `ProviderRegistry` halts immediately without falling back to any secondary provider.
2. **Zero Credential Collection:** Every registered adapter in [catalog.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/catalog.ts) enforces `requiresInstagramCredentials: false` and `supportsPrivateAccounts: false`.
3. **Private Customer Notes Excluded From Shared Exports:** Customer `profile_research_notes` are isolated by PostgreSQL RLS (`profile_notes_owner_only`) and excluded from Report Studio PDF, CSV, and Markdown exports by default.
4. **Honest Report Attribution:** Report Studio PDFs ([pdf.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/reports/pdf.ts)) and Markdown exports always stamp `Template-Generated (Not AI-Generated)` in header and footer blocks.
