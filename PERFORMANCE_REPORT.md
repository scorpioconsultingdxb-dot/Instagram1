# Viewora — Performance Measurement Report (Phase 4)

**Date:** 2026-11-25  
**Honesty Rule:** Localhost loopback measurements are reported explicitly as **local production build timings** and are **never** substituted for real-world CDN/field Core Web Vitals.

## 1. Production Build Bundle Footprint (Measured via `next build`)
- **First Load JS Shared by All Routes:** **`103 kB`** (`chunks/1255-*.js` `46.6 kB` + `chunks/4bd1b696-*.js` `54.2 kB`)
- **Homepage (`/[locale]`):** `3.83 kB` route JS (`121 kB` total First Load JS)
- **Tools Directory (`/[locale]/tools`):** `9.02 kB` (`134 kB` total First Load JS)
- **Pricing (`/[locale]/pricing`):** `5.59 kB` (`134 kB` total First Load JS)
- **Dashboard (`/[locale]/dashboard`):** `178 B` shell / `168 kB` First Load JS
- **Personal Digital HQ (`/[locale]/dashboard/profile`):** `17.4 kB` (`142 kB` total First Load JS)
- **Middleware:** `34.9 kB`
- **Static Pre-Rendering:** **303 / 303 pages** pre-rendered cleanly (zero blocking DB calls on public pages).

## 2. Localhost Production Runtime & Database Latency (Measured)
- **PostgreSQL 14.25 Health Latency (`viewora_app`):** `51–100 ms` local loopback (`db:health` & `env:check`).
- **Previously Measured Throttled Local CWV Baseline (Slow 4G + 4× CPU on `next start`):** LCP `612–2,132 ms` (target `<= 2,500 ms`), CLS `<= 0.0015` (target `<= 0.1`).

## 3. Pending Real-World Production Verification
- **Lighthouse CI (Mobile 90+, Accessibility 95+, Best Practices 95+, SEO 95+) & Field RUM (LCP/CLS/INP):** Must be measured against a deployed HTTPS staging/production origin behind CDN (`Pending Staging Infrastructure`).
