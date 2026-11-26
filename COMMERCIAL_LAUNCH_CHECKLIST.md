# Viewora — Formal Commercial Launch Checklist (Stage 60 — 13 Mandatory Gates)

**Date:** 2026-11-26  
**LAUNCH VERDICT:** **DO NOT LAUNCH PUBLICLY YET — 10 OF 13 COMMERCIAL LAUNCH GATES REQUIRE OWNER ACTION, HOSTED LINUX STAGING, OR LEGAL/PROVIDER SIGN-OFF.**  
**Engineering & Pre-Launch Codebase Verdict:** **READY FOR HOSTED LINUX STAGING DEPLOYMENT.**

---

## Mandatory 13-Gate Commercial Launch Sign-Off Table

| Gate # | Gate Name | Status | Current Evidence / Blocking Requirement | Sign-Off Owner |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **Code Quality, Tests & Zero-CVE Security Baseline** | **PASS (Verified Locally)** | `0` TS errors, `0` ESLint errors, `0` prod CVEs, `0` total CVEs (`vitest@5.1.2`), `115/115` unit tests, `9/9` live PG tests, `322` static pages, `27` E2E screenshots (`0` errors) | Engineering Lead |
| **2** | **Independent PostgreSQL & Tenant RLS Integrity** | **PASS (Verified Locally)** | 58 tables, 6 migrations, 74 FKs, 147 indexes, **24 RLS policies**, immutable `audit_logs` (Migration 5), `viewora_app` `NOBYPASSRLS`, permanent Super Admin intact | Database Architect |
| **3** | **Hosted Linux Staging & Managed PostgreSQL 16/17 Provisioning** | **BLOCKED (Awaiting Owner)** | Provision managed Linux compute + Managed PG 16/17 HA + HTTPS TLS 1.3 + secret vault per [PRODUCTION_INFRASTRUCTURE_PLAN.md](file:///c:/Users/Scorpio/Videos/Instagram/PRODUCTION_INFRASTRUCTURE_PLAN.md) | Owner / DevOps |
| **4** | **Fresh Encrypted 6-Migration Backup & Restore Drill** | **BLOCKED (Workstation OS Policy)** | Execute encrypted `pg_dump -Fc` + disposable `pg_restore` on Linux staging verifying all 58 tables, 6 migrations & 24 RLS policies ([BACKUP_RESTORE_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/BACKUP_RESTORE_REPORT.md)) | DevOps / DBA |
| **5** | **External WORM / SIEM Audit-Log Archival & Production Alerts** | **BLOCKED (Awaiting Hosting)** | Stream `audit_logs` to immutable off-host WORM storage + configure uptime/5xx/DB-pool alerting | DevOps / Security |
| **6** | **Official External Provider Approvals & Credentials (Stage 52)** | **BLOCKED (Awaiting Owner)** | Complete 10-point checklist for each approved provider (Meta Business/App Review, Resend SPF/DKIM/DMARC, Gemini key + caps, optional Licensed vendor & Redis) | Owner / Integrations |
| **7** | **Live Upstream Provider Acceptance Pass (`live_provider_verified`)** | **BLOCKED (Depends on Gate 6)** | Run `runProviderAcceptanceSuite()` in `live_provider_verified` mode on staging per [LIVE_DATA_ACCEPTANCE_TEST_PLAN.md](file:///c:/Users/Scorpio/Videos/Instagram/LIVE_DATA_ACCEPTANCE_TEST_PLAN.md) | QA / Engineering |
| **8** | **Hosted HTTPS Lighthouse CWV & Manual Screen-Reader Sign-Off** | **BLOCKED (Awaiting Staging)** | Verify hosted mobile Lighthouse ≥ 90, A11y ≥ 95, BP ≥ 95, SEO ≥ 95, LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms + complete NVDA & VoiceOver scripts | QA / UX |
| **9** | **Qualified Legal Counsel Approval (UAE PDPL, GDPR, Policies, DPA)** | **BLOCKED (Awaiting Counsel)** | Obtain written counsel sign-off on Terms, Privacy, Cookie, Refund, DPA, Subprocessor list & Affiliate terms ([LEGAL_COMPLIANCE_REVIEW.md](file:///c:/Users/Scorpio/Videos/Instagram/LEGAL_COMPLIANCE_REVIEW.md)) | Legal Counsel / Owner |
| **10** | **Billing Gateway Sandbox E2E Verification (`PAYMENTS_ENABLED`)** | **BLOCKED (Awaiting Owner)** | Install approved payment SDK (e.g. Stripe), verify HMAC webhooks, idempotency, proration, 7-day grace period, refunds & UAE/EU VAT in Test Mode on staging | Owner / Billing |
| **11** | **Controlled Invitation-Only Beta Exit (5 Cohorts, 14-Day Soak)** | **BLOCKED (Awaiting Owner)** | Complete Stage 59 invite-only pilot with `0` open S0/S1 defects and confirmed unit-cost alignment ([BETA_TESTING_PLAN.md](file:///c:/Users/Scorpio/Videos/Instagram/BETA_TESTING_PLAN.md)) | Product / Owner |
| **12** | **Canonical Production Domain, DNS, `robots.txt` & Search Console** | **BLOCKED (Awaiting Domain)** | Verify production HTTPS domain, submit 135-URL `sitemap.xml` in GSC, confirm staging returns `noindex` | Marketing / DevOps |
| **13** | **Explicit Managing Director Written Commercial Go-Live Sign-Off** | **AWAITING OWNER APPROVAL** | Formal authorization to flip `PAYMENTS_ENABLED=true`, `NEXT_PUBLIC_PAYMENTS_ENABLED=true`, and open public registration | Managing Director |

---

## Hard Non-Negotiable Release Rule

Commercial billing and public registration **MUST remain disabled** (`PAYMENTS_ENABLED=false`, `NEXT_PUBLIC_PAYMENTS_ENABLED=false`, `BETA_PUBLIC_REGISTRATION_ENABLED=false`, `PROVIDER_*_ENABLED=false`) until every blocking gate above is marked **PASS** with dated evidence.
