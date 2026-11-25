# Viewora — Deterministic Analytics & Intelligence Formulas (Stage 24)

All calculations in `src/lib/analytics/engine.ts` are **100% deterministic**, pure TypeScript functions executed over real recorded public, cached, user-provided, or explicitly labeled demo datasets. Missing data (`null` / `undefined`) is strictly distinguished from true numeric zero (`0`).

## Authoritative Formula Reference

| Metric | Formula | Missing vs. Zero Rules |
| --- | --- | --- |
| **Engagement Rate by Followers (ERF)** | `((Likes + Comments) / Followers) × 100` | Returns `null` if followers are missing or `≤ 0`, or interactions `< 0`. Returns `0` when interactions `= 0` and followers `> 0`. |
| **Engagement Rate by Reach (ERR)** | `((Likes + Comments) / Reach) × 100` | Returns `null` when reach is unavailable or `≤ 0` (renders as `Unavailable` in UI). |
| **Period Growth Rate** | `Delta = Current − Previous`; `% = ((Current − Previous) / |Previous|) × 100` | If `Previous = 0`, returns exact `Delta` and `percentChange: null` (avoids division by zero). |
| **Simple Moving Average (SMA)** | `(x[i−k+1] + ... + x[i]) / k` | Leading indices `< k − 1` and windows containing missing points return `null`. |
| **Statistical Summary** | `min`, `max`, `mean`, `median`, population `stdDev` (`σ`) | Reports `count`, `validCount`, and `missingCount` explicitly. |
| **Content Format Distribution** | Percentage share of `reel`, `carousel`, `image` across sampled posts | Derived solely from recorded `recentPosts`; returns `0%` when sample is empty. |
| **Publishing Consistency Score** | `max(0, round((1 − min(CV, 1)) × 100))` where `CV = σ(intervals) / μ(intervals)` in hours | Requires `≥ 2` valid post timestamps; otherwise returns `consistencyScore: null` (`Insufficient data`). |
| **Benchmark Comparison** | Peer `mean`, peer `median`, `deltaVsMean`, and `percentileRank` (`0–100`) | Excludes `null` peers; returns `null` when target or peers are absent. |
| **Data Completeness Score** | `(Populated Core Fields / 9 Core Fields) × 100` | Evaluates followers, following, posts, ER, cadence, bio, category, recent posts, and historical checkpoints. |

## Verification

- Automated unit tests: `src/lib/analytics/engine.test.ts` (4 comprehensive test suites covering normal, zero, null, negative, and boundary inputs — **Verified**).
- UI surfacing: `src/components/dashboard/AnalyticsCharts.tsx` renders the Statistical Summary strip, 3-Pt SMA table column, and expandable `Metric formulas` disclosure (**Locally Tested**).
