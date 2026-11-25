# Viewora — Accessibility Audit Report (WCAG 2.2 AA — Phase 3 Update)

**Date:** 2026-11-25  
**Target Standard:** WCAG 2.2 Level AA  
**Verification Method:** Static review + automated DOM accessibility assertions in headless Google Chrome (Stage 30) across public and authenticated routes.

## 1. Automated DOM Verification Results

| Route | `html[lang]` | `<h1>` Count | Skip Link | Unlabeled `<button>` | Empty `<a>` | Missing `alt` on `<img>` | Horizontal Overflow (`375px`–`1920px`) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/en` | `en` | `1` | Present (`#main-content`) | `0` | `0` | `0` | `0px` |
| `/pt-BR`, `/es`, `/de`, `/fr` | Matched locale | `1` | Present | `0` | `0` | `0` | `0px` |
| `/en/dashboard/projects` | `en` | `1` | Present | `0` | `0` | `0` | `0px` (incl. `390px` mobile) |
| `/en/dashboard/report-builder` | `en` | `1` | Present | `0` | `0` | `0` | `0px` (incl. `390px` mobile) |

## 2. Phase 3 Accessibility Implementations

- **Keyboard-Navigable Controls:** All new onboarding segment/goal cards (`aria-pressed`), Report Builder section reorder buttons (`aria-label="Move <section> up/down"`), Research Pro pin/favorite/archive/delete buttons, Agency role selects, Automation forms, and Profile HQ media upload inputs include explicit accessible names and visible focus styling.
- **Charts & Tabular Alternatives:** `AnalyticsCharts.tsx` retains full accessible `<table>` output alongside SVG charts (now including the `3-Pt SMA` column and deterministic statistical cards with `tabular-nums`), plus keyboard-focusable checkpoint selector buttons.
- **Status Feedback:** All Phase 3 forms surface accessible `StatusBanner` / `role="alert"` / `role="status"` feedback without relying solely on color.
- **Custom Uploaded Images:** Uploaded avatar and cover `<img>` tags include explicit descriptive `alt` attributes (`Custom profile cover banner`, `<name> custom avatar`).

## 3. Remaining Manual / Infrastructure Checks (Honest Disclosure)

- **Pending Manual Assistive Technology Testing:** Full screen-reader walkthrough (NVDA/JAWS/VoiceOver) and automated axe-core/Lighthouse Accessibility CLI score runs are **Pending Infrastructure / Manual QA** (standalone `lighthouse` CLI is not installed on this workstation; tracked in `DEVELOPMENT_BACKLOG.md`).
