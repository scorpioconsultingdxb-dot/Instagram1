# Viewora — End-to-End Customer Functionality Audit Report

**Date:** 2026-11-25  
**Scope:** Full persistence, authentication, customer workspace, Personal Digital HQ, reporting, support, membership, and administration audit.

---

## 1. Summary of Verified Functionality & Persistence Architecture

Every customer-facing workflow was audited line-by-line to eliminate silent in-memory or browser-only (`localStorage`) state discrepancies and ensure native PostgreSQL persistence compatible with both native Windows PostgreSQL and read-only cloud/serverless deployments.

| Customer Area | Storage Backend (When `DATABASE_URL` Set) | RLS / Ownership Isolation | Verification Status |
| --- | --- | --- | --- |
| **Public Site (Homepage, 12 Tools, Pricing, 11 Info Pages, 5 Locales)** | Stateless / Static + Optional PG Read | Public read-only (zero disk writes) | **Verified Live (Scenario A: 78/78 HTTP 200)** |
| **Registration, Login, Logout, Revocable Sessions** | PostgreSQL `users`, `sessions`, `consent_records` | Bcrypt cost 12, SHA-256 opaque tokens, `HttpOnly`/`SameSite=Lax`, CSRF origin checks | **Verified (Unit/Repo Tests) · Live PG Pending Owner `.env.local`** |
| **Email Verification & Password Reset** | PostgreSQL `email_verification_tokens`, `password_reset_tokens` | Single-use SHA-256 hashes, expiration, full session revocation on reset | **Verified (Unit/Repo Tests) · Live PG Pending Owner `.env.local`** |
| **4-Step Onboarding (7 Segments, 7 Goals, Save & Resume)** | PostgreSQL `users.segment`, `users.onboarding_completed`, `user_preferences.notification_preferences.hqExtended` | `user_preferences_owner_only` RLS | **Fixed & Verified (Unit/Repo Tests) · Live PG Pending Owner `.env.local`** |
| **Personal Digital HQ 2.0 (Bio, Title, Interests, Avatar/Cover Presets, Shortcuts, Theme, Locale)** | PostgreSQL `users` + `user_preferences` (`hqExtended`) | `user_preferences_owner_only` RLS | **Fixed & Verified (Unit/Repo Tests) · Live PG Pending Owner `.env.local`** |
| **Custom Avatar & Cover Image Uploads** | Magic-byte verified `FileStorageDriver` + metadata in PG `hqExtended` | Owner-scoped namespace (`/api/auth/media`, cross-user rejected) | **Verified (Unit + Isolated Demo Tests) · Object Storage Needed for Multi-Node Cloud** |
| **Dashboard Widget Visibility & Walkthrough Dismissal** | PostgreSQL `user_preferences` (`hqExtended.widgetVisibility`, `walkthroughDismissed`) | `user_preferences_owner_only` RLS (removed browser-only `localStorage`) | **Fixed & Verified (Unit/Repo Tests)** |
| **Saved Public Profiles, Research Folders, Tags & Private Notes** | PostgreSQL `workspaces`, `workspace_members`, `research_folders`, `saved_profiles`, `profile_snapshots`, `profile_research_notes` | Workspace-member RLS + `pg_advisory_xact_lock` quota guard; **zero admin bypass on private notes** | **Verified (Repo Tests) · Live PG Pending Owner `.env.local`** |
| **Research Workspace Pro (Nested Projects, Filters, CSV Import)** | PostgreSQL `user_preferences.notification_preferences._modules.researchPro` + `saved_profiles` | `user_preferences_owner_only` RLS + formula-injection & quota validation | **Fixed & Verified (Unit/Repo Tests)** |
| **Report Builder & AI Reports Library** | PostgreSQL `ai_reports`, `report_exports`, `_modules.customReports` | Workspace-member & owner-only RLS; CSV formula neutralization | **Fixed & Verified (Unit/Repo Tests)** |
| **Agency Multi-Client Collaboration Center** | PostgreSQL `_modules.agencyOrg` + entitlement seat/workspace checks | `user_preferences_owner_only` RLS; isolated team comments (never reads private notes) | **Fixed & Verified (Unit/Repo Tests)** |
| **Workflow & Automation Center** | PostgreSQL `_modules.automation` + `JobQueueEngine` | Owner-only RLS; external email/Instagram triggers honestly blocked | **Fixed & Verified (Unit/Repo Tests)** |
| **Customer Support Tickets** | PostgreSQL `support_tickets`, `support_messages`, `support_ticket_status_history` | `support_tickets_owner_or_support` RLS (tightened `GET /api/support` actor context) | **Fixed & Verified (Repo Tests)** |
| **Membership, Entitlements & Billing Preview** | PostgreSQL `plans`, `plan_billing_options`, `plan_entitlements`, `subscriptions`, `user_entitlement_overrides` | Server-side enforcement; `PAYMENTS_ENABLED=false` strictly locked | **Verified (Unit/Repo Tests + Scenario A Pricing QA)** |
| **GDPR/LGPD/PDPL Data Export & Confirmed Account Deletion** | `/api/auth/export-data` (`data_export_requests`), `/api/auth/delete-account` (`ON DELETE CASCADE`) | Requires exact email match; purges DB rows, sessions, and uploaded files | **Verified (Unit/Repo Tests)** |
| **Administration & RBAC** | PostgreSQL `audit_logs`, `feature_flags`, `cms_content`, `broadcast_notifications`, `users` | Server-side capability checks (`super_admin`, `admin`, `operations_admin`, `support_agent`, `content_manager`, `analyst`) | **Verified (Unit/Repo Tests) · Live PG Pending Owner `.env.local`** |

