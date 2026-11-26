# Viewora — Comprehensive Security Review & Penetration Test Scope Report (Updated Stage 68)

**Date:** 2026-11-26  
**Dependency Security Posture:** **`0` Production Vulnerabilities (`npm audit --omit=dev`) · `0` Total Workspace Vulnerabilities (`npm audit` across all 401 packages)**  
**Stage 68 Security Upgrades Completed:** Actual binary image payload decoding verification ([`src/lib/storage/image-validation.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/storage/image-validation.ts)) + Chromium PDFium visual verification of multilingual `%PDF-1.4` exports (`pt-BR` & `de`).

---

## 1. Complete 18-Domain Security Control Verification Matrix

| # | Security Domain | Verified Control & Stage 68 Enhancement | Verification Evidence |
| :-: | :--- | :--- | :--- |
| 1 | **Authentication** | Independent bcrypt password hashing, single-use expiring verification/reset tokens, zero Instagram password collection | `auth-security.test.ts`, `db-persistence.test.ts` |
| 2 | **Session Management** | Server-side revocable PostgreSQL sessions, `HttpOnly`/`SameSite` cookies, Admin "Revoke All Active Sessions", full restart persistence | `test:db` + `test:e2e:pg` |
| 3 | **OAuth & CSRF State** | HMAC-SHA256 user-bound OAuth CSRF state + origin verification (`isAllowedCsrfOrigin`) on all state-changing endpoints | `phase5-stages-42-to-45.test.ts` |
| 4 | **Token Encryption** | **AES-256-GCM** authenticated encryption (`src/lib/security/token-crypto.ts`) for `provider_connections` | Unit + live PG `test:db` |
| 5 | **Row-Level Security (RLS)** | **24 PostgreSQL RLS policies** enforced under restricted `NOBYPASSRLS` `viewora_app` / `viewora_test_app` | `npm run test:db` (9/9) |
| 6 | **RBAC & Admin Guardrails** | Server-side RBAC on `/api/admin/*`, `pg_advisory_xact_lock` Last-Super-Admin lock (`HTTP 409`), self-suspension block (`HTTP 400`) | Live PG `test:db` |
| 7 | **CSRF Protection** | Strict origin/referer verification across all POST/PATCH/DELETE API routes | Unit + live PG E2E |
| 8 | **XSS & Export Safety** | React escaping, strict CSP (`default-src 'none'` on media responses), `X-Content-Type-Options: nosniff`, CSV formula-injection neutralization, WinAnsi `%PDF-1.4` visually verified in Chromium PDFium (`pdf_reader_pt_br_1440px.png`, `pdf_reader_de_1440px.png`) | `phase7-stage-68.test.ts` + PDFium proof |
| 9 | **SSRF Protection** | Strict per-provider HTTPS port-443 host allowlists (`src/lib/integrations/ssrf.ts`) + `1 MB` bounded JSON decoding | `phase5-stages-42-to-45.test.ts` |
| 10 | **IDOR & Tenant Isolation** | Workspace/user ownership enforced both in repository queries AND PostgreSQL RLS policies; private customer notes inaccessible to admins | Live PG `test:db` cross-tenant tests |
| 11 | **Webhook Authentication** | Raw-body HMAC-SHA256 verification (Meta 256 KB cap + Resend Svix) + durable `webhook_events` replay deduplication | Unit + live PG `test:db` |
| 12 | **Scheduler Authentication** | Constant-time `CRON_SECRET` (`crypto.timingSafeEqual`) + replay/rate limiting on `POST /api/jobs/run` | `phase5-stages-46-to-50.test.ts` |
| 13 | **API Spending Limits** | Atomic `pg_advisory_xact_lock` integer micro-USD `cost_budgets`, 50/75/90/100% alerts, durable Global & Per-Provider Emergency Halts | Live PG `test:db` #8–#9 |
| 14 | **Customer Data Isolation** | Private research notes excluded from shared PDF/CSV exports and excluded from external AI unless explicitly opted in | `phase4-1.test.ts` + `phase5-stages-46-to-50.test.ts` |
| 15 | **Upload Security (Stage 68 Upgraded)** | **Actual binary payload decode verification (`decodeVerified: true`)**: PNG chunk-by-chunk IEEE CRC-32 + bounded `zlib.inflateSync` scanline & filter-byte verification; JPEG full SOF→SOS→entropy→EOI walk; WebP exact RIFF size + mandatory VP8/VP8L bitstream verification; rejects header-only stubs, bad CRCs, corrupted zlib, embedded EXIF/tEXt/COM scripts, trailing polyglots, and decompression bombs (`≤ 8192px`, `≤ 25 MP`, `3 MB` atomic user quota) | `phase7-stage-68.test.ts` (4/4 passing) + `phase4-1.test.ts` |
| 16 | **Audit Protection** | Migration 5 `REVOKE UPDATE/DELETE/TRUNCATE` + `trg_audit_logs_immutable` (`ERRCODE 42501`) + `auditLogsDeleted: 0` in retention engine | Live PG `test:db` #6 |
| 17 | **Backup Security** | AES-256 PBKDF2 encrypted `pg_dump -Fc` + write-only off-host WORM bucket architecture (**Linux staging drill pending Gate #4**) | [BACKUP_RESTORE_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/BACKUP_RESTORE_REPORT.md) |
| 18 | **Secret Management & Zero CVEs** | `0/401` npm advisories; placeholder rejection; zero server keys in `NEXT_PUBLIC_*`; `.env.local` git-ignored | `npm audit`, `npm run env:check` |

---

## 2. Independent External Penetration Testing Scope (To Execute on Hosted HTTPS Staging)

Prior to Commercial GA, commission an independent CREST/OSCP-accredited gray-box web application & API penetration test against `https://staging.<owner-domain>` covering:
1. **Authentication & Session Attacks:** Brute-force/credential stuffing, session fixation, token entropy, password reset race conditions, cross-tenant session revocation.
2. **Multi-Tenant Authorization (IDOR / BOLA / BFLA):** Horizontal cross-customer data access across `/api/dashboard/*`, `/api/reports/builder`, `/api/ai/studio`, `/api/auth/media`, and vertical privilege escalation to `/api/admin/*`.
3. **File Upload & Parser Fuzzing:** Malformed/polyglot PNG/JPEG/WebP uploads against `/api/auth/media` and CSV formula/encoding fuzzing.
4. **SSRF, Webhook & Scheduler Abuse:** Webhook signature bypass/replay on `/api/webhooks/{meta,resend}`, `CRON_SECRET` timing/replay probes on `/api/jobs/run`, OAuth redirect manipulation on `/api/meta/oauth/*`.
5. **AI Prompt Injection & Data Exfiltration:** Attempted extraction of system instructions, cross-tenant context, or non-opted-in private research notes via `/api/ai/studio`.
6. **Edge & TLS Hardening:** TLS 1.3 cipher suite, HSTS, CSP, cookie flags, rate-limiting bypass, and closed beta `/api/beta` invite brute-force resistance.
