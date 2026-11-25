# Viewora — Design System Specification

**Brand Tagline:** *Explore More. Discover More.*  
**Source of Truth:** [globals.css](file:///c:/Users/Scorpio/Videos/Instagram/src/app/globals.css), [Primitives.tsx](file:///c:/Users/Scorpio/Videos/Instagram/src/components/ui/Primitives.tsx), [PageShell.tsx](file:///c:/Users/Scorpio/Videos/Instagram/src/components/layout/PageShell.tsx)

## 1. Color & Theme Tokens
- **Primary Brand Purple:** `#7957FF` (dark accent) / `#6941EF` (light accent, WCAG AA contrast on white) / `#A99AFF` (soft dark text accent)
- **Secondary Accent:** Cyan `#22D3EE` (dark) / `#0891B2` (light)
- **User-Selectable Accent Presets (`[data-accent]`):** `violet`, `cyan`, `emerald`, `indigo`
- **Light Surfaces:** Canvas `#F8FAFC`, Card `#FFFFFF`, Secondary `#F1F5F9`, Border `#E2E8F0`, Text `#0F172A` / `#64748B`
- **Dark Surfaces:** Canvas `#080D19`, Card `#131C2E`, Secondary `#0F172A`, Elevated `#192337`, Border `#263047`, Text `#F8FAFC` / `#94A3B8`
- **Semantic Status:** Success `#34D399`, Warning `#FBBF24`, Error `#F87171`
- **Accessibility Overrides:** `[data-reduced-motion="true"]` and `[data-high-contrast="true"]` synced from Personal Digital HQ 3.0.

## 2. Typography & Components
- **Display Headings (`h1–h4`):** `Plus Jakarta Sans` (`--font-display`)
- **UI & Body Copy:** `Inter` (`--font-sans`), tabular numerals (`tabular-nums`) for all KPI cards and analytics tables
- **Core Primitives:** `.viewora-card`, `.viewora-card-elevated`, `.viewora-glass`, `.viewora-btn-primary`, `.viewora-skeleton`, `MembershipBadge`, `MetricCard`, `SkeletonCard`, `EmptyState`, `ProvenanceBadge`, `StatusBanner`, `ConfirmDialog`.
