# Viewora Design System & UI/UX Architecture

**Brand:** Viewora
**Primary Tagline:** Explore More. Discover More.
**Campaign Headline:** See Beyond the Profile.

---

## 1. Brand Assets

| Asset | File | Purpose |
| --- | --- | --- |
| Logo & Monogram | `src/components/brand/VieworaLogo.tsx` | Interlocking V-prism aperture in `#7957FF` → `#22D3EE` with light/dark wordmark |
| App Icon / Favicon | `src/app/icon.svg` | Crisp vector favicon & PWA mark |
| Social Sharing Card | `src/app/opengraph-image.tsx` | Dynamic 1200×630 OpenGraph identity card |

---

## 2. Centralized Design Tokens (`src/app/globals.css`)

### Dark Mode
- Main Canvas: `#080D19` (`--surface-canvas`)
- Secondary Background: `#0F172A` (`--surface-secondary`)
- Card Surface: `#131C2E` (`--surface-card`)
- Elevated Surface: `#192337` (`--surface-elevated`)
- Subtle Border: `#263047` (`--border-subtle`)
- Primary Accent: `#7957FF` (`--accent-primary`)
- Secondary Accent: `#A99AFF`
- Cyan Accent: `#22D3EE`
- Semantic: Success `#34D399`, Warning `#FBBF24`, Error `#F87171`
- Text: Primary `#F8FAFC`, Secondary `#94A3B8`

### Light Mode
- Main Canvas: `#F8FAFC`
- Card Surface: `#FFFFFF`
- Secondary Surface: `#F1F5F9`
- Subtle Border: `#E2E8F0`
- Primary Accent: `#6941EF` (WCAG AA compliant on white)
- Text: Primary `#0F172A`, Secondary `#64748B`

### User-Selectable Accessible Accent Presets
Persisted in Personal Digital HQ (`/[locale]/dashboard/profile`) via `data-accent` on `<html>`:
- `violet` (`#6941EF` / `#7957FF`)
- `cyan` (`#0284C7` / `#06B6D4`)
- `emerald` (`#059669` / `#10B981`)
- `indigo` (`#4F46E5` / `#6366F1`)

---

## 3. Typography, Spacing, Radius & Motion

- **Headings**: `Plus Jakarta Sans` (`--font-plus-jakarta`) via `next/font/google`
- **Body / UI**: `Inter` (`--font-inter`) via `next/font/google`
- **Analytics / Prices**: `tabular-nums` enforced across all metric cards, tables, charts, and pricing cards
- **Border Radius**: `8px` controls (`rounded-lg`), `12px` standard (`rounded-xl`), `16px` cards (`rounded-2xl`), `24px` hero/HQ panels (`rounded-3xl`)
- **Motion**: `120–220ms` transform/opacity transitions; `@media (prefers-reduced-motion: reduce)` disables animations automatically

---

## 4. Core Component Library

- `src/components/ui/Primitives.tsx` — `MembershipBadge`, `MetricCard`, `SkeletonCard`, `EmptyState`, `ErrorState`, `UpgradePreviewCard`, `Breadcrumbs`
- `src/components/ui/ProvenanceBadge.tsx` — `LIVE`, `CACHED`, `ESTIMATED`, `DEMO`, `UNAVAILABLE`
- `src/components/command/CommandPalette.tsx` — Global `Ctrl+K` / `⌘K` keyboard navigation palette
- `src/components/search/ProfileSearchExperience.tsx` — 6-Tab Profile Intelligence interface (`Overview`, `Content`, `Growth`, `Engagement`, `AI Insights`, `Reports`)
- `src/components/dashboard/AnalyticsCharts.tsx` — Area/Line trajectory chart with hover tooltips, Engagement bar chart, Format donut chart, Publishing heatmap, accessible `<details>` data table
- `src/components/dashboard/AiIntelligenceStudio.tsx` — 7-type AI report workbench
- `src/components/profile/ProfileHeadquarters.tsx` — 8-section Personal Digital Headquarters (`/dashboard/profile`)
