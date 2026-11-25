# Viewora — Stage 1 Supabase Removal Inventory & Translation Report

## 1. Audit Summary

Before modifying runtime code, the entire Viewora repository was audited for every dependency on Supabase (packages, environment variables, CSP headers, auth/session handlers, API routes, server stores, UI copy, i18n dictionaries, SQL migrations, tests, and documentation).

### Existing Supabase Export Check (Section 9)

- **Audit Result:** No Supabase database dump, SQL export, CSV export, or auth user export exists anywhere in the repository or workspace (`c:\Users\Scorpio\Videos\Instagram`).
- **Action Taken:** Initialized a clean, independent PostgreSQL database schema (`viewora` + `viewora_test`) via Prisma ORM and SQL migrations. No historical Supabase customer data was recovered or claimed as migrated, and no attempt was made to reconnect to or repair the old Supabase account.

## 2. Complete Inventory of Removed / Replaced Supabase Dependencies

| Category | Original File(s) | Supabase Dependency | Stage 1 Replacement |
| :--- | :--- | :--- | :--- |
| **NPM Packages** | `package.json`, `package-lock.json` | `@supabase/ssr`, `@supabase/supabase-js` | Removed completely. Replaced with `prisma`, `@prisma/client`, `next-auth` (Auth.js v5), `@auth/prisma-adapter`, `bcryptjs`. |
| **Client & Server SDKs** | `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` | Browser/server/service-role Supabase clients | Deleted completely. Replaced with `src/lib/db/prisma.ts`, `src/lib/db/repositories/*`, and `src/lib/auth/auth.ts`. |
| **Environment Config** | `.env.example`, `src/lib/env.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `isSupabaseConfigured()` | Removed completely. Replaced with `DATABASE_URL`, `TEST_DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_ADMIN_USER`, `POSTGRES_ADMIN_PASSWORD`, `AUTH_SECRET`, `AUTH_URL`, `isDatabaseConfigured()`. |
| **CSP Security Header** | `next.config.ts` | `https://*.supabase.co` in `connect-src` | Removed from Content Security Policy. |
| **Authentication & Session** | `src/lib/auth/session.ts`, `src/app/auth/callback/route.ts`, `src/app/api/auth/{login,signup,logout,forgot-password,preferences,profile,delete-account}/route.ts` | `supabase.auth.*`, `profiles`/`subscriptions` REST queries | Replaced with Auth.js v5 (`src/lib/auth/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`), Prisma database sessions (`Session`), bcrypt password hashing (`bcryptjs`, cost 12), hashed single-use verification & password-reset tokens (`POST /api/auth/reset-password`, `POST /api/auth/verify-email`, `POST /api/auth/change-password`), and login rate limiting. |
| **Data Persistence Stores** | `src/lib/auth/profile-prefs.ts`, `src/lib/dashboard/store.ts`, `src/lib/entitlements/service.ts`, `src/lib/admin/store.ts`, `src/lib/analytics/funnel.ts` | `createSupabaseServerClient()`, `createSupabaseAdminClient()`, `.from(...)` queries | Replaced with modular Prisma ORM repositories under `src/lib/db/repositories/` (`users`, `auth-tokens`, `profile-prefs`, `workspace`, `entitlements`, `admin`). |
| **File Storage** | Legacy storage path references | Supabase Storage assumption | Replaced with persistent local file storage abstraction (`src/lib/storage/local-files.ts`, stored outside Git in `/.viewora-storage/`). |
| **Health Endpoint** | `src/app/api/health/route.ts` | Reported `isSupabaseConfigured()` | Reports live PostgreSQL connectivity (`checkDatabaseHealth()` via `SELECT 1`) and configured state without Supabase. |
| **UI & Translations** | `src/app/[locale]/{login,register,forgot-password,reset-password,verify-email}/page.tsx`, `src/components/auth/*`, `src/components/profile/ProfileHeadquarters.tsx`, `src/i18n/dictionaries/*.ts`, `src/i18n/types.ts` | `supabaseConfigured` props, Supabase setup copy, unconfigured auth banners | Updated to `databaseConfigured` / independent PostgreSQL + Auth.js flows including functional password reset, email verification, and password change UI. |
| **Legacy SQL Migrations** | `supabase/migrations/20261124000001..20261125000004.sql`, `supabase/seed.sql` | `auth.users` FK, `auth.uid()` RLS helpers, Supabase seed | All tables, constraints, business rules, and RLS policies translated into `prisma/schema.prisma`, `prisma/migrations/20261125000001_initial_viewora_schema/migration.sql`, `prisma/migrations/20261125000002_postgres_rls_and_roles/migration.sql`, and `prisma/seed.ts`. Legacy `supabase/` directory removed after full translation. |
| **Automated Tests** | `src/lib/storage/db-persistence.test.ts` | Mocked Supabase clients | Replaced with Prisma repository integration tests, Auth.js/credential security tests, and cross-account/cross-workspace isolation tests. |
| **Documentation** | `README.md`, `ARCHITECTURE.md`, `SECURITY_REVIEW.md`, `PRODUCTION_READINESS.md`, `TEST_REPORT.md`, `CHANGELOG.md`, `docs/ENVIRONMENT.md`, `docs/DEPLOYMENT.md`, `docs/DATABASE_OPERATIONS.md` | Supabase setup, deployment, and readiness checklists | Updated completely to document self-hosted PostgreSQL, Docker Compose, Prisma ORM, Prisma Studio, Auth.js, and backup/recovery procedures. |

