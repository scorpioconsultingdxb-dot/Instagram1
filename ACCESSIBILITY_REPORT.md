# Viewora — WCAG 2.2 AA Accessibility Report

**Date:** 2026-11-25  
**Target Standard:** WCAG 2.2 Level AA  
**Verification Method:** Static code audit + automated headless Chromium DOM accessibility assertions across public and authenticated pages in light and dark themes.

---

## 1. Automated Headless Chromium DOM Audit Results (`/en`, Production Build)

| Accessibility Check | Observed Result | Status |
| :--- | :--- | :--- |
| Skip-to-main-content link (`a[href="#main-content"]`) | Present (`true`) | **PASS** |
| Single semantic `<main id="main-content">` landmark | Present (`true`) | **PASS** |
| Labeled `<nav aria-label="...">` landmarks | Present (`true`) | **PASS** |
| Single `<h1>` heading per localized page (`en`, `pt-BR`, `es`, `de`, `fr`) | `1` on all 5 locales | **PASS** |
| `<html lang="...">` localized attribute | Set per locale | **PASS** |
| Unlabeled form inputs (`input:not([type="hidden"])`) | `0` unlabeled inputs | **PASS** |
| Images missing `alt` attribute | `0` missing `alt` | **PASS** |
| Decorative icons marked `aria-hidden="true"` | Verified across headers, buttons, badges, accordions | **PASS** |

---

## 2. Interactive & Keyboard Accessibility Controls Verified

- **Keyboard Focus Visibility:** Global `*:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }` enforced in `src/app/globals.css`.
- **Reduced Motion Preference:** Global `@media (prefers-reduced-motion: reduce)` clamps all animations/transitions to `0.01ms` and disables smooth scroll automatically.
- **ARIA Widget Semantics:**
  - Interactive FAQ Accordion (`HomeFaqAccordion.tsx`): `aria-expanded`, `aria-controls`, `role="region"`, `aria-labelledby`.
  - Tablists (`ProfileHeadquarters.tsx`, `ToolsDirectoryClient.tsx`, `AdminConsole.tsx`): `role="tablist"`, `role="tab"`, `aria-selected`.
  - Billing interval selector (`PricingExperience.tsx`): `role="radiogroup"`, `role="radio"`, `aria-checked`.
  - Toggle buttons & filters: `aria-pressed` consistently applied across theme, accent, mode filters, comparison handles, and demo preview controls.
  - Status & alert regions: `role="status"` and `role="alert"` used on all form errors, notices, and confirmations.
  - Charts (`AnalyticsCharts.tsx`): Accessible HTML data-table view toggle (`Charts` / `Table` / `Both`) alongside SVG visualizations.

## 3. Limitations & Next Accessibility Steps

- Formal screen-reader manual walkthroughs (NVDA / VoiceOver) and automated Lighthouse CLI contrast audits are recommended prior to commercial public launch (Lighthouse CLI is not installed in this local environment; see `PERFORMANCE_REPORT.md`).
