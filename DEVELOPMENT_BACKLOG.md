# Viewora — Development Backlog (Post Stage 41 → Phase 5 Activation)

**Updated:** 2026-11-26

## Priority 1 — Owner Approvals & Phase 5 Staging Activation

1. **Managed PostgreSQL 16 Staging & Automated Linux Backup/Restore Drills:** Provision managed Linux PostgreSQL 16 + PgBouncer (`?pgbouncer=true`), apply Migrations 1–5, and run automated `pg_dump -Fc` / `pg_restore` verification outside workstation Windows Application Control restrictions.
2. **Distributed Rate-Limit, Cache & Cost-Cap Backing Store:** Wire `UPSTASH_REDIS_REST_URL` / PostgreSQL `cost_budgets` & `search_events` into `ExternalApiGateway` and `/api/search` before horizontal multi-pod scaling.
3. **Official Meta Business Discovery & Connected-Account OAuth Activation:** Complete Meta App Review (`instagram_basic`, `pages_show_list`, `instagram_manage_insights`), configure encrypted OAuth token storage, and flip `PROVIDER_META_ENABLED=true` / `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=true` after owner approval.
4. **Licensed Commercial Social Data Partner Evaluation:** Execute commercial contract review against [API_PROVIDER_COMPARISON.md](file:///c:/Users/Scorpio/Videos/Instagram/API_PROVIDER_COMPARISON.md) before approving `PROVIDER_LICENSED_THIRD_PARTY_ENABLED=true`.
5. **Gemini AI & Resend Transactional Email Activation:** Approve API keys, sending domain SPF/DKIM/DMARC, USD caps, and external cron scheduling for `POST /api/jobs/run` (`CRON_SECRET`).
6. **External WORM Audit Log Sink:** Stream `audit_logs` inserts to immutable off-host storage / SIEM to eliminate single-host superuser DDL risk.

## Priority 2 — Pre-Launch Verification & Tooling Maintenance

7. **Hosted Staging Lighthouse & Field CWV Audit:** Execute the Lighthouse procedure in [PHASE_5_READINESS_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/PHASE_5_READINESS_REPORT.md).
8. **Manual Screen-Reader Accessibility Pass:** Execute NVDA, VoiceOver, and JAWS verification checklist.
9. **Dev Toolchain Major Upgrade (`vitest` v3 → v5):** Upgrade local test runner to clear the 3 dev-only `vitest` / `tinypool` / `@vitest/mocker` advisories.
10. **Support Ticket Assignment UI:** Surface `support_tickets.assigned_to_id` assignment controls in Admin Support tab.
11. **Payments Activation (Explicit Owner Gate):** Keep `PAYMENTS_ENABLED=false` until formal commercial launch sign-off.
