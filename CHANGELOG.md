# Viewora — Changelog

## [Phase 5 — Stages 42–45: Social Data Integration, Intelligence Engines & Distributed PostgreSQL Controls] — 2026-11-26
### Added
- **Stage 42 (Official Meta API, SSRF Hardening & Capability Routing):**
  - Added AES-256-GCM authenticated OAuth token encryption (`src/lib/security/token-crypto.ts`), HMAC-SHA256 user-bound OAuth CSRF state & Graph API error normalization (`src/lib/meta/oauth.ts`), RLS-isolated `provider_connections` repository (`src/lib/db/repositories/provider-connections.repo.ts`), OAuth start/callback/disconnect routes (`/api/meta/oauth/start`, `/api/meta/oauth/callback`, `/api/meta/connections`), and 256 KB / HMAC / replay-deduplicated Meta webhooks (`/api/webhooks/meta`).
  - Added strict per-provider outbound HTTPS SSRF host allowlists & 1 MB bounded JSON response decoding (`src/lib/integrations/ssrf.ts`), plus deterministic capability-based routing, `COMMERCIAL_RIGHTS_BY_PROVIDER` licensing metadata, and tenant-scoped cache keys (`src/lib/integrations/router.ts`).
- **Stage 43 (Profile Intelligence Engine):**
  - Added 6-state Profile Intelligence analyzer (`src/lib/analytics/profile-intelligence.ts`), manual `refresh_profile` workspace API action (`src/app/api/dashboard/workspace/route.ts`), and upgraded `SavedProfilesModule` with per-card Refresh and expandable Intelligence Breakdown panels (completeness %, bio CTA/hashtag/mention signals, format mix, freshness age, missing-field disclosures).
- **Stage 44 (Historical Analytics, Migration 6 RLS & Durable PostgreSQL Jobs):**
  - Added deduplicated observed snapshot persistence (`recordProfileSnapshotWithDedup`), SQL-enforced `historical_analytics_days` lookback (`listProfileSnapshotsWithEntitlement`), and non-fabricated trend analysis (`computeObservedHistoricalTrends`) in `src/lib/db/repositories/snapshots.repo.ts`.
  - Added additive **Migration 6** (`20261126000001_profile_snapshots_rls`) enabling database-level Row-Level Security (`profile_snapshots_workspace_isolation`, bringing total RLS policies to **24**), applied to both `viewora` and `viewora_test`.
  - Added durable PostgreSQL background job queue (`src/lib/db/repositories/jobs.repo.ts`, `POST /api/jobs/run`) with `idempotency_key` deduplication, atomic `FOR UPDATE SKIP LOCKED` leasing, stale-lease recovery, exponential backoff, and dead-letter handling (`BACKGROUND_JOBS_ENABLED=false` by default).
- **Stage 45 (Compatibility-Checked Competitor Intelligence Studio):**
  - Added compatibility-aware benchmarking engine (`src/lib/analytics/competitor-benchmark.ts`) flagging mixed provenance & differing capture dates and excluding `null` metrics from averages.
  - Upgraded `CompetitorStudio.tsx` with `30D/90D/ALL` windows, metric column visibility pills, compatibility notice banners, formula-safe Matrix CSV export, and 1-click **Generate Competitor Report**.
- **Distributed PostgreSQL API Coordination & Super Admin Emergency Controls:**
  - Added `src/lib/integrations/distributed-store.ts` enforcing atomic `pg_advisory_xact_lock` USD spend caps (`cost_budgets` + `operational_metrics`), durable global & per-provider kill switches, redacted `api_usage_logs` persistence, durable UTC-day `search_events` quotas in `/api/search`, and an inactive/standby optional Upstash Redis adapter status check.
  - Upgraded Super Admin Integration Center (`AdminConsole.tsx`, `/api/admin/integrations`, `/api/admin/actions`) with `COORDINATION: POSTGRESQL DURABLE` status and confirmed Global & Per-Provider **Emergency Halt** controls.
- **Verification & 16 Deliverables:** Verified **21/21 unit suites (101/101 tests)**, **8/8 live PostgreSQL tests** (`viewora_test`), **307/307 static pages**, **7/7 live PG E2E milestones (19 screenshots, 0 errors)**, **0 production CVEs**, and **100% untouched operational `viewora` baseline**; authored/updated all 16 mandatory Phase 5 Stage 42–45 reports.

