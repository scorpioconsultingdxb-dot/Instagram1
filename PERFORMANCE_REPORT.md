# Viewora — Performance & Core Web Vitals Readiness Report (Updated Stage 60)

**Date:** 2026-11-26  
**Local Production Build & Database Measurements:** **VERIFIED**  
**Hosted HTTPS Lighthouse & Field RUM Core Web Vitals:** **PENDING (Commercial Launch Gate #8 — Requires Hosted HTTPS Staging URL)**

---

## 1. Verified Local Production Build & Runtime Metrics (`next build` 15.5.29)

- **Static Pre-Rendering Coverage:** **322/322** static pages generated across all 5 locales (`en`, `pt-BR`, `es`, `de`, `fr`), 12 free tools, launch page (`/launch`), closed beta shell (`/beta`), guides, glossary, and legal pages — zero database round-trip required on public routes.
- **Production Compile Time:** **`13.5 s`** full clean production build (`npm run build`).
- **Client/Server Bundle Separation:** Server-only modules (`PrismaClient`, `crypto`, `fs`, provider secrets, billing/financial backend logic) remain strictly server-bundled with zero client bundle leakage.
- **Live PostgreSQL 14.25 Latency (Local Measured):**
  - `npm run db:health` multi-table health probe: **`136 ms`** (`healthy`, `users: 1`, `plans: 5`, `featureFlags: 5`).
  - `npm run env:check` 4-connection verification (`viewora` + `viewora_test` runtime & admin pools): **4/4 reachable**.
  - Full unit test suite (`vitest@5.1.2`, 23 files / 115 tests): **`9.31 s`**.
  - Live PostgreSQL integration suite (`viewora_test`, 9 tests): **`11.41 s`**.

---

## 2. Hosted HTTPS Staging Performance Targets (Launch Gate #8 — Not Yet Measured)

Once deployed to hosted HTTPS staging behind CDN/TLS 1.3, capture and archive verified Lighthouse & field RUM metrics against these release targets (do **not** claim attainment prior to hosted measurement):

| Metric | Target Threshold | Current Status |
| :--- | :---: | :---: |
| Lighthouse Performance (Mobile & Desktop) | **≥ 90** | **Pending Hosted Staging** |
| Lighthouse Accessibility | **≥ 95** | **Pending Hosted Staging** |
| Lighthouse Best Practices | **≥ 95** | **Pending Hosted Staging** |
| Lighthouse SEO | **≥ 95** | **Pending Hosted Staging** |
| Largest Contentful Paint (LCP) | **≤ 2.5 s** | **Pending Hosted Staging** |
| Cumulative Layout Shift (CLS) | **≤ 0.10** | **Pending Hosted Staging** |
| Interaction to Next Paint (INP) | **≤ 200 ms** | **Pending Hosted Staging** |
