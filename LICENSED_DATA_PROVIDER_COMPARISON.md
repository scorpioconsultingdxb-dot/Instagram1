# Viewora — Licensed Commercial Social Data Provider Comparison (Stage 66)

**Date:** 2026-11-26  
**Activation Status:** **EVALUATION ONLY — ZERO COMMERCIAL VENDORS CONTRACTED OR ACTIVATED (`PROVIDER_LICENSED_THIRD_PARTY_ENABLED=false`)**  
**Legal Principle:** Public accessibility on the web is **never** commercial redistribution permission. No third-party provider may be integrated into Viewora without a **signed written commercial SaaS redistribution, caching, export, and AI-processing license**.

---

## 1. Detailed Commercial API Comparison Matrix

| Evaluation Criterion | **Official Meta API (`meta_official` / `authorized_insights`)** *(Baseline Reference)* | **Phyllo API** *(Consent-Based First-Party Gateway)* | **Modash API** *(Public Creator Discovery & Raw API)* | **HypeAuditor API** *(Enterprise Fraud & Audience Vetting)* |
| :--- | :--- | :--- | :--- | :--- |
| **Underlying Data Method** | Official first-party Meta Graph API & Business Discovery | Official OAuth user-consent aggregator ("Plaid for creators") | Indexed public creator database (~85M+ IG profiles) | Indexed public creator database (~96M+ IG profiles) + AI audience models |
| **Public Account Coverage** | Public **Business & Creator** accounts only via Business Discovery (no personal accounts) | **Connected/consented** accounts only (not anonymous public search) | Broad public creator profiles (>1k followers typical threshold) | Broad public creator profiles (~96M+ IG) |
| **Private Account Access** | **No** (strictly prohibited) | Only if the account owner explicitly consents via OAuth | **No** | **No** |
| **Influencer Discovery & Search** | **Not supported** (lookup by exact username only) | Not designed for cold public discovery | **Strong** (filters, lookalikes, sponsorships, contact lookup) | **Strong** (45+ metrics, AQS fraud score, brand safety, CPM estimates) |
| **Engagement & Historical Analytics** | Owned insights (real) + limited public Business Discovery snapshot (no deep public history) | **Deep first-party** (Stories, Reels, exact engagement, earnings) | Historical post trends, engagement & audience estimates | Deep historical benchmarks & 12-month auto-refreshed cached reports |
| **Verified Pricing & Minimum Commitment** | **\$0 / call** `[Verified List]` (Meta App Review & rate limits apply) | Usage-based from **~\$199 / mo** `[Verified Public Floor]`; free sandbox; scales by active connections/calls | **Raw API from ~\$10,000 / yr** (~ \$833/mo); **Discovery API from ~\$16,200 / yr** (~ \$1,350/mo, ~3,000 credits/mo) `[Verified Published Anchor]` | **Custom enterprise quote** (web platform starts ~\$299/mo billed annually; API requires enterprise contract) `[Quote Required]` |
| **Est. Effective Cost per Lookup** `[Estimate]` | **\$0.00** | ~\$0.50–\$2.00 / active connected creator / mo `[Estimate]` | **~\$0.28 – \$0.45 / report credit** on Discovery base commit `[Derived Estimate]` | **~\$0.50 – \$1.50 / full audience report** `[Estimate — Confirm in Contract]` |
| **SaaS Display & Redistribution Rights** | Permitted for app display under Meta Platform Terms (strict attribution & no reselling raw data) | Built for embedded SaaS & fintech workflows (SOC 2) — verify exact redistribution addendum | Built for B2B SaaS embedding — **requires explicit SaaS redistribution & resale clause in contract** | Enterprise API license — **requires explicit customer-facing SaaS display & PDF export clause** |
| **Caching, Export & AI Processing Rights** | 24h cache ceiling on Business Discovery; no training ML models on Meta data | Governed by user consent scope & Phyllo DPA | Contract-defined caching/export/AI clauses (must verify PDF export & Gemini summarization permission in writing) | Reports cached 12 months inside HypeAuditor; customer export & AI summarization rights must be explicitly negotiated |
| **Data Deletion Obligations** | Mandatory Data Deletion Callback & immediate revocation purge | Immediate revocation webhook & user-consent purge | Honor vendor takedown/deletion sync per DPA | Honor vendor takedown/deletion sync per DPA |

---

## 2. Strategic Licensing Recommendation for Viewora

1. **Phase 1 Commercial Launch (Recommended — Zero Fixed Vendor Minimums):** Launch with **Official Meta API** (`meta_official` + `authorized_insights`, \$0/call) + **User-Provided CSV Imports** + **12 Free Deterministic Tools** + **Gemini AI Flash-Lite**. This preserves Viewora's low published prices (**\$9.99–\$99.99**) with zero \$10,000+/yr fixed vendor burn.
2. **Optional Phase 2 Expansion (Once Paid ARR Justifies Commit):**
   - If customers demand **multi-platform consented creator data** (Instagram + TikTok + YouTube Stories/Reels), **Phyllo** (from ~\$199/mo usage-based, no \$10k annual wall) is the most financially compatible first commercial partner.
   - **Modash (\$10k–\$16.2k/yr)** or **HypeAuditor (custom enterprise)** should **ONLY** be contracted after Viewora reaches sustainable paid scale (≥ ~\$3,000–\$5,000/mo MRR) OR via an optional **Agency / Pro "Deep Audience Audit Credits" add-on** so high per-credit costs never bankrupt \$9.99/\$19.99 tiers.
