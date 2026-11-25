# Viewora — API & Data Security Report (Stage 41 + Phase 4.1 Hardening)

**Date:** 2026-11-26  
**Scope:** External API credential handling, request/response validation, secret/PII redaction, concurrent media quota enforcement, safe image decoding, and PostgreSQL audit-log immutability limitations.

## 1. External API Security Controls

| Security Control | Implementation | Verified By |
| :--- | :--- | :--- |
| **Server-Side-Only Credentials** | All provider keys live exclusively in server `process.env` parsed via [env.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/env.ts). Zero `NEXT_PUBLIC_*` secret variables. | `gateway.test.ts` (`JSON.stringify(snapshot)` never contains raw tokens) |
| **Dual-Key Activation & Placeholder Rejection** | Providers require explicit `PROVIDER_*_ENABLED=true` AND non-placeholder secrets ([credentials.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/credentials.ts)). | `gateway.test.ts` |
| **Secret & PII Log Redaction** | `redactSecretsAndPii()` scrubs `Bearer ...`, query `key=`/`token=`/`secret=`, `AIza*`/`sk_*`/`EAA*` prefixes, `postgresql://` URLs, and email addresses before any log entry is stored. | `gateway.test.ts` |
| **Upstream Schema Validation** | Zod schemas validate Meta Business Discovery and licensed partner payloads inside `ExternalApiGateway` before mapping into Viewora models; invalid payloads fail closed (`validation_error`). | `gateway.test.ts` |
| **Timeout, Retry & Circuit Breaker Bounds** | `AbortController` timeouts (`1–30s`), max `0–3` retries ONLY on transient network/408/429/5xx errors (never retrying 401/403), and per-provider circuit breaker preventing cascading hangs. | `gateway.test.ts` |
| **RBAC-Protected Integration Center** | `GET /api/admin/integrations` enforces `requireAdminApi()`, `Cache-Control: private, no-store`, and returns only boolean readiness & missing variable names. | `test:e2e:pg` (`HTTP 200` for Super Admin, `allPaidProvidersDisabled: true`) |
| **Privacy Boundaries** | Every catalog adapter hard-codes `supportsPrivateAccounts: false` and `requiresInstagramCredentials: false`. Private account responses immediately halt fallback in `ProviderRegistry`. | `gateway.test.ts`, `registry.test.ts` |

## 2. Outstanding Phase 4.1 Security Verification Completed

### A. Concurrent Atomic Media Quota Enforcement
- Upgraded [user-module-state.repo.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/repositories/user-module-state.repo.ts) with `saveDbUserMediaWithQuota()`, acquiring `SELECT pg_advisory_xact_lock(hashtext('viewora:media_quota:' || userId))` inside the same PostgreSQL RLS transaction as the quota check and JSONB update ([media/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/auth/media/route.ts)).
- **Live PostgreSQL Proof (`test:db` on `viewora_test`):** Two parallel 1.8 MB uploads (`avatar` + `cover`) against the 3 MB per-customer cap serialize cleanly: strictly **1 succeeds** and **1 rejects with `QUOTA_EXCEEDED`** (`HTTP 413`).

### B. Safe Image Decoding & Bomb Prevention
- [image-validation.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/storage/image-validation.ts) parses PNG (`IHDR`), JPEG (`SOF*`), and WebP (`VP8`/`VP8L`/`VP8X`) headers in pure TypeScript without spawning unsafe native image decoders.
- Verified rejection of SVG/HTML/JS polyglots, MIME spoofing, truncated headers, zero dimensions, `> 8192px` dimensions, `> 25 MP` PNGs, and `10000×10000` WebP VP8X bombs (`phase4-1.test.ts`).

### C. Audit Log Mutation Protections & Documented Limitations
- **What IS Enforced in PostgreSQL (Migration 5 — verified in `test:db`):**
  1. `REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_logs FROM viewora_app, viewora_test_app;` — runtime application roles cannot execute `UPDATE`, `DELETE`, or `TRUNCATE` on `audit_logs`.
  2. `BEFORE UPDATE OR DELETE` trigger `trg_audit_logs_immutable` blocks direct mutations even from `postgres` (`ERRCODE 42501`), allowing strictly PostgreSQL's `ON DELETE SET NULL` RI cascade on `actor_id` when a user is deleted while verifying every forensic column (`id`, `actor_email`, `action`, `target_type`, `target_id`, `diff`, `ip_address`, `created_at`) is unchanged.
- **Honest Architectural Limitations (Documented Transparently):**
  1. A database **superuser** (`postgres`) who holds DDL privileges can still execute `ALTER TABLE public.audit_logs DISABLE TRIGGER trg_audit_logs_immutable` or `DROP TRIGGER` if compromised. Application runtime NEVER uses `postgres` (`viewora_app` is `NOSUPERUSER`, `NOBYPASSRLS`).
  2. `TRUNCATE` is revoked from runtime roles, and an `AFTER`/`BEFORE TRUNCATE` statement trigger or external WORM log sink (e.g., append-only cloud audit bucket / SIEM stream) is recommended in Phase 5 hosted production for cryptographic tamper-evidence beyond a single database host.
