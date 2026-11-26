# Viewora — Performance & Core Web Vitals Verification Report (Updated Stage 68)

**Date:** 2026-11-26  
**Laboratory Build & Local Runtime Measurements:** **VERIFIED**  
**Hosted HTTPS Lighthouse Laboratory Scores:** **PENDING (Requires Hosted HTTPS Staging URL — Stage 61)**  
**Real-User Field Core Web Vitals (CrUX / RUM):** **NOT AVAILABLE YET (Zero Public Traffic — Pre-Launch)**

---

## 1. Laboratory vs. Field Data Honesty Distinction

Viewora strictly separates three performance tiers and never presents local build measurements as hosted Lighthouse scores or real-user field telemetry:

| Evidence Tier | Current Status | Measured Values / Targets |
| :--- | :---: | :--- |
| **Tier 1: Local Production Build & DB Telemetry** | **VERIFIED** | `322/322` pre-rendered static pages (zero DB round-trip on public routes) · Shared First Load JS **`103 kB`** (`chunks/1255` `46.6 kB` + `chunks/4bd1b696` `54.2 kB`) · Middleware **`34.9 kB`** · Tools Hub `134 kB` FLJS · Local `db:health` healthy · `0` console/page errors across all 42 desktop/mobile captures |
| **Tier 2: Hosted HTTPS Staging Lighthouse (Lab)** | **PENDING STAGING** | Target thresholds to verify on `https://staging.<domain>`: **Mobile Performance ≥ 90**, **Accessibility ≥ 95**, **Best Practices ≥ 95**, **SEO ≥ 95**, **LCP ≤ 2.5 s**, **CLS ≤ 0.10**, **INP ≤ 200 ms** |
| **Tier 3: Production Field RUM / CrUX Data** | **POST-LAUNCH ONLY** | Collect over first 28 days of real user traffic after Stage 70 Commercial GA (requires counsel-approved privacy/cookie notice) |

---

## 2. Hosted Staging Lighthouse Execution Command (Ready Upon Stage 61 Deploy)

```bash
# Run against key public & landing routes on hosted HTTPS staging
for ROUTE in /en /en/tools /en/pricing /en/launch /pt-BR /de; do
  npx lighthouse "https://staging.<owner-domain>${ROUTE}" \
    --preset=perf --form-factor=mobile --throttling-method=simulate \
    --output=json --output-path="./lighthouse_staging_${ROUTE//\//_}.json" \
    --chrome-flags="--headless=new --no-sandbox"
done
```

All 6 audited staging routes must meet or exceed the targets above before clearing Launch Gate #8 in [COMMERCIAL_GO_NO_GO_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/COMMERCIAL_GO_NO_GO_REPORT.md).
