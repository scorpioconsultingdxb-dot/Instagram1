# Viewora — Database & Application Security Report (Phase 4)

**Date:** 2026-11-25  
**Status:** **LIVE POSTGRESQL 14.25 RLS, RBAC & ISOLATION VERIFIED (`6/6` LIVE INTEGRATION TESTS PASS)**

---

## 1. Database Role Isolation & RLS Enforcement (Verified Live)
- **Least-Privilege Runtime Roles:** `viewora_app` (`viewora`) and `viewora_test_app` (`viewora_test`) both verified live with `rolsuper=false`, `rolbypassrls=false` (`npm run env:check` + `test:db`).
- **23 RLS Policies Across 16 Tenant/Privacy Tables:** Owner-only (`user_preferences`, including `hqExtended`, `_modules`, and durable `_media`; `notifications`; `provider_connections`; `consent_records`; `data_export_requests`), workspace-member-only (`saved_profiles`, `research_folders`, `profile_research_notes` with **zero admin bypass**, `comparison_projects`, `activity_events`, `ai_reports`, `report_exports`), owner-controlled `workspaces` & `workspace_members`, and `support_tickets`/`support_messages`.
- **Transaction-Local Context:** `withUserRlsContext()` uses `set_config(..., true)` (PgBouncer transaction-pooling safe).
- **Isolated Test-DB Hard Guards:** Both `scripts/e2e-postgres.mjs` and `src/lib/db/postgres.integration.test.ts` refuse to execute against non-test database names (`/(^|_)test($|_)/i`).

## 2. Application Security Controls Verified
- **Authentication & Sessions:** Bcrypt cost `12`, SHA-256 hashed 32-byte opaque tokens, `HttpOnly`/`SameSite=Lax`/`Secure` (prod) cookies, revocable DB sessions, single-use verification & password-reset tokens, immediate invalidation on password reset/suspension/admin session revocation.
- **Enterprise Admin Guards (Stage 39):** Last active `super_admin` cannot be demoted or suspended (`HTTP 409`); self-suspension/self-demotion/self-session-revocation blocked (`HTTP 400`); `payments_enabled` strictly locked (`HTTP 403`).
- **Input, Upload & Export Hardening:** CSRF origin verification on all mutating endpoints; Zod validation; magic-byte PNG/JPEG/WebP image validation stored durably in RLS-protected PostgreSQL `_media`; CSV formula-injection neutralization (`sanitizeCsvFormulaCell`); zero `@supabase` references; `.env.local` & `backups/` verified git-ignored; zero developer env var leaks in customer UI.

## 3. Dependency Vulnerability Scan (`npm audit --omit=dev`)
- **Measured Result (2026-11-25):** `0` critical · `6` high · `1` moderate (`7` total in transitive dependencies). Review and apply non-breaking lockfile updates during staging release preparation (tracked in `DEVELOPMENT_BACKLOG.md`).
