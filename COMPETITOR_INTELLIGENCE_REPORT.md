# Viewora — Competitor Intelligence Studio Report (Stage 45)

**Date:** 2026-11-26  
**Core Engine:** [src/lib/analytics/competitor-benchmark.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/analytics/competitor-benchmark.ts)  
**UI Component:** [src/components/dashboard/CompetitorStudio.tsx](file:///c:/Users/Scorpio/Videos/Instagram/src/components/dashboard/CompetitorStudio.tsx)

---

## 1. Compatibility-Checked Benchmarking Design

Traditional social tools silently mix incomparable datasets (e.g., averaging a `DEMO` handle with a `LIVE` handle, or coercing missing `null` engagement rates into `0%` and skewing group rankings). Viewora Stage 45 eliminates these distortions through strict methodological enforcement:

1. **Null-Safe Comparable Averages:**
   - `comparableAvgEr` and `comparableAvgFollowers` are computed **exclusively** across profiles with finite numeric values (`v !== null && Number.isFinite(v)`).
   - If fewer than 2 profiles share a populated numeric metric, the comparable average returns `null` (`N/A`) rather than producing a misleading single-profile benchmark.
   - Missing metrics render explicitly as **`Unavailable`** (or **`Insufficient history`** for growth deltas) in both the UI table and exported CSV — NEVER coerced to `0`.
2. **Mixed-Source & Capture-Date Compatibility Warnings:**
   - Automatically detects when compared profiles originate from differing provenance classes (`live`, `cached`, `estimate`, `demo`) or differing providers (`hasMixedSources`).
   - Automatically detects when compared profiles were captured on different calendar dates (`hasMixedCaptureDates`).
   - Surfaces a high-visibility amber **Data Compatibility Notice** banner listing every detected discrepancy directly above the comparison table.
3. **Interactive Commercial Workflow Controls:**
   - **Time Window Filter:** `30D`, `90D`, `ALL` window toggles controlling observed growth slices.
   - **Customizable Columns:** Interactive visibility pills for `Followers`, `Est. ER`, `Delta vs Avg`, `Posts / wk`, `Observed Growth`, and `Completeness`.
   - **Persistent Comparison Projects:** Create, edit, switch, and delete saved multi-profile projects persisted in PostgreSQL `comparison_projects` (RLS-isolated).
   - **1-Click Report Integration:** **Generate Competitor Report** posts directly to `/api/reports/builder` (`reportType: 'competitor_analysis'`) carrying the methodology note and date window so customers can export PDF/CSV/Markdown immediately.
   - **Formula-Safe Matrix CSV Export:** Exports all benchmark columns plus provenance, provider, capture timestamp, and export timestamp with `sanitizeCsvFormulaCell` protection against CSV formula injection.

---

## 2. Verification Results

- **Unit Tests ([phase5-stages-42-to-45.test.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integration/phase5-stages-42-to-45.test.ts)):**
  - Verified mixed `live` + `demo` + `estimate` profiles trigger `hasMixedSources: true` and `hasMixedCaptureDates: true` with `>= 2` explicit warnings.
  - Verified a profile with `null` engagement rate is excluded from `comparableAvgEr` (`(6.0 + 4.0) / 2 = 5.0`, NOT divided by `3`) and retains `deltaErVsComparableAvg: null`.
- **Live PostgreSQL Browser E2E (`test:e2e:pg` on `viewora_test`):**
  - Verified Agency-tier account saves `@viewora.studio` and `@aurora.coffee` and renders the full comparison matrix (`phase5_competitor_studio_1440px.png`: `Delta vs Avg (4.65%)`, `+0.47 pts` vs `-0.47 pts`, `100%` completeness, `30D/90D/ALL`, column pills, `Generate Competitor Report`, `Export Matrix CSV`, and transparent Methodology footer).
  - Verified Free-tier accounts are server- and UI-gated behind `UpgradePreviewCard`.
