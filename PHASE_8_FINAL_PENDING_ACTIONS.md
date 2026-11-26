# VIEWORA — Phase 8 Final Pending Owner Actions

**Date:** 2026-11-26  
**Live Canonical Production URL:** https://instagram1-beta.vercel.app (`dpl_4kCzhJk5xJJNboSSo52BMiZyjEer`, `READY`)  
**Purpose:** Single consolidated list of every remaining owner-gated action before Controlled Closed Beta and Stage 75 activation.

---

## Priority 1 — Immediate Pre-Beta Operational Actions (`\$0` Cost)

### 1. Commit Phase 8 Hardening Changes to Git
- **What:** Commit the verified Phase 8 codebase changes (`src/components/dashboard/*`, `src/app/[locale]/onboarding/page.tsx`, `src/app/api/health/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/admin/overview/route.ts`, `src/lib/observability/*`, `deploy/scripts/neon-encrypted-backup-drill.sh`, `.github/workflows/neon-dr-backup-drill.yml`, `.vercelignore`, and Phase 8 reports) to your Git repository.
- **Verify:** `.env.local`, `.env.hosted.local`, and `.vercel` remain git-ignored (`git status` shows zero secret files).

### 2. Complete Stage 71 Live Authenticated Browser QA & Screenshots
- **Blocker:** Agent cannot access your live signed-in browser session (passwords and cookies are never extracted).
- **Action:** Sign in at https://instagram1-beta.vercel.app/en/login (desktop `1440px` + mobile `390px`), walk through all 18 customer & admin modules (Operations HQ, Personal Digital HQ, Saved Profiles, Research Pro, Analytics, Competitors, Report Builder, Reports & Exports, AI Studio, Timeline, Calendar, Agency & Team, Automation, Referrals, Notifications, Membership, Support, Privacy & Settings, Super Admin Console), verify zero misleading Demo Preview controls appear, test locale switcher (`en`, `pt-BR`, `es`, `de`, `fr`), test hard reload persistence and logout, and capture redacted live dark-mode screenshots of Dashboard and Super Admin Console.
- **Reference:** [STAGE_71_AUTHENTICATED_QA_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/STAGE_71_AUTHENTICATED_QA_REPORT.md)

### 3. Configure Free External Uptime Monitoring (Task 6)
- **Action:** Create a free Better Stack Uptime or UptimeRobot monitor targeting:
  - `GET https://instagram1-beta.vercel.app/api/health` (expect HTTP `200` + `"status":"healthy"`, **20s timeout** for Neon cold wake-up, **5-min interval**, **2 consecutive failures** confirmation).
  - `GET https://instagram1-beta.vercel.app/en` (expect HTTP `200`, 15s timeout, 3-min interval, 2 consecutive failures).
- **Reference:** [STAGE_74_MONITORING_READINESS_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/STAGE_74_MONITORING_READINESS_REPORT.md)

### 4. Rotate `neondb_owner` Password & Prune Pre-Isolation Vercel Deployments (Task 4)
- **Why:** ~17+ historical Vercel deployments (`instagram1-1uwzrmu1n` and older) retain immutable build-time snapshots of old `neondb_owner` Marketplace credentials.
- **Zero-Downtime Procedure:**
  1. Rotate `neondb_owner` password in Neon Console → `neon-bisque-harbor` → Roles (**do NOT touch `viewora_app`**; live Production stays online with zero downtime).
  2. Update `DATABASE_ADMIN_URL` in local `.env.hosted.local` and verify with `npm run db:hosted:inspect`.
  3. Unscope or re-sync Vercel `Preview` Neon vars as desired.
  4. Delete stale pre-isolation Vercel deployments older than `instagram1-nwyx3am19`, keeping the latest 2–3 clean post-isolation deployments for rollback.
- **Reference:** [STAGE_72_DISASTER_RECOVERY_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/STAGE_72_DISASTER_RECOVERY_REPORT.md)

