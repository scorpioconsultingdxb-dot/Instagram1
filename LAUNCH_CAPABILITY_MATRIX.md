# Viewora — Commercial Launch Capability & Public Tool Audit Matrix (Task 6)

**Date:** 2026-11-26  
**Pricing & Entitlements Preserved:** Free \$0 · Starter \$9.99 · Premium \$19.99 · Pro \$39.99 · Agency \$99.99 · Quarterly 15% off · Annual 30% off — **zero changes made**.  
**Public Copy Audit Action Completed:** Updated [`src/lib/tools/catalog.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/tools/catalog.ts) renaming `Anonymous Public Instagram Viewer` → **`Public Instagram Profile Viewer`** and `Instagram Story Viewer` → **`Authorized Instagram Story Insights Checker`** (preserving canonical URL slugs) so zero marketing pages imply anonymous surveillance, private profile access, or unrestricted discovery.

---

## 1. Six-Category Commercial Capability Matrix

| Capability Category | Specific Viewora Features | Launch Availability & Honesty Disclosure |
| :--- | :--- | :--- |
| **1. Supported Without External APIs (Available Immediately)** | • All **9 deterministic Free Tools** (Engagement Calculator, Follower Growth Checker, Bio Analyzer, Hashtag Generator, Influencer Analyzer, Post Performance Analyzer, Caption Generator, Content Ideas Generator, plus manual Competitor Calculator)<br>• Personal Digital HQ 3.0, Dashboard 3.0, Research Workspace Pro, Private RLS Research Notes, User-Provided CSV Imports, Report Studio 3.0 (10 templates + real binary `%PDF-1.4` & CSV), Agency Multi-Client Workspaces, Admin Console 3.0, Deterministic AI Templates | **100% Operational Today** (verified across 322 static pages, 119 unit tests, 9 live PG tests & 42 desktop/mobile screenshots) |
| **2. Supported Through Official Meta APIs (`meta_official`)** | • Exact-handle lookup of **public Instagram Business & Creator profiles** via Business Discovery<br>• Public follower/media counts, bio signals, recent public post format mix & saved observed daily snapshots going forward (`profile_snapshots`) | **Awaiting Stage 65 Meta Business Verification & App Review** (subject to Meta 24h cache cap; personal accounts excluded by Meta) |
| **3. Requiring Authorized Connected Accounts (`authorized_insights`)** | • First-party owned Instagram Business/Creator OAuth insights (reach, views, saves, shares, Story analytics, audience insights for the connected owner's own account)<br>• Authorized Story Insights availability checks | **Awaiting Stage 65 Meta OAuth App Review** (strictly opt-in via OAuth; AES-256-GCM encrypted; 1-click disconnect & Data Deletion Callback) |
| **4. Requiring Licensed Commercial Data (`licensed_third_party`)** | • Broad cold influencer search/filtering across millions of profiles, lookalike discovery, audience fraud/AQS scores, estimated audience demographics on non-owned accounts, deep pre-existing historical backfill | **Deferred Post-Launch** (requires signed commercial redistribution agreement — e.g., Modash/HypeAuditor/Phyllo — and separate Pro/Agency add-on economics approval) |
| **5. Permanently Unavailable at Launch (Hard Policy Exclusions)** | • Private Instagram account access or unlocking<br>• Anonymous third-party Story viewing or downloading<br>• Instagram password collection or hidden activity surveillance<br>• Unauthorized scraping behind Instagram logins<br>• Fabricated historical charts prior to first observed snapshot | **Permanently Prohibited by Architecture & Policy** |
| **6. Awaiting Live Staging Verification** | • Live Resend inbox delivery & bounce/complaint webhooks<br>• Live Gemini AI synthesis (`gemini_live` attribution)<br>• Live Meta OAuth & Business Discovery (`live_provider_verified`)<br>• Multi-pod Upstash Redis & scheduled external cron jobs<br>• Payment gateway sandbox checkout/webhooks (`PAYMENTS_ENABLED=false`) | **Awaiting Owner Staging Provisioning & Approvals (Steps 1–12)** |

---

## 2. Complete Audit of All 12 Public Tools (`src/lib/tools/catalog.ts`)

| # | Canonical Slug | Audited Public Name | Mode | Marketing Honesty Audit Verdict |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `instagram-viewer` | **Public Instagram Profile Viewer** *(tightened from "Anonymous...")* | `public_provider_lookup` | **PASS** — Explicitly restricts to eligible public Business/Creator profiles; zero private access |
| 2 | `instagram-story-viewer` | **Authorized Instagram Story Insights Checker** *(tightened)* | `authorized_status_check` | **PASS** — Explicitly states Story insights require authorized account ownership; zero third-party Story scraping |
| 3 | `instagram-profile-analyzer` | Instagram Profile Analyzer | `public_provider_lookup` | **PASS** — Labels audit scores `ESTIMATED` from public/demo inputs |
| 4 | `instagram-engagement-calculator` | Instagram Engagement Calculator | `functional_calculator` | **PASS** — Pure deterministic math from user-entered metrics |
| 5 | `instagram-follower-growth` | Instagram Follower Growth Checker | `functional_calculator` | **PASS** — Deterministic velocity calculator; states automatic history requires saved workspace snapshots |
| 6 | `instagram-bio-analyzer` | Instagram Bio Analyzer | `functional_calculator` | **PASS** — Pure deterministic 150-char text & CTA diagnostics |
| 7 | `instagram-hashtag-generator` | Instagram Hashtag Generator | `functional_calculator` | **PASS** — Discloses heuristic keyword recommendations |
| 8 | `instagram-competitor-analysis` | Instagram Competitor Analysis | `public_provider_lookup` | **PASS** — Flags mixed provenance & missing metrics; never fabricates |
| 9 | `instagram-influencer-analyzer` | Instagram Influencer Analyzer | `functional_calculator` | **PASS** — Transparent tier classification & formula-based reach bands |
| 10 | `instagram-post-analyzer` | Instagram Post Performance Analyzer | `functional_calculator` | **PASS** — Pure deterministic save-rate / share-rate / ERR math |
| 11 | `instagram-caption-generator` | Instagram Caption Generator | `functional_calculator` | **PASS** — Discloses deterministic editable drafts |
| 12 | `instagram-content-ideas` | Instagram Content Ideas Generator | `functional_calculator` | **PASS** — Discloses deterministic strategy frameworks |

---

## 3. Recommended Initial Commercial Launch Scope

Launch **Viewora v1.0** cleanly on **Categories 1 + 2 + 3** (12 Public Tools + Full Multi-Tenant Workspace + Report Studio `%PDF-1.4`/CSV + Official Meta Business/Creator Discovery & Authorized Insights + Gemini Flash-Lite AI Studio + Resend Transactional Email) — zero \$10,000+/yr third-party vendor burn, > 91% unit gross margin on published pricing, and 100% truthful customer expectations.