## 3. Translation of Legacy Supabase RLS Policies

Every security invariant from `supabase/migrations/20261124000002_rls_policies.sql`, `20261124000003_master_expansion.sql`, and `20261125000004_experience_upgrade.sql` has been translated into **two defense-in-depth layers**:
1. **Server-side repository authorization** (`src/lib/db/repositories/*`): every customer query scopes strictly by authenticated `userId` and verified `workspaceId` membership; role updates and admin routes require server-verified RBAC (`assertAdminPermission`).
2. **Native PostgreSQL Row-Level Security (RLS)** (`prisma/migrations/20261125000002_postgres_rls_and_roles/migration.sql`): replaces Supabase `auth.uid()` with transaction-local session context `current_setting('app.current_user_id', true)` and `current_setting('app.current_user_role', true)`, enforced for the least-privilege `viewora_app` database role.

| Legacy Supabase RLS Rule | Independent Viewora Security Equivalent |
| :--- | :--- |
| `profiles`: select/update own only, prevent role self-escalation; admin manage all | `users.repo.ts` + `profile-prefs.repo.ts` whitelist safe profile columns only; role changes restricted to `super_admin`/`admin` via `users.repo.ts` + PostgreSQL RLS policy on `users` & `user_preferences`. |
| `workspaces` & `workspace_members`: owner/member select, owner/admin modify | `workspace.repo.ts` verifies `workspace_members` membership before any read/write; PostgreSQL RLS `app.is_workspace_member(workspace_id)`. |
| `saved_profiles`, `research_folders`, `comparison_projects`, `ai_reports`, `report_exports`: workspace member only | Strict `where: { userId, workspaceId }` + membership verification in `workspace.repo.ts`; cross-account/cross-workspace access explicitly tested and rejected; PostgreSQL RLS enabled. |
| `profile_research_notes`: **workspace members only — admins intentionally excluded** | Private research notes are never exposed in admin APIs or admin overview queries, and PostgreSQL RLS on `profile_research_notes` omits admin bypass. |
| `notifications`: own user only | `workspace.repo.ts` scopes all notification reads/updates strictly to `userId`; PostgreSQL RLS enforces `user_id = app.current_user_id()`. |
| `plans`, `plan_billing_options`, `plan_entitlements`, `feature_flags`, `cms_content`, `broadcast_notifications`: public read active, admin write | Public read helpers filter published/active rows; mutations require server-side RBAC + audit log + `payments_enabled` immutable lock (`false`). |
| `support_tickets` & `support_messages`: customer sees own non-internal messages; support/admin manages all | Customer endpoints filter `userId` and `isInternalNote: false`; admin endpoints enforce `manage_support` RBAC permission. |
| `audit_logs`, `background_jobs`, `job_attempts`, `webhook_events`, `cost_budgets`, `system_settings`, `operational_metrics`: admin only | Exposed exclusively via RBAC-protected admin repositories and routes; never returned in customer APIs or data exports. |
| `handle_new_user()` trigger on `auth.users` | Replaced with atomic Prisma `$transaction` in `users.repo.ts` (`registerUserWithWorkspace`) that creates `User`, `UserPreference`, default `Workspace`, `WorkspaceMember(owner)`, Free `Subscription`, and `EmailVerificationToken` in one transaction. |
