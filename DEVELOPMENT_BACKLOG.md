# Viewora — Development Backlog (Post Phase 5 Stages 42–45)

**Updated:** 2026-11-26

---

## Priority 1 — Hosted Staging & Owner-Approved Live Activation

1. **Managed Linux PostgreSQL 16 Staging & Automated Backup/Restore Drills:** Provision managed PostgreSQL 16 + PgBouncer (`?pgbouncer=true`), deploy Migrations 1–6, and run scheduled `pg_dump -Fc` / `pg_restore` drills outside workstation Windows Application Control restrictions.
2. **Official Meta Business Discovery & Connected-Account OAuth Credentials:** Complete Meta App Review (`instagram_basic`, `instagram_manage_insights`, `pages_show_list`), configure server secrets + webhook verify token, run live staging OAuth & deauthorization verification, and enable `PROVIDER_META_ENABLED=true` / `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=true` after owner sign-off.
3. **Licensed Commercial Social Data Partner Onboarding (Optional):** Complete legal review against [COMMERCIAL_DATA_LICENSING_MATRIX.md](file:///c:/Users/Scorpio/Videos/Instagram/COMMERCIAL_DATA_LICENSING_MATRIX.md), sign redistribution contract, and configure `LICENSED_SOCIAL_PROVIDER_*` only after owner approval.
4. **Optional Upstash Redis Coordination for Horizontal Scaling:** Activate the prepared Redis adapter (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) to synchronize per-minute sliding-window rate limits, circuit breakers, and short-TTL caches across multiple stateless pods (PostgreSQL already synchronizes USD budgets, kill switches, daily quotas, jobs, and webhooks).
5. **External Cron Scheduler for Durable Background Jobs:** Provision external cron/scheduler calling `POST /api/jobs/run` with `CRON_SECRET` when flipping `BACKGROUND_JOBS_ENABLED=true` to run scheduled snapshot collection and retention pruning.
6. **Gemini AI & Resend Transactional Email Live Activation:** Approve credentials, SPF/DKIM/DMARC sending domain, and monthly spend ceilings before flipping `PROVIDER_GEMINI_ENABLED` / `PROVIDER_RESEND_ENABLED`.
7. **External WORM Audit Log Sink:** Stream `audit_logs` inserts to immutable off-host storage / SIEM to eliminate single-host superuser DDL risk.

---

## Priority 2 — Pre-Launch QA & Tooling Maintenance

8. **Hosted Staging Lighthouse & Field RUM CWV Audit:** Verify Core Web Vitals on live HTTPS staging.
9. **Manual Screen-Reader Accessibility Sign-Off:** Complete NVDA, VoiceOver, and JAWS verification pass across public tools, Dashboard 3.0, Competitor Studio, and Admin Integration Center.
10. **Dev Toolchain Major Upgrade (`vitest` v3 → v5):** Upgrade local dev test runner to clear the 3 dev-only `vitest` / `tinypool` / `@vitest/mocker` advisories.
11. **Support Ticket Assignment UI:** Surface `support_tickets.assigned_to_id` assignment controls in the Admin Support tab.
12. **Commercial Payments Activation (Explicit Owner Gate):** Keep `PAYMENTS_ENABLED=false` and `NEXT_PUBLIC_PAYMENTS_ENABLED=false` locked until formal commercial billing launch authorization.