## [Phase 5 Preparation — Stage 41: External API Integration Readiness & Phase 4.1 Verification] — 2026-11-26
### Added
- **Centralized External API Integration Framework (`src/lib/integrations/`):** Typed provider contracts (`types.ts`), 7-provider capability & commercial licensing catalog (`catalog.ts`), dual-key server credential/flag guard + secret/PII redactor (`credentials.ts`), and `ExternalApiGateway` (`gateway.ts`) enforcing default-off flags, timeouts, bounded retries, circuit breakers, rate limits, TTL caching, in-flight deduplication, Zod payload validation, USD cost caps, kill switches, and redacted request logs.
- **Provider & AI Governance Wiring:** Wired `ExternalApiGateway` and explicit default-off `PROVIDER_*_ENABLED=false` flags across Meta Official, Authorized Insights, Licensed Third-Party, Permitted Public Dataset, and Gemini AI adapters; enforced authenticated customer `daily_searches` membership limits in `/api/search`.
- **Super Admin Integration Center:** Added RBAC-protected `GET /api/admin/integrations` and the **Integration Center** tab inside `AdminConsole` showing strictly non-secret readiness, circuit states, resilience/cache policies, USD spend vs. caps, compliance guards, and redacted logs.
- **Phase 4.1 Outstanding Hardening:** Implemented atomic PostgreSQL `saveDbUserMediaWithQuota()` (`pg_advisory_xact_lock`) preventing concurrent avatar/cover quota races; upgraded PDF export (`src/lib/reports/pdf.ts`) with full WinAnsiEncoding multilingual octal escapes (`pt-BR`, `es`, `de`, `fr`, `en`) and byte-exact `xref` structural verification.
- **Documentation & Verification:** Added `API_INTEGRATION_ARCHITECTURE.md`, `API_PROVIDER_COMPARISON.md`, `API_CONFIGURATION_GUIDE.md`, `API_SECURITY_REPORT.md`, `API_COST_CONTROL_REPORT.md`, `DATA_PROVENANCE_POLICY.md`, and `PHASE_5_READINESS_REPORT.md`; verified 20/20 unit suites (92/92 tests), 7/7 live PG tests, 305 static pages, 7/7 live PG E2E milestones (15 screenshots, 0 errors), and untouched operational `viewora` baseline.

## [Phase 4.1 — Stages 40.1–40.10: Security Hardening, Real PDF Export & Commercial Quality] — 2026-11-26
### Security & Database Governance
- **Stage 40.1 (Zero Production Advisories):** Remediated all 7 production vulnerabilities (`6 High, 1 Moderate → 0 Total` in `npm audit --omit=dev`) via compatible `zod@^4.6.7` upgrade and targeted SemVer overrides (`postcss@^8.5.33`, `effect@^3.22.5`, `deepmerge-ts@^8.0.2`).
- **Stage 40.9 (Migration 5 — Database-Enforced Audit Immutability):** Revoked `UPDATE`/`DELETE`/`TRUNCATE` on `public.audit_logs` from `viewora_app` and `viewora_test_app`, installed `BEFORE UPDATE OR DELETE` PostgreSQL trigger `trg_audit_logs_immutable` (`ERRCODE 42501`, preserving `ON DELETE SET NULL` RI cascades during account deletion), and revoked `CREATE ON SCHEMA public FROM PUBLIC`.
- **Concurrent Admin Locking:** Wrapped Last-Super-Admin demotion and suspension checks in PostgreSQL `pg_advisory_xact_lock(hashtext('viewora:super_admin_guard'))` (`HTTP 409 Conflict` on race attempts).
- **Stage 40.4 (Hardened Media Storage):** Added PNG (`IHDR`), JPEG (`SOF*`), and WebP (`VP8`/`VP8L`/`VP8X`) binary header dimension validation blocking truncated headers, zero dimensions, `> 8192px`, and `> 25 MP` decompression bombs, plus a `3 MB` per-customer total media quota (`HTTP 413`).