### 5. Execute First Real Encrypted Backup & Isolated Branch Restore Drill (Task 5)
- **Action:**
  1. In GitHub → Repository Settings → Environments, create `production-dr` with required reviewer approval and add secrets: `NEON_ADMIN_SOURCE_URL`, `NEON_RESTORE_TARGET_URL` (pointing to a **new temporary Neon child branch**, NEVER `main`), `NEON_PRODUCTION_MAIN_HOST`, and `BACKUP_ENCRYPTION_KEY` (64+ random hex chars saved offline).
  2. Manually trigger `.github/workflows/neon-dr-backup-drill.yml` (`confirm_isolated_branch = ISOLATED_DR_BRANCH`).
  3. Download & archive the sanitized `dr-summary.json` artifact with measured RTO/backup/restore timings.
  4. Delete the temporary Neon child branch in Neon Console.
- **Reference:** [STAGE_72_DISASTER_RECOVERY_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/STAGE_72_DISASTER_RECOVERY_REPORT.md)

---

## Priority 2 — Brand & Transactional Email Activation (Owner Budget Approval Required)

### 6. Custom Domain Purchase & Cutover (Stage 73)
- **Estimated Cost:** `\$11–\$18 / year` (registrar) + `\$0 / mo` DNS/TLS.
- **Action:** Purchase canonical domain (e.g., `viewora.app`), attach apex + `www` 308 redirect in Vercel, verify Let's Encrypt HTTPS, update `AUTH_URL` and `NEXT_PUBLIC_APP_URL`, perform one controlled Production redeploy, sign in fresh on the custom domain (`__Host-viewora_session`), and submit `/sitemap.xml` (135 URLs) in Google Search Console.
- **Reference:** [STAGE_73_DOMAIN_ACTIVATION_PLAN.md](file:///c:/Users/Scorpio/Videos/Instagram/STAGE_73_DOMAIN_ACTIVATION_PLAN.md)

### 7. Stage 75 — Resend Transactional Email Activation
- **Prerequisite:** Step 6 (Custom Domain verified).
- **Estimated Cost:** `\$0 / mo` (Resend Free: `3,000/mo`, `100/day`).
- **Action:** Add `mail.<DOMAIN>` in Resend, verify `MX`/`SPF`/`DKIM`/`DMARC`, create sending-only domain-restricted `RESEND_API_KEY`, configure `/api/webhooks/resend` + `RESEND_WEBHOOK_SECRET`, set `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO`, `PROVIDER_RESEND_ENABLED=true`, `EMAIL_NOTIFICATIONS_ENABLED=true`, and run delivery + webhook + suppression acceptance tests against owner-authorized test mailboxes only.
- **Reference:** [STAGE_75_RESEND_ACTIVATION_PLAN.md](file:///c:/Users/Scorpio/Videos/Instagram/STAGE_75_RESEND_ACTIVATION_PLAN.md)

---

## Priority 3 — Post-Stage 75 Commercial Rollout Sequence (Separate Approvals Required)

8. **Upgrade Hosting/DB Tiers Before External Beta Users:** Evaluate Neon Launch (`~\$19/mo`, 7-day PITR) and Vercel Pro (`\$20/mo`, commercial Terms & Log Drains), plus optional Sentry Developer (`\$0/mo`) error tracking.
9. **Activate Gemini AI Engine:** Configure `GEMINI_API_KEY`, verify daily (`\$10`) / monthly (`\$150`) caps & kill switch, enable `PROVIDER_GEMINI_ENABLED=true`.
10. **Activate Official Meta / Authorized Insights Provider:** Complete Meta App Review and enable `PROVIDER_META_ENABLED=true`.
11. **Provision Durable Rate-Limiting & Background Workers:** Provision Upstash Redis + Vercel Cron (`CRON_SECRET`) and enable `BACKGROUND_JOBS_ENABLED=true`.
12. **Legal Sign-Off & 14-Day Invitation-Only Beta:** Finalize Privacy/Terms/Entity disclosures and open controlled beta (`BETA_PUBLIC_REGISTRATION_ENABLED=true` or invite codes).
13. **Separate Phase 7 Billing & Payments Gate:** Only after beta sign-off and tax/legal review, complete Stripe onboarding and unlock `PAYMENTS_ENABLED=true` + `NEXT_PUBLIC_PAYMENTS_ENABLED=true`.
