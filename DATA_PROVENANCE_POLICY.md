# Viewora — Data Provenance, Freshness & Analytical Integrity Policy (Updated Phase 5 — Stages 42–45)

**Date:** 2026-11-26  
**Governing Principle:** Every profile metric, bio signal, historical chart, competitor benchmark, AI report, and exported PDF/CSV document in Viewora MUST disclose its exact data state, provenance source, capture timestamp, and methodological boundaries. Viewora NEVER fabricates profile metrics, follower growth, or historical data, NEVER scrapes private accounts, and NEVER mislabels demo fixtures or deterministic templates as live data.

---

## 1. Six Explicit Profile Data States (`ProfileDataState` — Stage 43)

Implemented in [src/lib/analytics/profile-intelligence.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/analytics/profile-intelligence.ts) and surfaced directly in `SavedProfilesModule`:

| State | Exact Meaning | Permitted Sources |
| :--- | :--- | :--- |
| **`LIVE`** | Freshly retrieved from an official or authorized API within the current request. | `meta_official`, `authorized_insights` (fresh response) |
| **`CACHED`** | Retrieved from an official, licensed commercial, or permitted dataset provider and served within its configured TTL (`freshness.ttlSeconds`). | `ExternalApiGateway` TTL cache hits, `licensed_third_party`, `permitted_public_dataset` |
| **`ESTIMATE`** | Deterministically derived metric (e.g., engagement rate formula, posting cadence, template brief). | Viewora analytics engine, Report Studio templates |
| **`USER_PROVIDED`** | Metrics explicitly supplied by the customer via CSV workspace import. | Customer CSV import |
| **`UNAVAILABLE`** | Core public metrics (`followersCount`, `postsCount`, `estimatedEngagementRate`) are absent or live external providers are disabled/returned no data. | Missing fields or disabled providers — **never coerced to `0`** |
| **`DEMO`** | Synthetic sample fixtures (`@viewora.studio`, `@aurora.coffee`, `@nordic.design`) strictly for interface exploration and automated QA. | `demo_fixture` only when explicitly enabled by user/preview toggle |

---

## 2. Historical & Competitor Benchmarking Integrity Rules (Stages 44–45)

1. **Observed vs. Calculated Separation:** `profile_snapshots` stores strictly observed timestamped checkpoints (`recordProfileSnapshotWithDedup` with `pg_advisory_xact_lock` deduplication). Viewora **never backdates** synthetic historical checkpoints prior to when observation began.
2. **Minimum Observation Gate:** `computeObservedHistoricalTrends()` requires at least **2** observed snapshots; fewer than 2 returns `status: 'insufficient_history'` and `direction: 'unavailable'`.
3. **Compatibility-Checked Competitor Benchmarking:** `buildCompatibleCompetitorBenchmark()` detects mixed provenance classes/providers (`hasMixedSources`) and differing capture calendar dates (`hasMixedCaptureDates`), rendering an explicit **Data Compatibility Notice** banner.
4. **Null Exclusion Rule:** Group comparable averages (`comparableAvgEr`, `comparableAvgFollowers`) exclude `null`/unavailable values and require `>= 2` populated numeric profiles — missing fields are NEVER substituted with `0` or ranked misleadingly.

---

## 3. Hard Privacy & Compliance Invariants

1. **Private Accounts Strictly Refused:** `availability: 'private_account'` immediately halts provider fallback in [registry.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/providers/registry.ts).
2. **Zero Instagram Password Collection:** Every adapter hard-codes `requiresInstagramCredentials: false` and `supportsPrivateAccounts: false`.
3. **Private Research Notes Isolated:** `profile_research_notes` are protected by PostgreSQL RLS and excluded from shared PDF/CSV/Markdown exports by default.
4. **Honest Report Attribution:** Report Studio PDFs ([pdf.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/reports/pdf.ts)) and Markdown exports always stamp `Template-Generated (Not AI-Generated)` in header and footer blocks.
