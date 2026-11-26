# Viewora — Explicit Provider Activation Readiness Checklist (Stage 49.6)

**Date:** 2026-11-26  
**Hard Policy:** Providers **NEVER** activate automatically when API keys are added. Every external provider requires ALL 10 governance checks below plus an explicit server flag flip (`PROVIDER_*_ENABLED=true`) by the owner.

---

## 10-Point Provider Activation Gate (Tracked Per Provider in Admin Integration Center 2.0)

| # | Check Key | Required Verification Before Activation |
| :-: | :--- | :--- |
| 1 | `owner_approval` | Explicit written owner authorization obtained for provider & budget |
| 2 | `provider_account` | Official developer or commercial partner account created & verified |
| 3 | `credentials_present` | Non-placeholder credentials stored strictly in server secret vault (never Git / `NEXT_PUBLIC_*`) |
| 4 | `commercial_licensing` | Written SaaS redistribution, export, and AI-processing rights confirmed in [COMMERCIAL_DATA_LICENSING_MATRIX.md](file:///c:/Users/Scorpio/Videos/Instagram/COMMERCIAL_DATA_LICENSING_MATRIX.md) |
| 5 | `privacy_policy` | Public privacy notice and data transparency copy aligned with provider data scope |
| 6 | `retention_compatibility` | Cache TTL and PostgreSQL snapshot retention rules comply with provider max retention (e.g., Meta 24h cache limit) |
| 7 | `spending_limits` | Daily/monthly USD caps (`API_DAILY_COST_CAP_USD`, `API_MONTHLY_COST_CAP_USD`) and 50/75/90/100% alerts confirmed |
| 8 | `security_verification` | Outbound SSRF allowlist, TLS port 443, 1 MB bounded JSON, secret redaction, and AES-256-GCM token crypto verified |
| 9 | `capability_verification` | Provider capabilities verified strictly for public/authorized data (`supportsPrivateAccounts: false`, `requiresInstagramCredentials: false`) |
| 10 | `emergency_shutdown` | Durable PostgreSQL global & per-provider Emergency Halt verified against both interactive and worker paths |

---

## Current Activation Status (All External Paid Providers Disabled)

| Provider ID | Server Flag | Current Status | Owner Blocker |
| :--- | :--- | :--- | :--- |
| `meta_official` | `PROVIDER_META_ENABLED=false` | **Awaiting live credentials** | Meta Business Verification & App Review |
| `authorized_insights` | `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=false` | **Awaiting live credentials** | Meta OAuth App Review (`instagram_basic`, `instagram_manage_insights`, `pages_show_list`) |
| `licensed_third_party` | `PROVIDER_LICENSED_THIRD_PARTY_ENABLED=false` | **Awaiting contract & credentials** | Signed commercial redistribution agreement |
| `gemini_ai` | `PROVIDER_GEMINI_ENABLED=false` | **Awaiting owner budget & key** | Owner Gemini API key & monthly USD cap approval |
| `resend_email` | `PROVIDER_RESEND_ENABLED=false` | **Awaiting domain DNS & key** | Owner SPF/DKIM/DMARC setup, Resend key & webhook secret |
| `upstash_redis` (optional) | Unconfigured (`active: false`) | **Standby** | Optional multi-pod Redis provisioning |
| `background_jobs` cron | `BACKGROUND_JOBS_ENABLED=false` | **Inactive** | Owner external cron & `CRON_SECRET` setup |
