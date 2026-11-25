# Viewora — Stage 1 Product Audit & Architecture Cleanup

**Audit Date:** 2026-11-25  
**Scope:** All public, authentication, customer workspace, profile headquarters, administrative, and API routes in `src/`.  
**Baseline Quality Gates:** `eslint` (0 errors), `tsc --noEmit` (0 errors), `vitest` (40/40 passing).

---

## 1. Complete Screen & Route Inventory

### Public Routes (`/[locale]/...`, 5 locales: `en`, `pt-BR`, `es`, `de`, `fr`)
| Route | Component / Entry | Purpose | Audit Status |
| --- | --- | --- | --- |
| `/[locale]` | `src/app/[locale]/page.tsx` | Homepage + profile search hero + workspace showcase + 12 tools + pricing teaser | Hardcoded English copy; uses `INITIAL_PLANS` instead of `getConfiguredPlans()` |
| `/[locale]/tools` | `src/app/[locale]/tools/page.tsx` | 12 Free Tools directory | Metadata says "10 free tools" (stale); uses inconsistent `indigo-*` colors instead of Viewora violet |
| `/[locale]/tools/[slug]` | `src/app/[locale]/tools/[slug]/page.tsx` | Alias redirect/render for tool pages | Duplicates `/[locale]/[slug]` canonical tool URLs |
| `/[locale]/[slug]` | `src/app/[locale]/[slug]/page.tsx` | Canonical 12 free tools + info/legal pages (`about`, `blog`, `faq`, `contact`, `privacy`, `terms`, `cookies`, `data-transparency`, `responsible-use`) | Tool workspace lacks validation errors, quick presets, formula explanations, and empty states |
| `/[locale]/pricing` | `src/app/[locale]/pricing/page.tsx` | 5-tier pricing & entitlement comparison | Uses legacy `indigo-600` / `slate-900` styling; Free CTA points to legacy `/auth/signup` instead of `/register` |

### Account & Onboarding Routes
| Route | Component / Entry | Purpose | Audit Status |
| --- | --- | --- | --- |
| `/[locale]/login` | `src/app/[locale]/login/page.tsx` | Sign-in page (`LoginForm`) | Missing password visibility toggle, return-path notice, and explicit auth-mode pill |
| `/[locale]/auth/login` | `src/app/[locale]/auth/login/page.tsx` | Legacy redirect to `/[locale]/login` | OK (redirect preserved) |
| `/[locale]/register` | `src/app/[locale]/register/page.tsx` | Registration page (`SignupForm`) | Uses `indigo-600`, links to `/auth/login`, no password visibility toggle, skips optional onboarding |
| `/[locale]/auth/signup` | `src/app/[locale]/auth/signup/page.tsx` | Legacy redirect to `/[locale]/register` | OK (redirect preserved) |
| `/[locale]/onboarding` | `src/app/[locale]/onboarding/page.tsx` | 4-step post-signup onboarding | Swallows API errors silently, ignores `workspaceName` on submit, lacks Back buttons, forces `viewora.studio` handle |
| `/[locale]/forgot-password` | `src/app/[locale]/forgot-password/page.tsx` | Password recovery | Submits plain GET form directly to `/verify-email` without API check — misleading simulated success |
| `/[locale]/reset-password` | `src/app/[locale]/reset-password/page.tsx` | Password reset landing | Static notice; needs explicit status/recovery state |
| `/[locale]/verify-email` | `src/app/[locale]/verify-email/page.tsx` | Email verification notice | Static notice; needs clear Supabase configuration honesty |
| `/[locale]/checkout*` | `src/app/[locale]/checkout/**/page.tsx` | Phase 7 reserved billing pages | Payments disabled (`503` on API) |

### Customer Workspace Routes
| Route | Component / Entry | Purpose | Audit Status |
| --- | --- | --- | --- |
| `/[locale]/dashboard` | `src/app/[locale]/dashboard/page.tsx` | Main customer dashboard (`CustomerDashboard`, 1,037 LOC) | Unconditionally seeds `@viewora.studio` & `@aurora.coffee` demo profiles; saved profiles & notifications are client-side only and lost on reload |
| `/[locale]/dashboard/[section]` | `src/app/[locale]/dashboard/[section]/page.tsx` | Section deep-links (`profiles`, `analytics`, `activity`, `calendar`, `competitors`, `ai-insights`, `reports`, `notifications`, `subscription`, `billing`, `settings`, `support`) | Ignores `section` parameter when rendering `CustomerDashboard` (always opens `overview`); `support` has no UI; `settings` lacks working account-deletion form; unconditionally seeds demo profiles |
| `/[locale]/dashboard/profile` | `src/app/[locale]/dashboard/profile/page.tsx` | Personal Digital HQ (`ProfileHeadquarters`, 716 LOC) | Optimistic save notice shown even when HTTP requests fail; backed by volatile in-memory `Map`; hardcoded `Member since Nov 2026`; missing editable avatar, preferred language, personal shortcuts, real usage metrics |
| `/[locale]/dashboard/profiles/[id]` | `src/app/[locale]/dashboard/profiles/[id]/page.tsx` | Individual saved profile view | Minimal card; needs notes/folder context and link back to workspace analytics |

### Administrative Routes
| Route | Component / Entry | Purpose | Audit Status |
| --- | --- | --- | --- |
| `/[locale]/admin` | `src/app/[locale]/admin/page.tsx` | Super Admin console (`AdminConsole`, 695 LOC) | Volatile in-memory store; uses `indigo-600`; annual discount toggle hardcodes `20% ↔ 25%` conflicting with `30%` catalog default; CMS editing only toggles publish; ticket notes not editable; sample metrics not labeled separately from recorded metrics |
| `/[locale]/admin/[section]` | `src/app/[locale]/admin/[section]/page.tsx` | Deep-linked admin sections | Ignores `section` for 15 of 20 sections (always opens `users` tab) |

