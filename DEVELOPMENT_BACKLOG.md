# Viewora — Development Backlog (Post Phase 5 Stages 41–50)

**Updated:** 2026-11-26

---

## Priority 1 — Hosted Staging Deployment & Owner-Controlled Activations

1. **Managed Linux PostgreSQL 16 Staging & Fresh 6-Migration Backup/Restore Drill:** Execute encrypted `pg_dump -Fc` / `pg_restore` drill covering all 58 tables, 6 migrations, and 24 RLS policies outside workstation Windows Application Control restrictions.
2. **Official Meta Business Discovery & Connected-Account OAuth Credentials:** Complete Meta Business Verification & App Review, complete the 10-point `meta_official` / `authorized_insights` approval checklist, and enable flags on staging first.
3. **Resend Transactional Email Domain Verification:** Publish SPF, DKIM, DMARC, and return-path DNS records, register `/api/webhooks/resend`, and verify live staging delivery before enabling `PROVIDER_RESEND_ENABLED` + `EMAIL_NOTIFICATIONS_ENABLED`.
4. **Gemini AI Live Activation:** Approve API key & monthly USD caps, complete the 10-point `gemini_ai` checklist, and verify live token accounting on staging.
5. **Optional Commercial Social Data Vendor Onboarding:** Execute written SaaS redistribution agreement before enabling `PROVIDER_LICENSED_THIRD_PARTY_ENABLED`.
6. **Optional Upstash Redis & External Cron Provisioning:** Provision Upstash Redis before multi-pod scaling and configure external cron calling `POST /api/jobs/run` (`CRON_SECRET`) when enabling `BACKGROUND_JOBS_ENABLED=true`.
7. **External WORM Audit Log Sink:** Stream `audit_logs` inserts to immutable off-host SIEM/WORM storage.

---

## Priority 2 — Pre-Launch QA & Tooling Maintenance

8. **Hosted HTTPS Staging Lighthouse & Field RUM CWV Audit:** Capture verified Core Web Vitals scores on staging.
9. **Manual Screen-Reader Accessibility Sign-Off:** Run the NVDA and VoiceOver scripts in [ACCESSIBILITY_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/ACCESSIBILITY_REPORT.md).
10. **Dev Toolchain Major Upgrade (`vitest` v3 → v5):** Upgrade local test runner to resolve the 3 dev-only `vitest` / `tinypool` / `@vitest/mocker` advisories.
11. **Support Ticket Assignment UI:** Surface `support_tickets.assigned_to_id` assignment controls in the Admin Support tab.
12. **Commercial Billing Activation (Explicit Owner Gate):** Keep `PAYMENTS_ENABLED=false` and `NEXT_PUBLIC_PAYMENTS_ENABLED=false` locked until formal commercial launch sign-off.
