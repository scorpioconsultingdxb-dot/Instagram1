# Viewora — Security & Privacy Review (Stage 1 Independent PostgreSQL)

## 1. Zero Supabase Runtime Dependency

- Removed `@supabase/supabase-js` and `@supabase/ssr` from `package.json`.
- Deleted `src/lib/supabase/` and legacy `supabase/` directories after translating all schema constraints, triggers, and RLS policies into Prisma + PostgreSQL migrations.
- Removed `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `https://*.supabase.co` from `.env.example`, `src/lib/env.ts`, and `next.config.ts` CSP headers.

## 2. Independent Authentication & Session Security

- **Password Hashing:** `bcryptjs` with cost factor `12` (`BCRYPT_COST_FACTOR = 12`). Passwords are never stored or logged in plaintext.
- **Revocable Database Sessions + Auth.js v5:** `POST /api/auth/login` and `POST /api/auth/signup` issue cryptographically random 32-byte tokens whose SHA-256 hashes are stored in PostgreSQL `sessions` (`HttpOnly`, `SameSite=Lax`, `Secure` in production). Logout (`POST /api/auth/logout`), password change (`POST /api/auth/change-password`), and password reset (`POST /api/auth/reset-password`) immediately set `revoked_at` in PostgreSQL so stale tokens cannot be replayed.
- **Single-Use Hashed Security Tokens:** Email verification (`email_verification_tokens`, 24h TTL) and password reset (`password_reset_tokens`, 30m TTL) store only SHA-256 digests, invalidate prior unused tokens, and enforce single-use `consumed_at` checks.
- **No Production Token Leakage:** Raw verification and reset tokens are never written to production logs (`NODE_ENV === 'production'` suppresses local dev mail capture). External email delivery remains inactive until configured.
- **Login Rate Limiting & Anti-Enumeration:** Sliding-window IP and email rate limits (`src/lib/auth/rate-limit.ts`) return HTTP `429` with `Retry-After`. Login performs timing-balanced bcrypt verification and returns generic `"Invalid email or password."` errors; forgot-password returns an identical generic response regardless of account existence.
- **Safe Redirects & Demo Isolation:** `sanitizeRedirectPath()` rejects external URLs, `//evil.com`, and backslash bypasses. `DEMO_MODE_ENABLED` defaults strictly to `false`.

## 3. Database Security, RLS & Multi-Tenant Isolation

- **Least-Privilege Roles:** Docker init script (`docker/postgres/init-databases.sh`) separates `viewora_admin` (migrations/backups) from `viewora_app` (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`) for runtime queries.
- **Defense-in-Depth Isolation:**
  1. Repository layer (`src/lib/db/repositories/workspace.repo.ts`) explicitly verifies `workspace_members` membership (`assertWorkspaceMember`) and scopes all customer mutations to `userId`, throwing `WorkspaceAuthorizationError` on cross-account/cross-workspace attempts.
  2. Native PostgreSQL Row-Level Security (`prisma/migrations/20261125000002_postgres_rls_and_roles/migration.sql`) enforces row isolation via transaction-local `app.current_user_id()` and `app.is_workspace_member(workspace_id)`.
  3. **Private Research Notes Privacy:** `profile_research_notes` intentionally excludes admin bypass in both repositories and PostgreSQL RLS policies.
- **Parameterized Queries:** All queries execute via Prisma ORM parameterized bindings or tagged-template `$queryRaw` / `$executeRaw`.
- **Local File Storage Isolation:** `LocalFileStorage` (`src/lib/storage/local-files.ts`) restricts keys to `<ownerId>/<namespace>/<fileName>`, validates path containment against traversal, and rejects cross-account reads/deletes.
- **Prisma Studio & PostgreSQL Exposure:** Bound strictly to `127.0.0.1` in `docker-compose.yml` and `package.json`.

## 4. Authorization, HTTP Headers & Payment Lock

- Server-side RBAC (`src/lib/admin/rbac.ts`) guards all `/[locale]/admin/*` and `/api/admin/*` routes (`401`/`403`) with durable `audit_logs` records.
- Centralized server-side entitlements (`assertEntitlement`) enforce plan quotas and overrides.
- HTTP security headers (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`) configured in `next.config.ts`.
- `PAYMENTS_ENABLED=false` and `payments_enabled` feature flag locked `false`; Stripe checkout/webhook endpoints return `503`.

## 5. Privacy & Compliance (GDPR / LGPD / UAE PDPL)

- Self-service Personal Data Export (`GET /api/auth/export-data`) logs a `DataExportRequest` and exports strictly customer-owned account, preference, workspace, and entitlement data.
- Confirmed Account Deletion (`POST /api/auth/delete-account`) requires exact email confirmation, cascades user-owned records via PostgreSQL FKs, deletes customer local storage files, revokes active sessions, and preserves anonymized audit/deletion records (`AccountDeletionRequest`, `AuditLog`).
- **Legal Notice:** Public Privacy, Terms, and Cookie policies remain structured drafts requiring counsel review before commercial launch.