---

## 2. Specific Discrepancies Fixed in This Pass

1. **Removed browser-only `localStorage` widget persistence** in `src/components/dashboard/CustomerDashboard.tsx` (`viewora_dash_widgets`) — widget visibility now saves via `PATCH /api/auth/profile` to PostgreSQL.
2. **Closed silent drop of 15 Personal HQ / Onboarding fields in PostgreSQL mode** inside `src/lib/db/repositories/profile-prefs.repo.ts` and `src/lib/auth/profile-prefs.ts`.
3. **Eliminated read-only filesystem crashes on Phase 3 customer mutations** by routing Research Pro, Report Builder, Agency Center, and Automation Center through RLS-protected PostgreSQL storage (`user-module-state.repo.ts`) whenever `DATABASE_URL` is configured, and wrapping `/api/referrals` safely.
4. **Corrected initial `onboardingCompleted` flag on registration** (`users.repo.ts`: `false` until the user completes onboarding).
5. **Enforced database-level customer RLS on `GET /api/support`** by passing `{ userId: user.id, role: 'user' }`.

---

## 3. Screenshot Evidence Classification (Strict Honesty)

- **Real Production Scenario A Screenshots (Verified Today — Public Site Without DB on Read-Only FS):**
  - `recovery_homepage_1440px.png`, `recovery_homepage_390px_mobile.png`, `recovery_data_transparency_1440px.png`, `recovery_tools_1440px.png`, `recovery_pricing_1440px.png`, `recovery_login_1440px.png`, `recovery_register_1440px.png`
- **Isolated Local Demo UI Screenshots (Captured in Phase 3 — NOT Real PostgreSQL Evidence):**
  - `phase3_onboarding_1440px.png`, `phase3_research_pro_1440px.png`, `phase3_analytics_1440px.png`, `phase3_report_builder_1440px.png`, `phase3_agency_1440px.png`, `phase3_automation_1440px.png`, `phase3_referrals_1440px.png`, `phase3_profile_hq_1440px.png`, `phase3_admin_1440px.png`, `phase3_research_pro_390px_mobile.png`, `phase3_report_builder_390px_mobile.png`
- **Real PostgreSQL-Connected Customer Screenshots (`pg_e2e_*.png` via `scripts/e2e-postgres.mjs`):**
  - **Pending Owner `.env.local` Provisioning.** `scripts/e2e-postgres.mjs` has been extended to capture all required desktop (`1440px`) and mobile (`390px`) screenshots (including homepage, registration/onboarding, dashboard, Profile HQ, report builder, membership, and admin) plus a full `next start` process restart check once connected to the owner's PostgreSQL instance.
