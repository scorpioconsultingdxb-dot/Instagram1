# Viewora — API Provider Comparison & Commercial Licensing Matrix

**Date:** 2026-11-26  
**Policy:** Viewora NEVER uses unauthorized Instagram scraping, NEVER accesses private Instagram accounts, and NEVER collects Instagram user passwords. All external providers remain disabled until owner approval.

## 1. Provider Comparison Matrix

| Provider Adapter (`id`) | Category | Coverage & Capabilities | Data Class & Freshness | Estimated Commercial Cost | Licensing & Compliance Prerequisites | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Official Meta Instagram Graph API** (`meta_official`) | Social Data | Public Instagram **Business & Creator** accounts only (profile summary + recent public posts). Excludes personal accounts, private accounts, and third-party Stories. | `LIVE` (cached 600s default → `CACHED`) | \$0 API fee (Meta App Review & Business Verification required) | Meta Platform Terms, Developer Policies, approved `instagram_basic` & `pages_show_list` scopes, verified Meta Business Portfolio. | **Disabled (`PROVIDER_META_ENABLED=false`)** |
| **Authorized Connected-Account Insights** (`authorized_insights`) | Social Data | First-party metrics, historical insights, and account-owner Stories **strictly for Instagram Business/Creator accounts explicitly connected by the owner via Meta OAuth**. | `LIVE` (cached 300s default) | \$0 API fee | Meta App Review for `instagram_manage_insights`, explicit customer OAuth consent, encrypted token storage at rest, deauthorization/data-deletion webhook handlers. | **Disabled (`PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=false`)** |
| **Licensed Commercial Social Data Partner** (`licensed_third_party`) | Social Data | Broad public creator/brand snapshots and historical trends per commercial vendor SLA. Private accounts strictly rejected (`private_account`). | `CACHED` (1h–24h vendor SLA, 3600s local cache) | Paid (typical SaaS data licensing: per-lookup or tiered monthly SLA — requires vendor quote & owner approval) | **Mandatory signed written commercial license** explicitly permitting SaaS UI display, server-side caching, benchmarking, and PDF/CSV customer export; vendor privacy & GDPR compliance warranty. | **Disabled (`PROVIDER_LICENSED_THIRD_PARTY_ENABLED=false`)** |
| **Permitted Public Benchmark Dataset** (`permitted_public_dataset`) | Social Data | Static archived public creator metadata from explicitly permitted open/opt-in directories. No ephemeral Stories. | `CACHED` (7200s local cache) | \$0 (open/opt-in) | Dataset license attribution and opt-in provenance verification. | **Disabled (`PROVIDER_PUBLIC_DATASET_ENABLED=false`)** |
| **Google Gemini AI** (`gemini_ai`) | AI Analytics | Structured JSON narrative summaries over already-retrieved workspace metrics (`gemini-2.5-flash` default). Never invents missing metrics. | `ESTIMATE` / `CACHED` (1800s cache) | Pay-as-you-go token pricing (capped by `AI_DAILY_BUDGET_USD` & `AI_MONTHLY_BUDGET_USD`) | Google AI / Gemini API commercial terms, owner API key approval, prompt-injection isolation envelope (implemented). | **Disabled (`PROVIDER_GEMINI_ENABLED=false`)** |
| **Resend Transactional Email** (`resend_email`) | Email Delivery | Account email verification, password reset links, and opt-in weekly workspace digests. | Transactional (no cache) | Free tier / tiered volume pricing | Verified sending domain (SPF, DKIM, DMARC), bounce/complaint handling, opt-in preference enforcement. | **Disabled (`PROVIDER_RESEND_ENABLED=false`)** |
| **Viewora Internal Demo Fixtures** (`demo_fixture`) | Internal Demo | 4 synthetic public profiles + 1 synthetic private refusal profile for UI preview and automated QA. | Strictly `DEMO` (`demo_only`) | \$0 | Internal only. Hard invariant in `ProviderRegistry` prevents `demo_fixture` from ever being labeled `LIVE` or `CACHED`. | **Active (Preview/QA Only)** |

## 2. Commercial Licensing Checklist Before Activating Any Third-Party Data Partner

Before approving `PROVIDER_LICENSED_THIRD_PARTY_ENABLED=true`, the project owner should verify in writing that the vendor agreement explicitly covers:

1. **Authorized Collection Method:** Vendor warrants data is obtained lawfully without circumventing authentication or accessing private accounts.
2. **Commercial SaaS Redistribution:** Right to display normalized metrics to paying Viewora customers.
3. **Caching & Historical Snapshots:** Permitted retention duration (`TTL`) and right to store derived time-series deltas.
4. **Customer Exports:** Right for Viewora customers to export derived summaries in PDF, CSV, and Markdown reports.
5. **Rate Limits, Overage Pricing & SLA:** Predictable per-1,000-call pricing aligned with Viewora's 5 membership tiers and cost caps.
6. **Data Subject Deletion Compliance:** Mechanism to honor GDPR/CCPA takedown or opt-out notices.
