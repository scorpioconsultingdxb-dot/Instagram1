# Viewora — UX Audit Report

**Date:** 2026-11-25  
**Scope:** End-to-end UX inspection across public site, free tools, authentication, onboarding, Personal Digital HQ, customer dashboard, AI Studio, membership pricing, and Super Admin console.

---

## 1. Key Usability Issues Identified & Resolved in Phase 2

| Area | Issue Found During Inspection / Browser QA | Resolution Implemented |
| :--- | :--- | :--- |
| **Multi-Locale Header (`/fr`)** | Long French nav labels (`Transparence des données`, `Tableau de bord`, `Outils Gratuits`) caused horizontal overflow at `1440px`. | Tightened desktop nav sizing and scoped the secondary transparency link to `2xl:inline-flex` in `SiteHeader.tsx`; verified `0` horizontal overflow across all 5 locales and 6 viewports (`375px`–`1920px`). |
| **Onboarding Flash of Content** | Unauthenticated visitors hitting `/onboarding` briefly saw Step 1 of the wizard before session check completed, or previously defaulted Step 3 to Demo Preview Mode. | Added clean loading spinner prior to session hydration, explicit sign-in guard for anonymous visitors, segment-tailored workspace names, theme switcher, and clean-workspace default. |
| **Personal Digital HQ Completeness** | Profile HQ had 8 sections and lacked a dedicated `My Research` hub, hero segment/email-verification pills, inline password change, active session revocation, and inline account deletion. | Expanded to all 9 sections (adding `My Research`), added hero pills and quota progress bars, and built `AccountSecurityPanel` + `InlineAccountDeletionCard`. |
| **Dashboard Customizability** | Customers could not hide/show overview widgets or trigger quick actions directly from the Overview header. | Added persistent `Customize Layout` widget visibility controls, Quick Actions strip (`Save Profile`, `Compare Peers`, `AI Studio`), and Personal Shortcuts bar. |
| **Competitor Comparison Editing** | Backend supported `update_comparison`, but UI only supported create/delete and had no column sorting or matrix CSV export. | Added inline Edit Comparison Project, sortable matrix columns (`Followers`, `Est. ER`, `Delta`, `Posts/wk`), and RFC-4180 CSV export. |
| **AI Studio Discoverability** | Single `<select>` dropdown hid the 7 structured report layouts and lacked one-click Markdown brief copy in the live viewer. | Upgraded to a visual 7-template card library with layout category badges and one-click Copy Markdown Brief (with full provenance metadata). |
| **Pricing Decision Friction** | Visitors comparing 5 tiers had to scan the full capability matrix manually to determine fit. | Added an honest **Plan Comparison Assistant** matching profile volume, exports, and agency workspaces to the right tier with zero artificial urgency. |
| **Admin Account Operations** | Admins could change roles/plans but lacked UI controls for membership distribution, filtering by plan/role, suspending/reactivating accounts, or granting per-user entitlement overrides. | Added live recorded Membership Distribution cards, plan/role filters, `ConfirmDialog`-protected Suspend/Reactivate actions, and Per-User Entitlement Override UI. |
| **Local Dev CSP Hydration** | Strict CSP without `'unsafe-eval'` blocked Next.js React Fast Refresh in `next dev`. | Scoped `'unsafe-eval'` strictly to `NODE_ENV !== 'production'` in `next.config.ts` while keeping production CSP strictly free of `'unsafe-eval'`. |

## 2. Remaining UX Limitations (Honest Disclosure)

- Live Instagram public lookups and live Gemini AI generations remain in clearly labeled demo / template / unavailable states until external provider credentials are authorized in a later phase.
- Checkout intentionally returns an honest disabled-payments notice (`PAYMENTS_ENABLED=false`) without collecting card details.