### Added & Enhanced
- **Stage 40.5 (Dashboard 3.0):** Added strictly owner/RLS-scoped `GET /api/dashboard/search`, wired debounced live workspace search + `sessionStorage` Recent items into `CommandPalette`, and upgraded Dashboard Overview to render widgets dynamically in persisted `widgetOrder` with HTML5 Drag-and-Drop + keyboard `ArrowUp`/`ArrowDown` controls.
- **Stage 40.6 (Real Binary `%PDF-1.4` Export & Studio 3.0):** Implemented pure TypeScript `%PDF-1.4` generator (`src/lib/reports/pdf.ts`), live `application/pdf` download endpoint (`GET/POST /api/reports/builder`), Report Studio 3.0 Live Preview, Search/Status filters, Archive/Restore, and Research Pro 1-click templates & Duplicate Project button.
- **Stage 40.7 (Retention UI):** Added Notification Category filter pills, real Workspace Activity Summary, contextual Help Center links, and in-app Product Feedback / Feature Request form (`/api/feedback`).
- **Stage 40.8 (Super Admin 3.0):** Added Customer Detail Drawer with confirmed **Revoke All Active Sessions**, live **PostgreSQL Health** badge/card, read-only **Backup Archive Status**, and **Activation Funnel Milestones**.
- **Stage 40.10 (Verification & Reports):** Expanded test suite to **19/19 unit suites (89/89 tests)**, **7/7 live PostgreSQL integration tests**, **304/304 static pages**, **7/7 live PG E2E milestones (14 screenshots, 0 errors)**, **78/78 Scenario B no-DB routes**, and authored all 14 Phase 4.1 engineering & governance reports while keeping operational `viewora` 100% untouched.

## [Phase 4 — Stages 31–40] — 2026-11-25
### Added
- **Stage 31:** User-controlled `[data-reduced-motion="true"]` & `[data-high-contrast="true"]` CSS hooks, `.viewora-skeleton` shimmer, and `.viewora-glass` utilities.
- **Stage 32:** Genuine first-party PostgreSQL activation funnel events (`onboarding_completed`, `first_saved_profile`, `first_project_created`, `first_report_created`) with live-DB zero-fabrication enforcement.
- **Stage 33:** Durable PostgreSQL RLS customer media storage (`_media` in `user_preferences`) eliminating ephemeral filesystem reliance for avatar/cover uploads, plus account-persisted Accessibility Preferences in Personal Digital HQ 3.0.
- **Stage 34:** Client-safe `dashboard-presets.ts` with 5 Dashboard Layout Presets (`personal`, `creator`, `business`, `marketing`, `agency`) and keyboard-accessible widget reordering persisted to PostgreSQL.
- **Stage 35:** Server-side research project duplication (`duplicate_project`) and RLS-backed PostgreSQL persistence for Research Workspace Pro.
- **Stage 36:** Expanded Report Studio 3.0 to all 10 required templates (`social_profile_audit`, `influencer_research`, `campaign_review`, plus all existing templates) persisted in PostgreSQL RLS.
- **Stage 37:** In-app Customer Feedback & Feature Request API (`/api/feedback`) persisted to PostgreSQL `support_tickets` + `audit_logs`.
- **Stage 38:** Native PostgreSQL `referrals.repo.ts` (`referral_codes`, `referral_attributions`, `affiliate_accounts`) with self-referral, duplicate, and 30-day window enforcement (`payoutsEnabled=false`).
- **Stage 39:** Hard Last-Super-Admin guard (`HTTP 409`), self-suspension block (`HTTP 400`), `revoke_user_sessions` admin action, and live `databaseHealth` in `/api/admin/overview`.
- **Stage 40:** Live PostgreSQL 14.25 activation, transactional test-data cleanup (`TEST_DATA_CLEANUP_REPORT.md`), isolated `viewora_test` guards, 86 unit tests, 6 live PG RLS tests, 303 static pages, live PG E2E restart persistence, and backup/restore fidelity drill.

## [Database Activation & Cleanup] — 2026-11-25
- Activated independent PostgreSQL 14.25 (`viewora` / `viewora_app`, `viewora_test` / `viewora_test_app`), added Migration 4 role grants, fixed Windows `pg_dump`/`restore.ps1`, bootstrapped permanent `Scorpio Marketing Agency` Super Admin, and transactionally removed synthetic E2E fixtures.

## [Runtime Recovery & Phases 1–3] — 2026-11-25
- Eliminated Supabase completely, built 58-table Prisma + PostgreSQL RLS architecture, fixed read-only filesystem SSR crash on public pages, implemented Phases 2–3 commercial SaaS workflows.
