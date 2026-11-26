# Viewora — Development & Launch Operations Backlog (Post Phase 6 — Stage 60)

**Updated:** 2026-11-26

---

## Recently Completed (Resolved in Phase 6 Stage 60)

- **[DONE] Dev Toolchain Major Upgrade (`vitest` `3.2.4` → `5.1.2`):** Eliminated all 3 remaining dev-only advisories (`vitest`, `tinypool`, `@vitest/mocker`). Both `npm audit --omit=dev` and full `npm audit` across all **401 packages** now report **`0` vulnerabilities** with 115/115 unit tests and 9/9 live PG tests passing.

---

## Priority 1 — Hosted Linux Staging & Owner-Controlled Commercial Launch Gates

1. **Managed Linux Staging & PostgreSQL 16/17 Provisioning (Gate #3):** Provision hosted Next.js compute, Managed PostgreSQL 16/17 HA, TLS 1.3, and cloud secret vault per [PRODUCTION_INFRASTRUCTURE_PLAN.md](file:///c:/Users/Scorpio/Videos/Instagram/PRODUCTION_INFRASTRUCTURE_PLAN.md).
2. **Fresh Encrypted 6-Migration Backup & Restore Drill on Linux Staging (Gate #4):** Verify encrypted `pg_dump -Fc` / `pg_restore` covering all 58 tables, 6 migrations, and 24 RLS policies outside local Windows Application Control restrictions.
3. **Off-Host WORM / SIEM Audit-Log Archival & Alerting (Gate #5):** Stream `public.audit_logs` to immutable off-host storage and wire `GET /api/health` + 5xx alerts.
4. **Stage 52 External Provider Activations on Staging (Gates #6–#7):**
   - **Resend Email:** Publish SPF/DKIM/DMARC records, register `/api/webhooks/resend` Svix secret, test live bounce/unsubscribe.
   - **Gemini AI:** Set strict staging daily/monthly micro-USD caps and server API key; verify live token reconciliation.
   - **Meta Official & OAuth:** Complete Meta Business Verification & App Review; pass `runProviderAcceptanceSuite()` in `live_provider_verified` mode.
   - **Licensed Data Vendor (Optional):** Execute written SaaS redistribution contract before enabling.
   - **Upstash Redis & External Cron:** Provision Redis before ≥2 stateless pods; schedule authenticated `POST /api/jobs/run` (`CRON_SECRET`) when enabling `BACKGROUND_JOBS_ENABLED=true`.
5. **Qualified Legal Counsel Sign-Off (Gate #9):** Obtain formal UAE PDPL + GDPR counsel approval of Terms, Privacy, Cookie, Refund, DPA, Subprocessor Register, and Affiliate Agreement.

---

## Priority 2 — Pre-GA QA, Billing Sandbox & Controlled Beta

6. **Hosted HTTPS Staging Lighthouse CWV & Manual NVDA/VoiceOver Sign-Off (Gate #8):** Capture verified mobile/desktop Lighthouse scores (90+/95+/95+/95+) and complete manual screen-reader verification scripts.
7. **Stripe (or Approved Gateway) Sandbox Implementation (Gate #10):** Only after written owner approval — implement concrete `PaymentGatewayAdapter`, test HMAC webhooks, idempotency, proration, 7-day grace period, refunds, and VAT in Test Mode while keeping production `PAYMENTS_ENABLED=false`.
8. **Controlled Invitation-Only Beta Pilot (Gate #11):** Issue SHA-256 invite codes to the 5 pilot cohorts for a 14-day soak targeting 0 open S0/S1 defects.
9. **Support Ticket Assignment UI & Post-GA Enhancements:** Surface `support_tickets.assigned_to_id` assignment controls in the Admin Support tab and collect consented pilot testimonials after Stage 59 exit.
