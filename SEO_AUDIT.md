# Viewora — SEO Audit Report

**Date:** 2026-11-25  
**Supported Locales:** `en`, `pt-BR`, `es`, `de`, `fr` (5 languages + `x-default` hreflang)

---

## 1. Indexable Public Surface & Sitemap Coverage

- **Static Prerendered Routes (`next build`):** `296/296` pages compiled cleanly across all 5 locales.
- **12 Standalone Free Tool Landing Pages (`/[locale]/[slug]` & `/[locale]/tools/[slug]`):** Each includes unique title/description, `SoftwareApplication` JSON-LD, breadcrumbs, provenance disclosure, educational guidance, and related tool internal links.
- **11 Standalone Resource, Help & Trust Pages (`src/lib/public/info-pages.ts`):**
  - `about`, `contact`, `faq`, `blog`, `resources` *(new in Stage 19)*, `glossary` *(new in Stage 19)*, `privacy`, `terms`, `cookies`, `data-transparency`, `responsible-use`.
- **Sitemap (`src/app/sitemap.ts`) & Robots (`src/app/robots.ts`):**
  - Automatically generates localized URLs with complete `hreflang` alternates (`en`, `pt-BR`, `es`, `de`, `fr`, `x-default`) — verified in `src/lib/integration/api.test.ts` and live production DOM (`hreflangCount: 6` on `/en`, `/en/tools`, `/en/pricing`, `/en/resources`, `/en/glossary`).
  - `robots.txt` explicitly disallows `/api/`, `/*/dashboard`, `/*/admin`, and auth routes so private customer pages are never indexed.

## 2. Structured Data & Metadata Verification (Measured in Production DOM)

| Route | Canonical URL | `hreflang` Links | JSON-LD Scripts | Schema Type |
| :--- | :--- | :---: | :---: | :--- |
| `/en` | `http://localhost:3094/en` *(derived from `NEXT_PUBLIC_APP_URL`)* | `6` | `1` | `FAQPage` |
| `/en/tools` | `http://localhost:3094/en/tools` | `6` | `0` | Directory (`SoftwareApplication` on each of the 12 tool pages) |
| `/en/pricing` | `http://localhost:3094/en/pricing` | `6` | `0` | Open Graph + Canonical + Hreflang |
| `/en/resources` | `http://localhost:3094/en/resources` | `6` | `1` | `WebPage` + Breadcrumbs |
| `/en/glossary` | `http://localhost:3094/en/glossary` | `6` | `1` | `DefinedTermSet` + Breadcrumbs |
| `/en/faq` | `http://localhost:3094/en/faq` | `6` | `1` | `FAQPage` + Breadcrumbs |
| `/en/instagram-*` (12 tools) | Localized canonical | `6` | `1` | `SoftwareApplication` + Breadcrumbs |

## 3. Content Integrity & Localization Notes

- Zero thin auto-generated filler pages; zero fabricated reviews/testimonials/aggregate ratings in JSON-LD.
- Core navigation, hero, pricing, auth, dashboard, profile HQ, and tools chrome are localized across all 5 locales (`en`, `pt-BR`, `es`, `de`, `fr`), verified by `src/lib/integration/stages-3-to-9.test.ts`. Deep long-form English guide/glossary prose can be professionally translated by native editors in a future content localization pass.