---

## 2. Prioritized Defect Register

1. **Broken Functionality**
   - `/dashboard/[section]` drops the requested `section` (`analytics`, `ai-insights`, `reports`, `support`, etc.) and always renders the `overview` tab.
   - `/dashboard/support` renders the dashboard `overview` tab with no support ticket submission interface.
   - `CustomerDashboard` renders blank views on `analytics`, `timeline`, `calendar`, and `exports` when `savedProfiles` is empty.
   - `AdminConsole` annual discount button toggles `20% ↔ 25%`, overwriting the authoritative `30%` annual discount without a way to restore `30%`.
   - `/admin/[section]` ignores most section slugs and always opens the `users` tab.
2. **Duplicate / Inconsistent Navigation**
   - `SiteHeader` always displays `Sign in` and `Get Started` even when a customer is already signed in, duplicating workspace entry points.
   - Links mix canonical `/register` and `/login` with legacy `/auth/signup` and `/auth/login`.
3. **Inconsistent Design Patterns**
   - `PricingExperience`, `ToolsDirectoryPage`, `SignupForm`, and `AdminConsole` still use raw Tailwind `indigo-600` / `slate-900` instead of Viewora's Midnight Navy (`#080D19` / `#131C2E`), Electric Violet (`#7957FF`), and `.viewora-card` / `.viewora-btn-primary` tokens.
4. **Confusing Labels & Hard-Coded Values**
   - `tools/page.tsx` metadata states `"10 free Instagram analytics..."` instead of 12.
   - `ProfileHeadquarters` hardcodes `"Member since Nov 2026"`.
   - `CustomerDashboard` Calendar hardcodes `"November 2026"` and `AnalyticsCharts` hardcodes a static 21-cell heatmap array `[1,3,2,...]`.
   - `CustomerDashboard` top bar hardcodes `<ProvenanceBadge dataClass="demo" />` regardless of actual data provenance.
5. **Nonpersistent State**
   - `savedProfiles`, `notifications` read states, workspace selection, and report history live only in React `useState`.
   - `src/lib/auth/profile-prefs.ts`, `src/lib/entitlements/service.ts`, and `src/lib/admin/store.ts` use process-local memory that resets on restart.
6. **Misleading Success Messages & Placeholder Interactions**
   - `ProfileHeadquarters.persistProfile()` displays `"Personal headquarters settings saved."` without checking `response.ok`.
   - `CustomerDashboard.saveEmailPreferences()` sets `prefSaved = true` without verifying `res.ok`.
   - `forgot-password/page.tsx` submits a GET navigation to `/verify-email` that appears to send a recovery email without calling any backend check.
   - `onboarding/page.tsx` discards `workspaceName` and swallows fetch failures.
   - `dashboard/settings` prints raw `POST /api/auth/delete-account` instructions instead of a confirmed interactive deletion workflow.
7. **Accessibility Defects**
   - Missing skip-to-main-content link in `[locale]/layout.tsx`.
   - `SiteHeader` desktop dropdowns lack Escape-key dismissal and `aria-current="page"` on active links.
   - Charts lack keyboard-accessible point inspection on the follower growth SVG.
8. **Missing Empty / Error / Confirmation States**
   - Deleting a saved profile has no confirmation dialog.
   - Free tools lack validation feedback for invalid/zero/empty values and lack clear empty states.
9. **Monolithic Components Requiring Refactoring**
   - `CustomerDashboard.tsx` (1,037 LOC) → decompose into focused feature modules under `src/components/dashboard/`.
   - `ToolWorkspace.tsx` (833 LOC) → standardize wrapper with validation, presets, formula explanation, and empty/error states.

---

## 3. Target Component & Persistence Architecture

- **Reusable Page Shell (`src/components/layout/PageShell.tsx`):** `PageContainer`, `PageHeader`, `SectionCard`, `StatusBanner`, and `ConfirmDialog` for visual and accessibility consistency across public, customer, and admin surfaces.
- **Unified Durable Persistence (`src/lib/storage/persistence.ts` + Supabase migration `20261125000004_experience_upgrade.sql`):**
  - Uses Supabase Postgres when `isSupabaseConfigured()` is true.
  - Uses atomic local JSON persistence (`.viewora-data/`, overridable via `VIEWORA_DATA_DIR`) when running locally without live Supabase credentials so all user, workspace, plan, entitlement, CMS, support, notification, and audit mutations survive browser refreshes, new sessions, and server restarts.
- **Modular Dashboard (`src/components/dashboard/`):**
  - `DashboardShell.tsx` — responsive sidebar, mobile nav, greeting bar, explicit Demo Preview Mode toggle.
  - `SavedProfilesModule.tsx` — persistent saved profiles, research folders, private notes, search/sort/filter, confirmed delete.
  - `AnalyticsCharts.tsx` — date filters, keyboard-accessible SVG charts, derived heatmap, accessible data table, source/freshness header.
  - `CompetitorStudio.tsx` — persistent comparison projects & side-by-side matrix.
  - `ActivityCalendarModule.tsx` — real snapshot timeline + dynamic month calendar derived from post dates.
  - `ReportsLibraryModule.tsx` — AI report library + export history + PDF/CSV generator.
  - `NotificationsSupportModule.tsx` — persistent notification read states + customer support ticket creator & tracker.
  - `MembershipSettingsModule.tsx` — live synchronized 5-tier entitlements + dashboard settings + confirmed account deletion.
