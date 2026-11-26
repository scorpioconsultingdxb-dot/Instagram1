# Viewora — Step-by-Step Owner Activation Guide (Task 4)

**Date:** 2026-11-26  
**Security Policy:** **NEVER paste API keys, database passwords, or secrets into chat messages, emails, or Git files.** Enter every secret exclusively into the hosted platform's encrypted Secret Manager / Vault.  
**Default-Off Guarantee:** Adding a credential **never** activates an external service until its matching `PROVIDER_*_ENABLED` flag is also explicitly flipped to `true` after verification.

---

## 12-Step Sequential Activation Playbook

### Step 1 — Hosting Account Creation & Infrastructure Approval
- **Official Website:** https://www.digitalocean.com *(Primary)* or https://render.com *(Alternative)*
- **Required Account:** Verified business billing account with MFA enabled for Owner & DevOps Lead
- **Exact Configuration Fields:** Region `FRA1` (Frankfurt EU), Docker App Service (`Dockerfile`), `healthCheckPath: /api/health`, `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`, `DEMO_MODE_ENABLED=false`, `PAYMENTS_ENABLED=false`, `NEXT_PUBLIC_PAYMENTS_ENABLED=false`, `BETA_PUBLIC_REGISTRATION_ENABLED=false`
- **Env Vars:** `NODE_ENV`, `NEXT_PUBLIC_APP_URL`, `AUTH_URL`, `AUTH_SECRET` (generate 64-char hex via `openssl rand -hex 32`)
- **Expected Cost:** ~\$12–\$25/mo Staging compute `[Estimate]`
- **Required Approval:** Managing Director infrastructure budget sign-off
- **Verification & Success Criteria:** `GET /api/health` returns HTTP `200`, `demoMode.enabled: false`, `payments.enabled: false`, startup-check passes
- **Rollback / Deactivation:** Pause or roll back App Service to prior immutable Docker image

