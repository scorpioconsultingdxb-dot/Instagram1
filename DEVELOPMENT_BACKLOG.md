# Viewora — Development Backlog (Updated After Phase 3)

**Date:** 2026-11-25  
**Status Legend:** `Pending Infrastructure` · `Deferred (By Scope Restriction)` · `Future Enhancement`

---

## 1. Pending Infrastructure (Requires Live Services / Owner-Managed Environment)

1. **PostgreSQL 16 Prisma Migration for Phase 3 Modules (`Pending Infrastructure`):**
   - Persist Phase 3 state (`research-pro`, `report-builder`, `agency-workspaces`, `automation-center`, `referrals-store`, extended `UserPreference` columns) directly in PostgreSQL 16 tables with RLS policies and `viewora_app` role grants, plus extend `npm run test:db` to verify them against live PG16.
2. **Distributed Worker & Cron Scheduler (`Pending Infrastructure`):**
   - Attach a dedicated worker process / cloud scheduler (e.g., Cloud Run Job / BullMQ / Postgres `SKIP LOCKED`) to execute `automation_rule_run` and scheduled report jobs automatically across instances.
3. **Cloud Object Storage Driver (`Pending Infrastructure`):**
   - Implement an S3/GCS/R2 `FileStorageDriver` alongside `LocalFileStorage` for stateless horizontal scaling of custom avatar/cover uploads and export archives.
4. **Live Lighthouse CI & Real-User RUM (`Pending Infrastructure`):**
   - Run automated Lighthouse CLI audits and field Core Web Vitals monitoring on a deployed staging HTTPS origin (local workstation does not have standalone `lighthouse` CLI or Docker/PostgreSQL installed).
5. **Manual Assistive Technology Audit (`Pending Manual QA`):**
   - Execute screen-reader walkthroughs (NVDA, VoiceOver) and axe-core sweeps across all 16 dashboard modules and 5 locales.

## 2. Explicitly Deferred by Scope Restrictions (Do Not Activate Until Authorized)

1. **Stripe Billing & Affiliate Payouts (`Deferred — PAYMENTS_ENABLED=false`):** Live checkout, subscription webhooks, invoicing, and referral commission payouts remain locked off.
2. **Official Meta Graph API / Business Discovery (`Deferred`):** Interfaces preserved (`src/lib/providers/meta-official.ts`, `/api/meta/oauth/start`); credentials and App Review remain unactivated.
3. **Gemini Live API (`Deferred`):** `src/lib/ai/gemini.ts` preserves budget/kill-switch and prompt-sanitization interfaces; falls back transparently to deterministic structured templates when unconfigured.
4. **Resend Transactional Email (`Deferred`):** `src/lib/email/resend.ts` preserves deduplication and SPF/DKIM/DMARC readiness; external dispatch remains inactive.
5. **External Analytics Providers (`Deferred`):** First-party consent-aware funnel analytics preserved; no third-party tracking scripts added.

## 3. Completed in Phase 3 (Archived from Open Backlog)

- [x] Stage 21: 7-segment, 7-goal save-and-resume onboarding + genuine Getting-Started Checklist
- [x] Stage 22: Research Workspace Pro (nested collections, saved filters, bulk tagging, safe CSV importer)
- [x] Stage 23: Personal Digital HQ 2.0 (bio, interests, default landing section, magic-byte verified PNG/JPEG/WebP avatar & cover uploads)
- [x] Stage 24: Deterministic Analytics Engine (`engine.ts` + `engine.test.ts` + UI stats & 3-Pt SMA)
- [x] Stage 25: Professional Report Builder (9 types, reorderable sections, version history, formula-safe CSV/Markdown/print)
- [x] Stage 26: Agency & Team Collaboration Center (multi-client workspaces, seat/workspace quotas, roles, isolated team comments)
- [x] Stage 27: Workflow & Automation Center (`JobQueueEngine` cancellation + templates + internal rules + honest inactive external triggers)
- [x] Stage 28: Referral & Growth Center (durable codes, self/duplicate fraud blocks, UTM campaigns, `/[locale]/r/[code]`, partner applications)
- [x] Stage 29: Enterprise Administration (`maintenance_mode`, support response templates, job queue & storage footprint, partner review)
- [x] Stage 30: Security hardening (CSV formula injection fix, dev ephemeral secret `globalThis` fix), 77 automated tests, 302-page build, throttled CWV & 11 verified screenshots.
