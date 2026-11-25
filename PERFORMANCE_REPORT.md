# Viewora — Performance & Build Footprint Report (Updated Phase 4.1)

**Date:** 2026-11-26  
**Build Target:** Next.js `15.5.29` production build (`npm run build`)

## 1. Measured Production Bundle & Build Metrics

| Metric | Measured Value |
| :--- | :--- |
| Production Compile Time (`next build`) | `16.6s` |
| Static / SSG Pre-Rendered Pages | **304 / 304** (5 locales × public marketing, 12 free tools, pricing, policy/resource pages) |
| First Load JS Shared By All | `103 kB` (`46.6 kB` + `54.2 kB` + `2 kB`) |
| Middleware Bundle Size | `34.9 kB` |
| `/[locale]/pricing` First Load JS | `134 kB` (`5.59 kB` route chunk) |
| `/[locale]/tools` First Load JS | `134 kB` (`9.02 kB` route chunk) |
| `/[locale]/login` First Load JS | `129 kB` |
| `/[locale]/onboarding` First Load JS | `115 kB` (`7.57 kB` route chunk) |
| Live PostgreSQL `SELECT 1` Health Latency (`db:health`) | `88 ms` (`viewora` on `127.0.0.1:5432`) |
| Admin Page Live PG Health Pill (`pg_e2e_admin_1440px.png`) | `2 ms`–`99 ms` (local PostgreSQL 14.25) |

## 2. Architectural Performance Controls

- **Zero-DB Static Public Shell:** All 78 public routes across 5 locales render independently of PostgreSQL without blocking on DB connections (`strict_recovery_qa.mjs`: 78/78 HTTP 200).
- **Debounced Authorized Search:** Command Palette debounces `/api/dashboard/search` queries by `180 ms` and cancels superseded requests with `AbortController`.
- **Zero Heavy PDF/Image Native Dependencies:** Pure TypeScript `%PDF-1.4` binary generator ([pdf.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/reports/pdf.ts)) and binary header image parsers ([image-validation.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/storage/image-validation.ts)) add near-zero bundle overhead and zero native binary build fragility.

## 3. Honest Measurement Boundaries

- **Standalone Local Lighthouse CLI:** Checked via `Get-Command lighthouse` on this Windows workstation — `lighthouse` CLI is **not installed locally**, so no Lighthouse numeric score is claimed or fabricated.
- **Hosted Core Web Vitals / Real User Monitoring (RUM):** Hosted staging/production TTFB, LCP, INP, and CLS cannot be measured on loopback (`localhost`) and must be captured on the actual Phase 5 staging deployment over HTTPS/CDN.
