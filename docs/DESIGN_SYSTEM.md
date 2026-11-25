# Viewora — Updated Design System (10-Stage Upgrade)

## 1. Brand Color Tokens (`src/app/globals.css`)
- **Midnight Navy Dark Surfaces:** Canvas `#080D19`, Secondary `#0F172A`, Card `#131C2E`, Elevated `#192337`, Subtle Border `#263047`
- **Light Surfaces:** Canvas `#F8FAFC`, Secondary `#F1F5F9`, Card `#FFFFFF`, Border `#E2E8F0`
- **Primary Accents:** Electric Violet `#7957FF` (dark) / `#6941EF` (light), Soft Violet `#A99AFF`, Cyan Accent `#22D3EE` (dark) / `#0891B2` (light)
- **User-Selectable Accessible Accent Presets:** `violet`, `cyan`, `emerald`, `indigo` (persisted in Personal Digital HQ via `data-accent`)
- **Semantic Status:** Success `#34D399`, Warning `#FBBF24`, Error `#F87171`

## 2. Typography & Numeric Clarity
- **Display Font:** `Plus Jakarta Sans` (`--font-display`) for headings, KPIs, and workspace headers
- **Body Font:** `Inter` (`--font-sans`) for crisp readability
- **Numeric Discipline:** `tabular-nums` on all follower counts, engagement rates, pricing figures, deltas, and tables

## 3. Shared Layout & UI Primitives
- **Reusable Page Shell (`src/components/layout/PageShell.tsx`):** `PageContainer`, `PageHeader`, `SectionCard`, `StatusBanner`, and keyboard-accessible `ConfirmDialog`
- **UI Primitives (`src/components/ui/Primitives.tsx`):** `MembershipBadge` (5 tiers), `MetricCard`, `SkeletonCard`, `EmptyState`, `ErrorState`, `UpgradePreviewCard`, `Breadcrumbs`
- **Provenance Badges (`src/components/ui/ProvenanceBadge.tsx`):** Explicit `LIVE`, `CACHED`, `ESTIMATE`, `DEMO`, and `UNAVAILABLE` stamps across all analytics, tools, reports, and exports

## 4. Accessibility & Responsive Standards (WCAG 2.2 AA)
- Skip-to-main-content link (`#main-content`) in `[locale]/layout.tsx`
- Visible 2px focus outlines (`*:focus-visible`) and `prefers-reduced-motion` support
- Escape-key dismissal for dropdowns, Command Palette (`Ctrl+K`/`⌘K`), and `ConfirmDialog`
- Keyboard-accessible SVG checkpoint selectors + full tabular data alternatives (`Charts / Table / Both`)
- Zero horizontal overflow verified across `375px`, `390px`, `768px`, `1024px`, `1440px`, and `1920px`
