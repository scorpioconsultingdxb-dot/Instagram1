# Viewora — Changelog

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
