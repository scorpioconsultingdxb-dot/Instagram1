# Viewora — Changelog

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