### Step 2 — Managed PostgreSQL 17 Configuration
- **Official Website:** https://cloud.digitalocean.com/databases *(or Render Postgres)*
- **Required Account:** Same hosting account (VPC private networking enabled)
- **Exact Configuration Fields:** Engine **PostgreSQL 17**, Region `FRA1`, Trusted Sources restricted exclusively to Staging App VPC (block public internet), Managed PgBouncer pool enabled, create least-privilege `viewora_app` (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
- **Env Vars:** `DATABASE_URL` (runtime `viewora_app` + `?sslmode=require&pgbouncer=true`); CI-only `DATABASE_ADMIN_URL` (direct non-pooled admin, **never** on web container)
- **Expected Cost:** \$15.15/mo (1 GiB Staging) `[Verified List]` · \$60.90–\$121.80/mo (HA Prod) `[Verified List]`
- **Required Approval:** Owner infrastructure approval
- **Verification & Success Criteria:** Run [`deploy/scripts/pg17-verify-and-backup.sh`](file:///c:/Users/Scorpio/Videos/Instagram/deploy/scripts/pg17-verify-and-backup.sh) → confirm 58 tables, 6 migrations, 74 FKs, 147 indexes, 24 RLS policies, `audit_trigger = 1`, `app_bypassrls = f`, and successful encrypted backup + disposable restore drill
- **Rollback / Deactivation:** Restore from encrypted `.dump.enc` or Managed PITR snapshot

### Step 3 — Staging Domain & HTTPS
- **Official Website:** Owner's DNS Registrar / Cloudflare (https://dash.cloudflare.com)
- **Required Account:** Domain DNS administrator account
- **Exact Configuration Fields:** `CNAME staging.<domain>` → hosting ingress; enforce TLS 1.3 + HSTS; add edge response header `X-Robots-Tag: noindex, nofollow` on staging
- **Env Vars:** `NEXT_PUBLIC_APP_URL=https://staging.<domain>`, `AUTH_URL=https://staging.<domain>`
- **Expected Cost:** \$0 (uses existing domain + managed Let's Encrypt TLS) `[Verified List]`
- **Required Approval:** Owner DNS authorization
- **Verification & Success Criteria:** Valid HTTPS padlock, `curl -I https://staging.<domain>` shows `Strict-Transport-Security` & `X-Robots-Tag: noindex`, session cookies carry `Secure` + `HttpOnly`
- **Rollback / Deactivation:** Remove `staging` CNAME record

### Step 4 — Resend Transactional Email & Domain Verification *(Activation Order #1)*
- **Official Website:** https://resend.com
- **Required Account:** Resend business account (Free tier \$0 for Staging; Pro \$20/mo before Beta/Launch)
- **Exact Configuration Fields:** Add sending subdomain `mail.<domain>`, publish Resend SPF, DKIM & DMARC DNS records, create Sending-only API key, configure webhook `https://staging.<domain>/api/webhooks/resend` for `email.sent/delivered/bounced/complained/delivery_delayed`
- **Env Vars:** `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM_ADDRESS=noreply@mail.<domain>`, `EMAIL_REPLY_TO=support@<domain>`, `PROVIDER_RESEND_ENABLED=true`, `EMAIL_NOTIFICATIONS_ENABLED=true`
- **Expected Cost:** \$0/mo Staging (Free: 3k/mo, 100/day) `[Verified List]` · \$20/mo Launch (Pro: 50k/mo) `[Verified List]`
- **Required Approval:** Owner DNS & provider activation approval
- **Verification & Success Criteria:** Confirm actual inbox receipt & SPF/DKIM/DMARC `PASS` in authorized test mailboxes across verification, resend, password reset, security alert, and support emails; verify `bounced@resend.dev` updates suppression list
- **Rollback / Deactivation:** Set `PROVIDER_RESEND_ENABLED=false` & `EMAIL_NOTIFICATIONS_ENABLED=false` (or trigger Admin Halt)

### Step 5 — Google Gemini API Key & Conservative Pilot Caps *(Activation Order #2)*
- **Official Website:** https://aistudio.google.com (pricing: https://ai.google.dev/gemini-api/docs/pricing)
- **Required Account:** Google Cloud / AI Studio **Paid Billing** account (never use free tier for customer prompts)
- **Exact Configuration Fields:** Confirm active GA Flash-Lite model ID (e.g. `gemini-2.5-flash-lite` or current GA Flash-Lite: \$0.10/1M in, \$0.40/1M out `[Verified List]`), set Google Cloud billing alert, enforce conservative Viewora pilot limits **\$2.00/day & \$15.00/month**
- **Env Vars:** `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_DAILY_BUDGET_USD=2.00`, `AI_MONTHLY_BUDGET_USD=15.00`, `API_DAILY_COST_CAP_USD=5.00`, `API_MONTHLY_COST_CAP_USD=25.00`, `PROVIDER_GEMINI_ENABLED=true`
- **Expected Cost:** Hard-capped at **≤ \$15.00/mo** during pilot `[Owner Cap]`
- **Required Approval:** Owner model & spending limit sign-off
- **Verification & Success Criteria:** All 12 AI capabilities & assistant return `gemini_live` attribution, prompt-injection defense holds, private notes stay excluded by default, concurrent quota lock & Emergency Halt verified
- **Rollback / Deactivation:** Click **Halt `gemini_ai`** in Admin Integration Center 2.0 (instant) or set `PROVIDER_GEMINI_ENABLED=false`

### Step 6 — Official Meta Developer App & Authorized Accounts *(Activation Order #3)*
- **Official Website:** https://developers.facebook.com & https://business.facebook.com
- **Required Account:** Verified Meta Business Portfolio + Meta Developer App + authorized test Instagram Business/Creator accounts
- **Exact Configuration Fields:** App Type Business, pin current Graph API version (`v25.0`–`v26.0`), OAuth Redirect `https://staging.<domain>/api/meta/oauth/callback`, Webhook `https://staging.<domain>/api/webhooks/meta`, **Data Deletion Callback / Instructions URL** configured, App Review scopes `instagram_business_basic` / `instagram_manage_insights` (Business/Creator only)
- **Env Vars:** `META_APP_ID`, `META_APP_SECRET`, `META_API_VERSION`, `META_WEBHOOK_VERIFY_TOKEN`, `META_OAUTH_REDIRECT_URI`, `PROVIDER_META_ENABLED=true`, `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=true`
- **Expected Cost:** \$0 / API call `[Verified List]`
- **Required Approval:** Owner Meta Business Verification & App Review completion
- **Verification & Success Criteria:** Authorized Business/Creator connect → ciphertext verified in `provider_connections` → insights/snapshots/reports succeed → disconnect & revocation purge tokens cleanly → personal/private handles fail cleanly as unsupported
- **Rollback / Deactivation:** Click **Halt `meta_official` / `authorized_insights`** in Admin Console or set flags `false`

### Step 7 — Upstash Redis Configuration *(Activation Order #4a — Required Before ≥ 2 Pods)*
- **Official Website:** https://upstash.com
- **Required Account:** Upstash account, region matching hosting (`eu-central-1` Frankfurt)
- **Exact Configuration Fields:** TLS Redis DB, eviction `allkeys-lru`, monthly budget cap set
- **Env Vars:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **Expected Cost:** \$0/mo Staging (Free: 500k cmds) `[Verified List]` · \$10–\$20/mo Fixed Prod `[Verified List]`
- **Required Approval:** Owner multi-pod infrastructure sign-off
- **Verification & Success Criteria:** Admin Integration Center 2.0 reports Redis `active`, distributed rate limits & in-flight deduplication verified across 2 staging instances
- **Rollback / Deactivation:** Unset `UPSTASH_REDIS_REST_*` (cleanly falls back to single-node + PG advisory locks)

### Step 8 — External Scheduler Configuration *(Activation Order #4b)*
- **Official Website:** Host native Cron (DigitalOcean / Render / Cloudflare Cron)
- **Required Account:** Same hosting account
- **Exact Configuration Fields:** 5-minute POST to `https://staging.<domain>/api/jobs/run` with header `Authorization: Bearer $CRON_SECRET`
- **Env Vars:** `CRON_SECRET` (≥ 64-char random hex), `BACKGROUND_JOBS_ENABLED=true`
- **Expected Cost:** \$0–\$5/mo `[Estimate]`
- **Required Approval:** Owner staging automation sign-off
- **Verification & Success Criteria:** All 7 job categories run idempotently without duplicate charges/records; Global Emergency Halt immediately skips external-provider jobs
- **Rollback / Deactivation:** Disable cron job and set `BACKGROUND_JOBS_ENABLED=false`

### Step 9 — Qualified Legal Counsel Review
- **Official Scope:** [LEGAL_APPROVAL_CHECKLIST.md](file:///c:/Users/Scorpio/Videos/Instagram/LEGAL_APPROVAL_CHECKLIST.md) (UAE PDPL, GDPR, Terms, Privacy, Cookie, Refund, B2B DPA, Subprocessors, Affiliate Terms, Meta/Commercial Licensing)
- **Expected Cost:** External legal fee `[Quote Required]`
- **Required Approval:** Written legal counsel sign-off
- **Verification & Success Criteria:** Final approved legal text published across all 5 locales
- **Rollback / Deactivation:** Do not open beta or billing until counsel approves

### Step 10 — Independent Security, Accessibility & Performance Verification
- **Official Scope:** Hosted staging Lighthouse (`90+/95+/95+/95+`, LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms), manual NVDA & VoiceOver scripts, and accredited gray-box penetration test ([SECURITY_REVIEW_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/SECURITY_REVIEW_REPORT.md))
- **Expected Cost:** External pen-test fee `[Quote Required]`
- **Required Approval:** Engineering & Security Lead sign-off
- **Verification & Success Criteria:** `0` unresolved High/Critical pen-test findings, hosted Lighthouse & manual screen-reader checks passed
- **Rollback / Deactivation:** Block beta/launch until critical findings remediated & re-tested

### Step 11 — Controlled 14-Day Invitation-Only Beta Authorization
- **Official Scope:** [BETA_EXECUTION_PLAN.md](file:///c:/Users/Scorpio/Videos/Instagram/BETA_EXECUTION_PLAN.md) (25 invited participants across 5×5 cohorts, `BETA_PUBLIC_REGISTRATION_ENABLED=false`)
- **Env Vars:** Keep `BETA_PUBLIC_REGISTRATION_ENABLED=false`; issue SHA-256 invites via Admin Console `/api/beta`
- **Expected Cost:** Covered by staging/pilot caps (~≤ \$60/mo total) `[Estimate]`
- **Required Approval:** Written Owner Beta Commencement Approval + ratified KPI targets
- **Verification & Success Criteria:** 14 consecutive days observed, `0` open S0/S1 defects, verified spend caps/recovery/deletion/halt, documented participant CSAT
- **Rollback / Deactivation:** Revoke open invite codes and/or trigger Emergency Halt

### Step 12 — Separate Payment Sandbox & Billing Authorization *(Final Separate Gate)*
- **Official Website:** https://stripe.com *(primary candidate)*
- **Required Account:** Verified Stripe merchant account (Test Mode first)
- **Exact Configuration Fields:** Install Stripe SDK ONLY after written owner authorization; configure Test Mode keys & signed webhook `/api/webhooks/stripe`
- **Env Vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`; keep `PAYMENTS_ENABLED=false` & `NEXT_PUBLIC_PAYMENTS_ENABLED=false` until ALL 8 tests in [PAYMENT_SANDBOX_TEST_PLAN.md](file:///c:/Users/Scorpio/Videos/Instagram/PAYMENT_SANDBOX_TEST_PLAN.md) pass AND Managing Director signs the separate Billing Go-Live order
- **Expected Cost:** \$0 Test Mode · ~2.9%–3.9% + \$0.30/txn live `[Estimate]`
- **Rollback / Deactivation:** Set `PAYMENTS_ENABLED=false` & `NEXT_PUBLIC_PAYMENTS_ENABLED=false` immediately
