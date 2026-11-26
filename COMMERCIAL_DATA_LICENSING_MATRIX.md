# Viewora — Commercial Data Licensing & Redistribution Matrix (Stage 42)

**Date:** 2026-11-26  
**Code Enforcement:** Machine-readable rights encoded in `COMMERCIAL_RIGHTS_BY_PROVIDER` ([src/lib/integrations/router.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/router.ts)).

---

## 1. Rights & Compliance Matrix by Provider

| Provider ID | SaaS Redistribution | Customer Display | Caching Allowed | Max Retention Window | Customer Export (PDF/CSV) | AI Processing Rights | Signed Vendor Contract Required | Geographic / Legal Terms |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`meta_official`** | Yes (per Meta Platform Terms) | Yes | Yes | **24 hours** | Yes (with provenance) | Yes (user-initiated) | No (Meta Developer Terms + App Review) | Subject to Meta Platform Terms & EU/UK/BR data transfer clauses |
| **`authorized_insights`** | **No** (first-party owner workspace ONLY) | Yes (owner only) | Yes (tenant-scoped) | **24 hours** (purge immediately on OAuth revoke) | Yes (owner only) | Yes (owner only) | No (Meta Developer Terms + App Review) | First-party account owner only; deletion required on revoke/deauth webhook |
| **`licensed_third_party`** | Yes (strictly contingent on signed contract) | Yes | Yes | **720 hours (30 days)** | Yes | **No (`false` by default)** until written AI addendum signed | **YES — Mandatory** | Per signed commercial vendor agreement |
| **`permitted_public_dataset`** | Yes (per dataset license) | Yes | Yes | **720 hours (30 days)** | Yes (with attribution) | Yes | No (open license compliance) | Per open dataset attribution & redistribution terms |
| **`gemini_ai`** | Yes (generated outputs) | Yes | Yes | **24 hours** | Yes (labeled AI-Generated) | Yes | No (Google AI API Terms) | Subject to Google AI / Gemini supported regions |
| **`resend_email`** | No | No | No | **0 hours** | No | No | No | Transactional email delivery only |
| **`demo_fixture`** | No | Yes (explicitly labeled `DEMO`) | No | **0 hours** | Yes (stamped `DEMO`) | **No** | No | Internal preview & automated QA only |

---

## 2. Hard Legal & Privacy Guardrails Enforced in Code

1. **Zero Unauthorized Scraping:** Viewora contains zero HTML/GraphQL Instagram scrapers, headless login bots, cookie hijackers, or proxy rotation pools.
2. **Zero Private Account Access:** Every adapter hard-codes `supportsPrivateAccounts: false`. Private responses immediately halt `ProviderRegistry` fallback.
3. **Zero Instagram Password Collection:** No form, API route, or database column collects or stores customer Instagram passwords.
4. **AI Processing Licensing Gate:** `licensed_third_party` defaults to `aiProcessingAllowed: false` so third-party licensed payloads are never sent to Gemini AI unless the owner signs an explicit AI-processing addendum and updates policy.
5. **Retention & Deletion Compliance:** `pruneExpiredProfileSnapshots()` in [snapshots.repo.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/repositories/snapshots.repo.ts) and immediate token/cache revocation in [webhooks/meta/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/webhooks/meta/route.ts) support platform deletion SLAs.
