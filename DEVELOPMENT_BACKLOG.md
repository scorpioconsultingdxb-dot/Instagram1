# Viewora — Development Backlog (Post Phase 4 — Stages 31–40)

**Date:** 2026-11-25  
**Status Legend:** `Pre-GA Staging Gate` · `Optional Future Scale` · `Deferred (By Scope Restriction)`

---

## 1. Pre-GA Staging Gates

1. **Transitive Dependency Security Patch Review (`Pre-GA Staging Gate`):**
   - Resolve the `6` high / `1` moderate transitive vulnerabilities reported by `npm audit --omit=dev` (0 critical) and re-run full regression + build verification.
2. **HTTPS Staging Lighthouse CI & Manual Assistive-Tech Walkthrough (`Pre-GA Staging Gate`):**
   - Run automated Lighthouse CI (targeting Mobile 90+, A11y 95+, Best Practices 95+, SEO 95+) and manual NVDA / VoiceOver screen-reader testing against the deployed staging HTTPS origin.
3. **Managed Cloud PostgreSQL 16 Provisioning (`Pre-GA Staging Gate`):**
   - Deploy with `viewora_app` + PgBouncer (`?sslmode=require`), separate `DATABASE_ADMIN_URL`, automated daily PITR backups, and S3/GCS/R2 optional blob offload if high-volume media uploads exceed JSONB storage targets (customer avatars/covers already persist durably in PostgreSQL `_media` with zero ephemeral disk dependency).
4. **Distributed Worker / Cron Scheduler (`Pre-GA Staging Gate`):**
   - Attach a dedicated worker polling PostgreSQL `background_jobs` (`SKIP LOCKED`) for scheduled automation runs across replicas.

## 2. Explicitly Deferred by Scope Restrictions

1. **Stripe Billing & Affiliate Payouts (`PAYMENTS_ENABLED=false` locked)**
2. **Official Meta Graph API / Business Discovery**
3. **Gemini Live API**
4. **Resend Transactional Email Delivery**
5. **External Third-Party Analytics Providers**

## 3. Completed in Phase 4 (Stages 31–40)

- [x] Stage 31: Accessibility motion/contrast CSS hooks, shimmer skeleton, glass surface, 6-viewport & 5-locale verification
- [x] Stage 32: First-party PostgreSQL activation funnel milestones (`onboarding_completed`, `first_saved_profile`, `first_project_created`, `first_report_created`), removed sample substitution on live DB
- [x] Stage 33: Durable PostgreSQL RLS customer media storage (`_media`) + account-persisted Accessibility Preferences (`reducedMotion`, `highContrast`)
- [x] Stage 34: 5 Dashboard Layout Presets (`dashboard-presets.ts`) + keyboard-accessible widget reordering persisted in PostgreSQL
- [x] Stage 35: Research project duplication (`duplicate_project`), PostgreSQL RLS persistence, provenance transparency
- [x] Stage 36: All 10 Report Studio 3.0 templates persisted in PostgreSQL RLS with formula-safe exports
- [x] Stage 37: In-app Customer Feedback & Feature Request intake (`/api/feedback`) persisted to PostgreSQL `support_tickets` + `audit_logs`
- [x] Stage 38: Native PostgreSQL `referral_codes`, `referral_attributions`, and `affiliate_accounts` repository (`referrals.repo.ts`) with self/duplicate/30-day guards & locked `payoutsEnabled: false`
- [x] Stage 39: Last-Super-Admin protection (`409`), self-suspension block (`400`), `revoke_user_sessions` admin action, live `databaseHealth` & PG `referralOverview`
- [x] Stage 40: Full QA (**86/86 unit tests**, **6/6 live PG RLS tests**, **303 static pages**, **live PG E2E on isolated `viewora_test`**, **78/78 Scenario B read-only routes**, clean `viewora` baseline preserved)
