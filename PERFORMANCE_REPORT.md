# Viewora — Performance & Bundle Architecture Report (Stage 50.6)

**Date:** 2026-11-26  
**Local Build & DB Metrics:** **Verified** · **Hosted Lighthouse / Field RUM CWV:** **PENDING (Hosted HTTPS Staging Gate)**

---

## 1. Verified Production Build & Runtime Measurements (`next build` 15.5.29)

- **Static Generation Coverage:** **311/311** pre-rendered static pages across all 5 locales (`en`, `pt-BR`, `es`, `de`, `fr`) and 12 public tools (public routes zero-DB dependent).
- **Production Bundle Sizes (Measured):**
  - Shared First Load JS: **`103 kB`** (`chunks/1255` `46.6 kB` + `chunks/4bd1b696` `54.2 kB`)
  - Homepage (`/[locale]`): **`3.83 kB`** page JS · **`121 kB`** First Load JS
  - Tools Hub (`/[locale]/tools`): **`9.02 kB`** page JS · **`134 kB`** First Load JS
  - Admin Console (`/[locale]/admin`): **`136 B`** route shell · **`131 kB`** First Load JS
  - Middleware: **`34.9 kB`**
  - Clean Client/Server Split: Extracted `conversations-shared.ts`, `financial-shared.ts`, and `email/catalog.ts` so zero server-only modules (`fs`, `crypto`, `PrismaClient`) enter browser bundles.
- **Database Latency (Measured on Local PostgreSQL 14.25):**
  - `viewora` runtime probe (`viewora_app`): **`50 ms`**
  - `viewora_test` runtime probe (`viewora_test_app`): **`46 ms`**
  - Full `db:health` multi-table check: **`92 ms`**
  - Production compile time: **`6.6 s`**

---

## 2. Pending Hosted Performance Gate

- Local Lighthouse CLI is not installed on this workstation; hosted Lighthouse desktop/mobile scores (`LCP`, `CLS`, `INP`, `TTFB`) and field RUM Core Web Vitals remain **pending** until deployed to hosted HTTPS staging.
