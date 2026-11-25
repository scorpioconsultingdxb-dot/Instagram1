# Viewora — End-to-End Customer Functionality Audit Report

**Date:** 2026-11-25  
**Verification Mode:** **Verified Live Against PostgreSQL 14.25 (`viewora` via `viewora_app` & `viewora_test` via `viewora_test_app`) + Strict Scenario A Read-Only Prod Verification**

---

## 1. Verified Customer Workflows & Persistence Matrix

| Customer Area | PostgreSQL Persistence | RLS / Security Enforcement | Live Verification Status |
| --- | --- | --- | --- |
| **Public Site (Homepage, 12 Tools, Pricing, 11 Info Pages, 5 Locales)** | Stateless / Static + Optional PG Read | Public read-only (zero disk writes) | **Verified Live (Scenario A: 78/78 HTTP 200 + Scenario B 1440px/390px)** |
| **Customer Registration, Login, Logout & Revocable Sessions** | `users`, `sessions`, `consent_records` | Bcrypt cost 12, SHA-256 opaque tokens, `HttpOnly`, `SameSite=Lax`, CSRF origin guard | **Verified Live (UI Signup/Login + `test:db` + Full `next start` Restart)** |
| **Email Verification & Password Reset** | `email_verification_tokens`, `password_reset_tokens` | Single-use SHA-256 token hashes; revokes sessions on reset | **Verified Live (`npm run test:db`)** |
| **4-Step Onboarding (7 Segments, 7 Goals, Save & Resume)** | `users.segment`, `users.onboarding_completed`, `user_preferences` (`hqExtended`) | `user_preferences_owner_only` RLS | **Verified Live (`test:db` + `test:e2e:pg`)** |
| **Personal Digital HQ 2.0 (Bio, Title, Interests, Avatar/Cover Presets, Shortcuts, Theme, Locale)** | `users` + `user_preferences` (`hqExtended`) | `user_preferences_owner_only` RLS | **Verified Live (`test:db` + `test:e2e:pg` Across Process Restart)** |
| **Dashboard Widget Visibility & Walkthrough Dismissal** | `user_preferences` (`hqExtended.widgetVisibility`) | `user_preferences_owner_only` RLS (removed browser-only `localStorage`) | **Verified Live (`test:db` + `test:e2e:pg` Across Process Restart)** |
| **Saved Public Profiles, Folders, Tags & Private Notes** | `workspaces`, `workspace_members`, `research_folders`, `saved_profiles`, `profile_snapshots`, `profile_research_notes` | Workspace-member RLS + `pg_advisory_xact_lock` quota lock; **zero admin bypass on private notes** | **Verified Live (`test:db` + `test:e2e:pg` Across Process Restart)** |
| **Research Workspace Pro (Projects, Filters, Safe CSV Import)** | `user_preferences._modules.researchPro` + `saved_profiles` | `user_preferences_owner_only` RLS + formula sanitization | **Verified Live (Unit + PG RLS Module Storage Tests)** |
| **Professional Report Builder & AI Reports Library** | `ai_reports`, `report_exports`, `user_preferences._modules.customReports` | Workspace-member & owner-only RLS; CSV formula neutralization | **Verified Live (`test:db` + `test:e2e:pg` Across Process Restart)** |
| **Agency Multi-Client Collaboration & Workflow Automation** | `user_preferences._modules.agencyOrg` & `_modules.automation` | Owner-only RLS; isolated team comments; external triggers honestly blocked | **Verified Live (Unit + PG RLS Module Storage Tests)** |
| **Customer Support Tickets** | `support_tickets`, `support_messages`, `support_ticket_status_history` | `support_tickets_owner_or_support` RLS (`{ userId, role: 'user' }` enforced on `GET /api/support`) | **Verified Live (`test:db` + `test:e2e:pg` Across Process Restart)** |
| **Membership, Entitlements & Billing Preview** | `plans` (5), `plan_billing_options` (15), `plan_entitlements` (65), `subscriptions`, `user_entitlement_overrides` | Server-side enforcement; `PAYMENTS_ENABLED=false` strictly locked | **Verified Live (`test:db` + `test:e2e:pg`)** |
| **GDPR/LGPD/PDPL Data Export & Confirmed Account Deletion** | `data_export_requests`, `account_deletion_requests`, `ON DELETE CASCADE` | Exact email confirmation; purges DB rows, sessions, and uploaded files | **Verified Live (`test:db` + `test:e2e:pg`)** |
| **Administration & RBAC (`db:bootstrap-admin`)** | `audit_logs`, `feature_flags`, `cms_content`, `broadcast_notifications`, `users` | Server-side capability checks; `payments_enabled` toggle rejected with `HTTP 403` | **Verified Live (`test:db` + `test:e2e:pg`)** |

---

## 2. Verified Live PostgreSQL-Connected Screenshots (Visually Inspected)

All 11 screenshots below were captured directly from the production `next start` server connected to live **PostgreSQL 14.25** (`viewora` via `viewora_app`, `DEMO_MODE_ENABLED=false`, `PAYMENTS_ENABLED=false`) with **`0` console errors** and **`0` page errors** (`C:\Users\Scorpio\.gemini\antigravity\brain\36811d4f-f53f-4027-a394-ebcca0dde9f6\`):

1. `pg_e2e_home_1440px.png` — Live Homepage (Desktop `1440px`)
2. `pg_e2e_home_390px.png` — Live Homepage (Mobile `390px`, `0px` overflow)
3. `pg_e2e_register_1440px.png` — Real Account Registration Form (zero unavailable warnings)
4. `pg_e2e_onboarding_1440px.png` — Authenticated Onboarding persisted to PostgreSQL
5. `pg_e2e_dashboard_1440px.png` — Customer Dashboard (`PG Verified Folder`, `@viewora.studio`, `#pg-e2e`, private note persisted)
6. `pg_e2e_dashboard_390px.png` — Customer Dashboard (Mobile `390px`, `0px` overflow)
7. `pg_e2e_profile_hq_1440px.png` — Personal Digital HQ (`PG Persistence Lead`, `Midnight` cover, `Independent PostgreSQL` badge)
8. `pg_e2e_report_builder_1440px.png` — Report Builder (`PG Verified Executive Brief`, persisted in PostgreSQL)
9. `pg_e2e_membership_1440px.png` — Membership & Pricing (5 tiers, payments strictly disabled)
10. `pg_e2e_login_1440px.png` — Post-Server-Restart Sign-In Page
11. `pg_e2e_admin_1440px.png` — Administrator Console (`SUPER_ADMIN`, real PostgreSQL accounts, tickets, audit log)

> **Separate Classification:** Earlier Scenario A (`recovery_*.png`) screenshots represent no-DB read-only public resilience; earlier Phase 3 (`phase3_*.png`) screenshots represent isolated local demo UI captures and are kept strictly separate from the live PostgreSQL evidence above.
