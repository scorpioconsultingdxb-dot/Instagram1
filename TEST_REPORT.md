# Viewora — Comprehensive Test & Verification Report (Updated Phase 5 — Stages 42–45)

**Date:** 2026-11-26  
**Database Safety:** All synthetic and destructive integration/E2E tests executed **exclusively against isolated `viewora_test`** under restricted `viewora_test_app` (`NOBYPASSRLS`). Operational `viewora` verified **100% untouched** post-run.  
**External API Honesty Note:** All external paid/live providers remain disabled by default (`PROVIDER_*_ENABLED=false`). External provider adapter tests verify local contracts, crypto, SSRF allowlists, bounded parsing, routing, and error normalization — **NOT** live upstream Meta/vendor/Gemini/Resend API calls.

---

## 1. Executed Automated Verification Suite Summary

| Suite / Command | Scope | Result |
| :--- | :--- | :--- |
| `npm run env:check` | `.env.local` integrity, 4 live PG connection probes (`viewora`, `viewora_test`, runtime & admin), zero Supabase, `PAYMENTS_ENABLED=false` | **PASS — `ok: true`, 4/4 connections healthy, 0 errors, 0 warnings** |
| `npm run db:health` | Live operational `viewora` PostgreSQL health check | **PASS — `healthy`, `95ms`, `users: 1`, `plans: 5`, `featureFlags: 5`** |
| `prisma migrate deploy` (admin & test-admin) | Applied additive Migration 6 (`20261126000001_profile_snapshots_rls`) to both `viewora` and `viewora_test` | **PASS — 6/6 migrations applied cleanly on both DBs** |
| `prisma validate` | Prisma schema validation | **PASS — valid** |
| `npm run typecheck` | TypeScript `tsc --noEmit` across entire codebase | **PASS — 0 errors** |
| `npm run lint` | ESLint `eslint .` | **PASS — 0 errors, 0 warnings** |
| `npm audit --omit=dev` | Production dependency graph vulnerability audit | **PASS — 0 vulnerabilities** |
| `npm test` (`vitest run`) | Unit, security, i18n, tools, entitlements, Phase 3–4.1, Stage 41 gateway, and **Stage 42–45** (AES-256-GCM crypto, Meta OAuth CSRF/scopes/errors/webhooks, SSRF allowlist & 1 MB JSON ceiling, capability router & tenant cache keys, Profile Intelligence, historical trends, Competitor Benchmarking) | **PASS — 21/21 files · 101/101 tests passed** |
| `npm run test:db` | Live PostgreSQL 14.25 integration on `viewora_test` (`viewora_test_app` + `postgres`): 58 tables, 24 RLS policies, private notes, Migration 5 `audit_logs` immutability, concurrent media quota & Last-Super-Admin locks, **AND Stage 42–45** (encrypted `provider_connections` RLS + disconnect scrub, deduplicated `profile_snapshots` + SQL history entitlement + Migration 6 raw-SQL RLS check, `FOR UPDATE SKIP LOCKED` concurrent `background_jobs` claim + retry, concurrent `pg_advisory_xact_lock` distributed USD budget cap + persistent kill switch) | **PASS — 1/1 file · 8/8 live PostgreSQL tests passed** |
| `npm run build` | Production Next.js `15.5.29` build (including `/api/jobs/run`, `/api/meta/*`, `/api/webhooks/meta`) | **PASS — 307/307 static pages generated** |
| `npm run test:e2e:pg` | Full headless Chromium E2E against production `next start` + live `viewora_test` (process restart persistence, Free-tier `tracked_profiles` `403` enforcement, `refresh_profile` `live_providers_disabled`, `/api/meta/connections` `oauthEnabled: false`, Profile Intelligence expanded breakdown, Agency Competitor Studio matrix, `%PDF-1.4` download, Admin Integration Center `distributedTelemetry.backend === 'postgresql'` desktop `1440px` + mobile `390px`) | **PASS — 7/7 milestones · 19 screenshots · 0 consoleErrors · 0 pageErrors** |
| `inspect_test_data.mjs` | Read-only 58-table audit of operational `viewora` DB | **PASS — `users: 1` (`Scorpio Marketing Agency`), `support_tickets: 0`, `audit_logs: 6`** |

---

## 2. Real Defect Caught & Remediated During Testing

- **Cross-Tenant `profile_snapshots` Isolation Gap:** Live PostgreSQL test #8 caught that `profile_snapshots` lacked its own database-level RLS policy and `snapshots.repo.ts` lacked a parent `savedProfile: { userId }` ownership predicate. Remediated immediately at BOTH layers (`snapshots.repo.ts` + Migration 6 `20261126000001_profile_snapshots_rls`), then re-verified with both repository and raw SQL RLS assertions under `viewora_test_app` (`0` rows leaked).

---

## 3. Recorded Environment Constraints (Honest Disclosure)

- **Workstation Backup Re-Drill:** Local Windows Application Control policy blocks `pg_dump.exe` / `pg_restore.exe` (never bypassed). Verified baseline snapshot `backups/viewora_viewora_20261125T190858Z.dump` remains preserved; automated Linux drills are queued for hosted staging.
- **Dev-Only Test Runner Advisories:** 3 advisories remain strictly inside `devDependencies` (`vitest@3.2.7` / `tinypool` / `@vitest/mocker`); zero production impact (`npm audit --omit=dev` = `0`).
- **Live External Providers & Hosted Lighthouse:** External APIs remain disabled by owner policy; hosted Lighthouse/CWV and manual screen-reader verification require hosted HTTPS staging.
