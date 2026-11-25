# Viewora — Performance Report (Phase 3 Release Candidate)

**Date:** 2026-11-25  
**Build:** Next.js `15.5.29` production build (`npm.cmd run build` → `302/302` static pages generated cleanly)  
**Measurement Tool:** Headless Google Chrome via Chrome DevTools Protocol (`PerformanceObserver` + `NavigationTiming`) against local `next start` (`127.0.0.1:3031`).

> **Honest Scope Disclosure:** Standalone `lighthouse` CLI is not installed on this Windows workstation, so no fabricated Lighthouse 0–100 scores are reported. Below are **real measured local loopback metrics** — both unthrottled and under **cold-cache Slow 4G + 4× CPU throttling** — which reflect local hardware rather than global real-user field telemetry (CrUX/RUM).

## 1. Production Bundle Footprint (`next build`)

- **Shared First Load JS:** `103 kB`
- **Homepage (`/[locale]`):** `121 kB` First Load JS (`3.83 kB` page JS)
- **Tools Directory (`/[locale]/tools`):** `134 kB` First Load JS
- **Pricing (`/[locale]/pricing`):** `134 kB` First Load JS
- **Onboarding (`/[locale]/onboarding`):** `115 kB` First Load JS
- **Personal Digital HQ (`/[locale]/dashboard/profile`):** `142 kB` First Load JS
- **Customer Dashboard (`/[locale]/dashboard/[section]`):** `168 kB` First Load JS (includes Phase 3 modules)
- **Admin Console (`/[locale]/admin`):** `125 kB` First Load JS
- **Middleware:** `34.9 kB`

## 2. Unthrottled Local Production Measurements (`1440×900`)

| Route | FCP | LCP | CLS | DCL | Load | JS Transfer | Overflow |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/en` | `304 ms` | `304 ms` | `0.0015` | `267 ms` | `332 ms` | `141 KB` | `0px` |
| `/en/tools` | `84 ms` | `84 ms` | `0` | `78 ms` | `88 ms` | `26 KB` | `0px` |
| `/en/pricing` | `96 ms` | `96 ms` | `0` | `90 ms` | `99 ms` | `9 KB` | `0px` |
| `/en/resources` | `60 ms` | `60 ms` | `0` | `48 ms` | `56 ms` | `15 KB` | `0px` |
| `/en/glossary` | `76 ms` | `76 ms` | `0` | `61 ms` | `62 ms` | `0 KB` (cached) | `0px` |

## 3. Cold-Cache Throttled Production Measurements (`Slow 4G: 1.6 Mbps / 150ms RTT` + `4× CPU Slowdown`)

| Route | FCP | LCP | CLS | DCL | Load | JS Transfer (Cold) | Overflow |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/en` | `648 ms` | `648 ms` | `0.0014` | `881 ms` | `2,289 ms` | `141 KB` | `0px` |
| `/en/tools` | `560 ms` | `2,132 ms` | `0.0001` | `610 ms` | `1,946 ms` | `167 KB` | `0px` |
| `/en/pricing` | `612 ms` | `612 ms` | `0.0002` | `681 ms` | `2,081 ms` | `168 KB` | `0px` |

All throttled cold-cache measurements remain within Google's "Good" Core Web Vitals thresholds (`LCP < 2,500 ms`, `CLS < 0.1`). Real-world CDN/edge latency, Lighthouse CI scoring, and database query P95 latency remain **Pending Infrastructure**.
