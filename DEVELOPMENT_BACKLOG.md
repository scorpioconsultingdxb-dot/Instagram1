# Viewora — Development Backlog (Post Phase 4.1 → Phase 5)

**Updated:** 2026-11-26

## Priority 1 — Phase 5 Staging Infrastructure & External Integrations

1. **Managed PostgreSQL 16 Staging & Automated Backups:** Deploy Migrations 1–5 to managed Linux PostgreSQL 16 with PgBouncer transaction pooling (`?pgbouncer=true`) and scheduled `pg_dump -Fc` + automated restore drills (unblocked from workstation Windows App Control).
2. **Official Meta Business Discovery Provider Activation:** Configure approved Meta App credentials and OAuth callback flows for live public business/creator account snapshots.
3. **Gemini AI Live Provider & Cost Guardrails:** Enable `GEMINI_API_KEY` with per-tier rate limits and token cost budgets already modeled in `cost_budgets`.
4. **Transactional Email & Scheduled Cron Runner:** Connect SMTP/Resend for real email verification, password resets, and weekly digests; schedule external cron to invoke `POST /api/jobs/run` with `CRON_SECRET`.
5. **S3/R2/GCS Signed Media Storage Adapter:** Optional swap of `/api/auth/media` persistence from PostgreSQL JSONB to managed object storage at scale.

## Priority 2 — Pre-Launch QA & Tooling Hygiene

6. **Hosted Lighthouse & Core Web Vitals Audit:** Capture real HTTPS/CDN Lighthouse scores and field RUM metrics on staging.
7. **Manual Screen-Reader Accessibility Pass:** Conduct human testing with NVDA, VoiceOver, and JAWS across Dashboard 3.0, Report Studio 3.0, and Admin 3.0.
8. **Dev Dependency Major Upgrade (`vitest` v3 → v5):** Migrate test runner major version to resolve the 3 dev-only `vitest` / `tinypool` / `@vitest/mocker` advisories.
9. **Support Ticket Assignee Management:** Add `assignedToId` selection in Admin Support Queue (schema column `support_tickets.assigned_to_id` already exists).
10. **Payments Activation (Explicit Approval Gate):** Only activate Stripe checkout/webhooks (`PAYMENTS_ENABLED=true`) after legal, pricing, and owner sign-off.
