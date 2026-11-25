# Viewora Design System

**Brand Identity:** Viewora  
**Tagline:** Explore More. Discover More.  
**Campaign Headline:** See Beyond the Profile.  
**Implementation Source:** `src/app/globals.css`, `src/app/layout.tsx`, `src/components/theme/ThemeProvider.tsx`, `src/components/ui/Primitives.tsx`, `src/components/ui/ProvenanceBadge.tsx`

---

## 1. Color Token Architecture

### Dark Theme (`html.dark`)
| Role | Token | Hex |
| :--- | :--- | :--- |
| Primary canvas | `--surface-canvas` / `--color-navy-950` | `#080D19` |
| Secondary surface | `--surface-secondary` / `--color-navy-900` | `#0F172A` |
| Card surface | `--surface-card` / `--color-navy-850` | `#131C2E` |
| Elevated surface | `--surface-elevated` / `--color-navy-800` | `#192337` |
| Subtle border | `--border-subtle` / `--color-navy-border` | `#263047` |
| Primary brand violet | `--accent-primary` / `--color-violet-brand` | `#7957FF` |
| Soft violet highlight | `--color-violet-soft` | `#A99AFF` |
| Cyan intelligence accent | `--color-cyan-accent` | `#22D3EE` |
| Success / Warning / Error | semantic status tokens | `#34D399` / `#FBBF24` / `#F87171` |
| Primary / Secondary text | `--text-primary` / `--text-secondary` | `#F8FAFC` / `#94A3B8` |

### Light Theme (`:root`)
| Role | Token | Hex |
| :--- | :--- | :--- |
| Background | `--surface-canvas` | `#F8FAFC` |
| Card background | `--surface-card` | `#FFFFFF` |
| Secondary surface | `--surface-secondary` | `#F1F5F9` |
| Border | `--border-subtle` | `#E2E8F0` |
| Primary / Secondary text | `--text-primary` / `--text-secondary` | `#0F172A` / `#64748B` |
| Primary violet | `--accent-primary` / `--color-violet-light` | `#6941EF` |

### Customer-Selectable Accessible Accent Presets
Persisted via Personal Digital HQ (`data-accent` attribute on `<html>`):
- `violet` (`#6941EF` light / `#7957FF` dark)
- `cyan` (`#0284C7` light / `#06B6D4` dark)
- `emerald` (`#059669` light / `#10B981` dark)
- `indigo` (`#4F46E5` light / `#6366F1` dark)

---

## 2. Typography, Surfaces & Motion

- **Display Headings (`h1`–`h4`, `.font-display`):** Plus Jakarta Sans (`--font-plus-jakarta`), tight tracking, extrabold/bold weights.
- **Body & UI Controls:** Inter (`--font-inter`), `tabular-nums` applied consistently on all KPIs, pricing, quotas, and benchmark tables.
- **Surfaces:** `.viewora-card` (1px hairline border + subtle depth shadow), `.viewora-card-elevated` (modals, search bar, featured pricing), `.viewora-hero-glow` (restrained radial ambient mesh with zero layout shift).
- **Motion & Reduced Motion:** `animate-viewora-enter` (`220ms cubic-bezier(0.16, 1, 0.3, 1)`), subtle `120ms–150ms` hover/active feedback, and global `@media (prefers-reduced-motion: reduce)` override clamping durations to `0.01ms`.

## 3. Core Component Primitives

- **Provenance Badges (`ProvenanceBadge.tsx`):** Five explicit states (`LIVE`, `CACHED`, `ESTIMATED`, `DEMO`, `UNAVAILABLE`) with accessible contrast and explanatory tooltips.
- **Membership Badges (`Primitives.tsx`):** Distinct visual styling across `Free`, `Starter`, `Premium`, `Pro`, and `Agency`.
- **Feedback & Confirmation (`PageShell.tsx`):** `StatusBanner` (`role="status"` / `role="alert"`), `ConfirmDialog` for destructive actions (delete profile, delete folder, delete comparison, suspend user), `EmptyState`, `ErrorState`, and `SkeletonCard`.
