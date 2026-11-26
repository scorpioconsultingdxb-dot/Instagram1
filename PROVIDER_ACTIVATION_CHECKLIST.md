# Viewora — Explicit Provider Activation Readiness Checklist (Updated Stage 52 / 60)

**Date:** 2026-11-26  
**Hard Policy:** Providers **NEVER** activate automatically when API keys are added. Every external provider requires ALL 10 governance checks below, a Staging `live_provider_verified` pass ([LIVE_DATA_ACCEPTANCE_TEST_PLAN.md](file:///c:/Users/Scorpio/Videos/Instagram/LIVE_DATA_ACCEPTANCE_TEST_PLAN.md)), AND an explicit server flag flip (`PROVIDER_*_ENABLED=true`) authorized by the owner.

---

## 1. 10-Point Provider Activation Gate (Tracked Per Provider in Admin Integration Center 2.0)

| # | Check Key | Required Verification Before Activation |
| :-: | :--- | :--- |
| 1 | `owner_approval` | Explicit written owner authorization obtained for provider & budget |
| 2 | `provider_account` | Official developer or commercial partner account created & verified |
| 3 | `credentials_present` | Non-placeholder credentials stored strictly in hosted secret vault (never Git / `NEXT_PUBLIC_*`) |
| 4 | `commercial_licensing` | Written SaaS redistribution, export, and AI-processing rights confirmed in [COMMERCIAL_DATA_LICENSING_MATRIX.md](file:///c:/Users/Scorpio/Videos/Instagram/COMMERCIAL_DATA_LICENSING_MATRIX.md) |
| 5 | `privacy_policy` | Public privacy notice, subprocessor list, and data transparency copy aligned with provider data scope |
| 6 | `retention_compatibility` | Cache TTL and PostgreSQL snapshot retention rules comply with provider max retention (e.g., Meta 24h cache limit) |
| 7 | `spending_limits` | Daily/monthly micro-USD caps (`API_DAILY_COST_CAP_USD`, `API_MONTHLY_COST_CAP_USD`) and 50/75/90/100% alerts confirmed |
| 8 | `security_verification` | Outbound SSRF allowlist, TLS port 443, 1 MB bounded JSON, secret redaction, and AES-256-GCM token crypto verified |
| 9 | `capability_verification` | Provider capabilities verified strictly for public/authorized data (`supportsPrivateAccounts: false`, `requiresInstagramCredentials: false`) |
| 10 | `emergency_shutdown` | Durable PostgreSQL global & per-provider Emergency Halt verified against both interactive and worker paths |

---

## 2. Recommended Staging-First Activation Order (Stage 52 Sequence)

Activate providers **one at a time** on HTTPS Staging before promoting to Production:

| Order | Provider / Subsystem | Server Flag(s) | Current Status | Prerequisite External Actions |
| :---: | :--- | :--- | :---: | :--- |
| **1** | `resend_email` | `PROVIDER_RESEND_ENABLED=false` & `EMAIL_NOTIFICATIONS_ENABLED=false` | **Disabled** | Verify sending domain (SPF/DKIM/DMARC), register `/api/webhooks/resend` Svix secret, test bounce/unsubscribe on staging |
| **2** | `gemini_ai` | `PROVIDER_GEMINI_ENABLED=false` | **Disabled** | Set strict staging USD caps (\$5/day), store server Gemini key, verify token reconciliation & prompt-injection defenses |
| **3** | `meta_official` & `authorized_insights` | `PROVIDER_META_ENABLED=false` & `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=false` | **Disabled** | Complete Meta Business Verification & App Review (`instagram_basic`, `instagram_manage_insights`, `pages_show_list`), verify OAuth connect/disconnect + `live_provider_verified` suite |
| **4** | `licensed_third_party` *(Optional)* | `PROVIDER_LICENSED_THIRD_PARTY_ENABLED=false` | **Disabled** | Execute written commercial SaaS redistribution contract, add SSRF allowlist host, pass `live_provider_verified` suite |
| **5** | `upstash_redis` *(Optional)* | Unconfigured (`active: false`) | **Standby** | Provision managed TLS Redis before scaling ≥ 2 stateless production containers |
| **6** | `background_jobs` cron | `BACKGROUND_JOBS_ENABLED=false` | **Inactive** | Configure external managed cron sending `Authorization: Bearer $CRON_SECRET` to `POST /api/jobs/run` |
| **7** | Commercial Billing *(Stage 54/60)* | `PAYMENTS_ENABLED=false` & `NEXT_PUBLIC_PAYMENTS_ENABLED=false` | **Locked Off** | Explicit owner authorization + Stripe Test Mode E2E verification + all 13 Commercial Launch Gates |
