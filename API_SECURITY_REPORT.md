# Viewora — API, AI, Email & Integration Security Report (Updated Stage 50)

**Date:** 2026-11-26  
**Scope:** End-to-end security verification across Stages 41–50.

---

## 1. Verified Security Controls Matrix

| Control Area | Implementation | Verified By |
| :--- | :--- | :--- |
| **OAuth CSRF, Expiration & User Binding** | HMAC-SHA256 signed `userId.exp.nonce` state (`10m` TTL, timing-safe check) + `HttpOnly` `SameSite=Lax` cookie ([oauth.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/meta/oauth.ts)) | `phase5-stages-42-to-45.test.ts` |
| **OAuth Token Encryption & Revocation** | AES-256-GCM (`v1:<iv>:<tag>:<cipher>`) with HKDF-SHA256 derived key ([token-crypto.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/security/token-crypto.ts)); versioned `v1:` prefix supports future key rotation; disconnect immediately nulls `encrypted_access_token` | `phase5-stages-42-to-45.test.ts`, live PG `test:db` #8 |
| **Outbound SSRF & Response Size Ceiling** | Per-provider HTTPS port-443 host allowlists blocking `http://`, loopback, RFC1918, IMDS `169.254.169.254`, embedded creds, non-443 ports ([ssrf.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/integrations/ssrf.ts)); `1 MB` JSON ceiling | `phase5-stages-42-to-45.test.ts` |
| **Webhook Signature & Replay Protection** | Meta (`X-Hub-Signature-256`) & Resend (`svix-id`/`svix-timestamp`/`svix-signature` 5-min drift check), `256 KB` payload caps, durable PostgreSQL `webhook_events` unique `(provider, event_id)` replay dedup | `phase5-stages-42-to-45.test.ts`, `phase5-stages-46-to-50.test.ts`, live PG `test:db` #9 |
| **AI Prompt-Injection & Data Minimization** | `<UNTRUSTED_PROFILE_DATA>` isolation, `sanitizeUntrustedAiContext`, `detectPromptInjectionSignals`, `detectUnsupportedClaims`, private notes excluded by default, secret/PII redaction | `phase5-stages-46-to-50.test.ts` |
| **Email Token & Unsubscribe Security** | Single-use hashed verification/reset tokens never logged; HMAC-SHA256 signed unsubscribe tokens; HTML-escaped templates blocking XSS | `auth-security.test.ts`, `phase5-stages-46-to-50.test.ts` |
| **Scheduler Authentication** | Constant-time `crypto.timingSafeEqual` check on `Bearer <CRON_SECRET>` (`>= 16` chars), rate limit (`20/min`), `runId` replay dedup, bounded batch (`1..10`) | `phase5-stages-46-to-50.test.ts` |
| **Atomic Quotas, Budgets & Job Leasing** | `pg_advisory_xact_lock` on Last-Super-Admin, 3 MB media quota, daily/monthly API budgets, and monthly AI quotas; `FOR UPDATE SKIP LOCKED` on `background_jobs` | Live PG `test:db` #7, #8, #9 |
| **Database RLS & Append-Only Audit Logs** | 24 PostgreSQL RLS policies (incl. Migration 6 `profile_snapshots_workspace_isolation`); Migration 5 `audit_logs` `REVOKE` + `trg_audit_logs_immutable` trigger | Live PG `test:db` #1–#9 |
| **Production Dependencies** | `npm audit --omit=dev` = **0 vulnerabilities** (3 dev-only advisories remain strictly in `vitest@3.2.7` test runner) | `npm audit --omit=dev` |

---

## 2. Documented Residual Security Limitations (Honest Disclosure)

1. **DNS Rebinding Note:** Outbound SSRF allowlists enforce exact static HTTPS hostnames + TLS SNI/certificate validation on Node's `fetch`; if dynamic customer-supplied URLs are ever introduced in future phases, add pre-connect DNS IP validation.
2. **DB Superuser DDL Limitation:** `audit_logs` immutability blocks runtime `viewora_app` and direct `postgres` DML, but a compromised OS/DB superuser can disable triggers via DDL — stream `audit_logs` to an off-host WORM SIEM sink in hosted production.
