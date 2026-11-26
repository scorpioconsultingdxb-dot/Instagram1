# Viewora — API & Data Security Report (Updated Phase 5 — Stages 42–45)

**Date:** 2026-11-26  
**Scope:** External API credential handling, AES-256-GCM OAuth token encryption, HMAC user-bound OAuth CSRF state, outbound SSRF allowlists, bounded response decoding, webhook signature & replay verification, tenant-scoped caching, concurrent quota enforcement, safe image decoding, and PostgreSQL audit-log immutability.

---

## 1. Stage 41–45 External API & Integration Security Controls

| Security Control | Implementation | Verified By |
| :--- | :--- | :--- |
| **Server-Side-Only Credentials & Dual-Key Activation** | All provider keys reside strictly in server `process.env` ([env.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/env.ts)); zero `NEXT_PUBLIC_*` secret variables. Every external provider requires BOTH `PROVIDER_*_ENABLED=true` AND non-placeholder secrets ([credentials.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/credentials.ts)). | `gateway.test.ts` |
| **AES-256-GCM OAuth Token Encryption at Rest** | [token-crypto.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/security/token-crypto.ts) encrypts OAuth tokens using HKDF-SHA256 derived 256-bit key + fresh random 96-bit IV + GCM auth tag (`v1:<iv>:<tag>:<cipher>`). Raw DB column stores ciphertext only; `listUserProviderConnections()` strips token fields; disconnect immediately nulls `encrypted_access_token`. | `phase5-stages-42-to-45.test.ts`, live PG `test:db` (`viewora_test`) |
| **User-Bound HMAC-SHA256 OAuth CSRF State** | [oauth.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/meta/oauth.ts) signs `userId.exp.nonce` with timing-safe verification (`10m` TTL) + `HttpOnly` `SameSite=Lax` cookie, rejecting cross-user or tampered callbacks. | `phase5-stages-42-to-45.test.ts` |
| **Strict Outbound SSRF Allowlists** | [ssrf.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/ssrf.ts) enforces per-provider HTTPS port-443 host allowlists (`graph.facebook.com`, `graph.instagram.com`, configured vendor host) and blocks `http://`, loopback (`127.0.0.1`/`::1`), RFC1918 (`10/8`, `172.16/12`, `192.168/16`), cloud IMDS (`169.254.169.254`), embedded credentials, and non-443 ports. | `phase5-stages-42-to-45.test.ts` |
| **Bounded Upstream JSON Decoding** | `readBoundedResponseJson()` enforces a hard `1 MB` payload ceiling before JSON parsing to prevent memory exhaustion from malicious/misbehaving upstreams. | `phase5-stages-42-to-45.test.ts` |
| **Meta Webhook Integrity & Replay Protection** | [/api/webhooks/meta](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/webhooks/meta/route.ts) enforces `256 KB` body ceiling, timing-safe `X-Hub-Signature-256` HMAC-SHA256 verification, durable PostgreSQL `webhook_events` deduplication, and automatic token revocation on permission-revoke events. | `phase5-stages-42-to-45.test.ts` (signature/error normalization) |
| **Tenant-Scoped Cache Isolation** | `buildTenantScopedCacheKey()` binds authorized-owner cache keys to `userId` and/or `workspaceId`, eliminating cross-customer authorized cache bleed. | `phase5-stages-42-to-45.test.ts` |
| **Secret & PII Log Redaction** | `redactSecretsAndPii()` scrubs `Bearer ...`, query `key=`/`token=`/`secret=`, `AIza*`/`sk_*`/`EAA*` prefixes, `postgresql://` URLs, and emails before storing in memory or PostgreSQL `api_usage_logs`. | `gateway.test.ts` |
| **Upstream Zod Validation, Timeouts & Circuit Breakers** | `ExternalApiGateway` enforces `AbortController` timeouts, bounded retries strictly on transient errors, circuit breakers, and strict Zod schema validation. | `gateway.test.ts` |
| **RBAC-Protected Integration Center & Kill Switches** | `/api/admin/integrations` & `toggle_api_kill_switch` enforce `requireAdminApi()`, `Cache-Control: private, no-store`, CSRF origin checks, and append-only audit logging. | `test:e2e:pg`, `test:db` |
| **Privacy & Compliance Guardrails** | Every adapter enforces `supportsPrivateAccounts: false` and `requiresInstagramCredentials: false`. Private account responses halt fallback immediately. | `gateway.test.ts`, `registry.test.ts` |

---

## 2. Phase 4.1 Security Hardening Baseline (Preserved & Verified)

- **Atomic Media Quota Enforcement:** `saveDbUserMediaWithQuota()` uses `pg_advisory_xact_lock` to serialize concurrent avatar/cover uploads against the 3 MB per-customer cap (live PG `test:db`: 1 succeeds, 1 rejects `QUOTA_EXCEEDED`).
- **Safe Image Decoding:** [image-validation.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/storage/image-validation.ts) parses PNG/JPEG/WebP binary headers in pure TypeScript, blocking SVG/HTML polyglots, MIME spoofing, zero dimensions, `> 8192px`, and `> 25 MP` decompression bombs.
- **Append-Only Audit Logs (Migration 5) & Honest Superuser Limitation:** `REVOKE UPDATE, DELETE, TRUNCATE` on `public.audit_logs` + `trg_audit_logs_immutable` trigger (`ERRCODE 42501`, preserving `ON DELETE SET NULL` RI cascades). Honest limitation: a compromised DB superuser (`postgres`) could disable triggers via DDL; runtime apps strictly use restricted `viewora_app`, and an external WORM SIEM sink is recommended in hosted production.
