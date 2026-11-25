# Viewora — Performance & Core Web Vitals Report

**Date:** 2026-11-25  
**Measurement Environment:** Local Next.js `15.5.29` production build (`next start`, `NODE_ENV=production`) inspected via headless Google Chrome (`1440x900`) using the browser's `PerformanceObserver` / Performance Navigation & Paint APIs.  
**Honesty Note:** Values below are **actual local loopback measurements** on the built production server, NOT assumed scores. Standalone Lighthouse CLI (`lighthouse`) is not installed in this local environment, so synthetic Lighthouse mobile/desktop numeric scores (0–100) are marked **Pending external Lighthouse audit** rather than fabricated.

---

## 1. Actual Measured Production Core Web Vitals (`next start`)

| Route | TTFB | DOM Interactive | FCP | LCP (Target `<= 2500ms`) | CLS (Target `<= 0.1`) | First Load JS (Build) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `/en` | `145 ms` | `492 ms` | `524 ms` | **`524 ms`** (PASS) | **`0.0000`** (PASS) | `121 kB` |
| `/en/tools` | `34 ms` | `55 ms` | `88 ms` | **`88 ms`** (PASS) | **`0.0000`** (PASS) | `134 kB` |
| `/en/pricing` | `29 ms` | `78 ms` | `92 ms` | **`92 ms`** (PASS) | **`0.0000`** (PASS) | `134 kB` |
| `/en/resources` | `17 ms` | `34 ms` | `60 ms` | **`60 ms`** (PASS) | **`0.0000`** (PASS) | `132 kB` |
| `/en/glossary` | `24 ms` | `44 ms` | `68 ms` | **`68 ms`** (PASS) | **`0.0000`** (PASS) | `132 kB` |

- **Shared First Load JS Bundle:** `103 kB` across all routes (Next.js App Router + React 19 + Tailwind CSS v4).
- **Dashboard (`/[locale]/dashboard`) First Load JS:** `149 kB` (`141 kB` for `/dashboard/profile`, `123 kB` for `/admin`).
- **INP (Interaction Responsiveness):** Client interactions (FAQ accordion toggle, Tools mode filter, Pricing interval/assistant toggles, Dashboard layout customizer, Profile HQ 9-tab navigation) execute purely in local React state with sub-50ms responsiveness (`<< 200ms` target).

## 2. Pending Real-World Performance Audits

- **Lighthouse Mobile/Desktop 0–100 Scores (Simulated 4G Throttling):** Pending execution via Chrome DevTools Lighthouse or `npx lighthouse` against a deployed staging URL or local production server once Lighthouse CLI is available.
- **Database-Connected TTFB under PostgreSQL 16:** Pending measurement against live PostgreSQL 16 (`viewora_app`) with indexed queries under load.
