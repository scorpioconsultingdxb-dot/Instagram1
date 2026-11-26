# Viewora — Profile Intelligence Engine Report (Stage 43)

**Date:** 2026-11-26  
**Core Engine:** [src/lib/analytics/profile-intelligence.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/analytics/profile-intelligence.ts)  
**API & UI Surfaces:** [src/app/api/dashboard/workspace/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/dashboard/workspace/route.ts) (`refresh_profile`), [src/components/dashboard/SavedProfilesModule.tsx](file:///c:/Users/Scorpio/Videos/Instagram/src/components/dashboard/SavedProfilesModule.tsx)

---

## 1. Architecture & Capabilities

The Stage 43 Profile Intelligence Engine provides deterministic, transparent profile diagnostics without ever inventing missing metrics:

1. **Six Explicit Data States (`ProfileDataState`):**
   - `live` — Fresh official/authorized response
   - `cached` — Served within configured TTL cache window
   - `estimate` — Derived analytical estimate
   - `user_provided` — Imported via customer CSV workspace
   - `unavailable` — Core public metrics (`followersCount`, `postsCount`, `estimatedEngagementRate`) are absent/null
   - `demo` — Explicitly labeled preview fixture (`DEMO`)
2. **Data Completeness Scoring (`completenessScore`):**
   - Computes exact `%` of populated core public fields (`populatedFields / totalFields`) and enumerates every absent field in `missingFields[]`.
   - Zero-values (`0`) are preserved distinctly from `null` (unavailable).
3. **Public Bio Signal Analysis (`analyzePublicBio`):**
   - Extracts character count, word count, `#hashtags`, `@mentions`, external URL presence, and explicit call-to-action signals (`shop`, `book`, `link`, `dm`, `email`, `subscribe`, `download`, `join`, `contact`, `learn more`, `order`, `free`).
4. **Content Format Mix, Top Hashtags & Cadence Consistency:**
   - Computes `%` distribution across `Reels`, `Carousels`, and `Images` strictly from available public sample posts.
   - Ranks top observed hashtags by frequency and computes publishing consistency score (`0–100`) from inter-post interval variance when `>= 2` timestamped posts exist.
5. **Freshness Age & Explicit Limitation Disclosures:**
   - Formats relative capture age (`Captured just now`, `Captured 4h ago`, etc.) and surfaces clear limitation disclosures whenever data is demo, user-provided, or missing fields.

---

## 2. Manual Profile Refresh (`POST /api/dashboard/workspace` — `refresh_profile`)

- Authenticated customers can click **Refresh** on any saved profile card in `SavedProfilesModule`.
- Server evaluates `evaluateProviderRouting({ requiredCapability: 'publicProfiles', planCode: user.planCode, allowDemoFallback: false })`.
- **When Live Providers Are Disabled (Current Default):** Returns HTTP `200` with `{ ok: true, refreshed: false, status: 'live_providers_disabled' }` and preserves existing saved metadata without fabricating fresh numbers.
- **When Live Providers Are Enabled (Owner-Approved):** Fetches fresh data via `ProviderRegistry.lookupPublicProfile(..., { allowDemoFallback: false })`, updates the saved profile in PostgreSQL, and records a deduplicated observed snapshot in `profile_snapshots`.

---

## 3. Verification Results

- **Unit Tests ([phase5-stages-42-to-45.test.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integration/phase5-stages-42-to-45.test.ts)):** Verified completeness %, bio CTA/hashtag/mention detection, 50/50 format mix, top hashtags, `demo` vs `unavailable` state resolution, and explicit missing-field disclosures.
- **Live PostgreSQL Browser E2E (`test:e2e:pg` on `viewora_test`):**
  - Verified `refresh_profile` returns `HTTP 200` with `status: 'live_providers_disabled'`.
  - Verified expanded **Intelligence** panel renders cleanly inside `SavedProfilesModule` at `1440px` (`phase5_profile_intel_1440px.png`: `100%` completeness, `Captured just now · State: DEMO`, Public Bio Signal Analysis `126 chars · 16 words · Includes CTA/link signal`, `Reels 33.3% / Carousels 33.3% / Images 33.4%`).
