# VIEWORA — Stage 75: Resend Transactional Email Activation Plan

**Date:** 2026-11-26  
**Activation Status:** **PREPARED ONLY — RESEND REMAINS DISABLED** (`PROVIDER_RESEND_ENABLED=false`, `EMAIL_NOTIFICATIONS_ENABLED=false`, `RESEND_API_KEY=""`, zero real emails sent).

---

## 1. Verified Codebase Email Architecture Inventory

Direct source-code inspection confirms that Viewora's transactional email architecture is already implemented, hardened, and persisted in Neon PostgreSQL 18.7:

| Component | Source File | Verified Implementation |
|---|---|---|
| **19 Templates × 5 Languages = 95 Localized Variants** | [templates.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/email/templates.ts), [catalog.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/email/catalog.ts) | Exactly **19** templates across **5** supported locales (`en`, `pt-BR`, `es`, `de`, `fr`), rendering both HTML (`escapeHtml` XSS-safe) and plain-text bodies with localized subjects and localized compliance footers. |
| **Mandatory Security Category (10 Templates)** | `EMAIL_TEMPLATE_CATALOG` | `welcome`, `email_verification`, `verification_resend`, `password_reset`, `password_changed`, `email_changed`, `security_login_alert`, `account_recovery`, `account_deletion_confirmation`, `account_deletion_completed` — **always sent regardless of marketing preferences**; footer explicitly discloses mandatory security classification. |
| **Optional Engagement Category (9 Templates)** | `EMAIL_TEMPLATE_CATALOG` | `onboarding_reminder`, `research_project_reminder`, `report_completed`, `weekly_activity_summary`, `membership_usage_alert`, `product_announcement` (`requiresMarketingConsent: true`), `feedback_acknowledgment`, `support_ticket_response`, `affiliate_application_update` — gated by user preferences & suppression list; includes signed one-click unsubscribe + preferences links. |
| **Resend Adapter & Dual Kill Switch** | [resend.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/email/resend.ts) | Calls `https://api.resend.com/emails` (SSRF-validated via `validateOutboundProviderUrl('resend_email', ...)`) ONLY when **BOTH** `PROVIDER_RESEND_ENABLED=true` AND `EMAIL_NOTIFICATIONS_ENABLED=true` AND `RESEND_API_KEY` is configured. Sends `Idempotency-Key: <dedupeKey>`, 8-second `AbortController` timeout, and never fabricates `delivered` status when disabled. |
| **Privacy-Safe Delivery Records** | [email.repo.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/repositories/email.repo.ts) | Persists operational records in PostgreSQL `public.email_deliveries` with masked recipient email (`ab***@domain`), `dedupeKey` unique deduplication, `providerMessageId`, lifecycle status (`queued`, `accepted_by_provider`, `delivered`, `bounced`, `complained`, `failed`, `suppressed`, `disabled`), and redacted error summaries. **Never stores raw verification tokens or HTML message bodies.** |
| **Bounce, Complaint & Unsubscribe Suppression** | [email.repo.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/repositories/email.repo.ts) | Persists `email_suppressions_v1` in `public.system_settings` (up to 5,000 entries) covering `hard_bounce`, `complaint`, and `unsubscribed`. Automatically skips `optional_engagement` sends to suppressed addresses while keeping `mandatory_security` operational. |
| **Webhook Signature Verification & Replay Protection** | [webhooks/resend/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/webhooks/resend/route.ts), [resend.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/email/resend.ts) | Enforces `256 KB` payload cap (`413`), verifies Svix headers (`svix-id`, `svix-timestamp` with strict `300s` / 5-minute replay drift window, `svix-signature` HMAC-SHA256 with `whsec_` base64 decoding and `timingSafeEqual`), and deduplicates `(provider='resend', event_id)` in PostgreSQL `public.webhook_events` (`P2002`). Updates `email_deliveries` for `email.delivered`, `email.bounced` (+ `hard_bounce` suppression), and `email.complained` (+ `complaint` suppression). |
| **Signed One-Click Unsubscribe** | [email/unsubscribe/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/email/unsubscribe/route.ts) | Verifies HMAC-SHA256 signed token (`createSignedUnsubscribeToken` / `verifySignedUnsubscribeToken` using `getRequiredAuthSecret()` + `timingSafeEqual`) and records `unsubscribed` suppression without exposing other user data. |
| **Admin Communications Interface** | [admin/communications/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/admin/communications/route.ts), [AdminConsole.tsx](file:///c:/Users/Scorpio/Videos/Instagram/src/components/admin/AdminConsole.tsx) | Protected by `requireAdminApi()` with `Cache-Control: private, no-store`; displays Resend status badge, `fromAddress`, 7 delivery status KPI tiles, suppressed address count, recent sanitized errors, and the full `19 × 5` multilingual template catalog. |

### Minor Pre-Activation Observation (Non-Blocking)
- `RESEND_WEBHOOK_SECRET` is read directly from `process.env.RESEND_WEBHOOK_SECRET` in [resend.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/email/resend.ts#L85) (it is not declared in `envSchema` inside `src/lib/env.ts`, which works at runtime but should be added to `envSchema` & `.env.production.example` during Stage 75 activation for completeness).
- Note that `sentDedupeKeys` in `resend.ts` is process-local, while durable cross-instance idempotency is guaranteed by PostgreSQL `public.email_deliveries.dedupeKey` unique index + Resend's `Idempotency-Key` header.

---

## 2. Stage 75 Resend Activation Checklist (Do Not Execute Until Authorized)

### Step 1 — Resend Account & Verified Sending Domain
1. Create a Resend account under the official Viewora corporate email (Free tier: `3,000 emails/mo`, `100 emails/day`, `$0/mo`; Pro tier: `50,000 emails/mo`, `$20/mo` — do not upgrade until volume requires it).
2. Complete **Stage 73 Custom Domain Activation** first (Resend requires a verified domain owned by Viewora; `instagram1-beta.vercel.app` cannot be used for verified DKIM/SPF sending).
3. Add dedicated sending subdomain **`mail.<DOMAIN>`** (recommended to isolate transactional reputation from corporate email) or apex `<DOMAIN>` in Resend → Domains.

### Step 2 — DNS Authentication Records (SPF, DKIM, DMARC)
Publish the exact records provided by Resend and confirm **Verified** status before creating production keys:

| Record | Host | Purpose |
|---|---|---|
| `MX` | `send.mail.<DOMAIN>` *(or `send.<DOMAIN>`)* | Resend bounce return-path (`feedback-smtp.<region>.amazonses.com`, priority `10`) |
| `TXT` (SPF) | `send.mail.<DOMAIN>` | `v=spf1 include:amazonses.com ~all` |
| `TXT` (DKIM) | `resend._domainkey.mail.<DOMAIN>` | 2048-bit RSA public key provided by Resend |
| `TXT` (DMARC) | `_dmarc.<DOMAIN>` | Phase 1: `v=DMARC1; p=none; rua=mailto:dmarc@<DOMAIN>; pct=100` → Phase 2: `p=quarantine` → Phase 3: `p=reject` |

### Step 3 — Least-Privilege Restricted API Key & Webhook Secret
1. In Resend → API Keys → Create API Key:
   - Name: `viewora-production-sending`
   - Permission: **Sending access ONLY** (NOT Full Access)
   - Domain restriction: **Locked to verified `<DOMAIN>` / `mail.<DOMAIN>` ONLY**
2. In Resend → Webhooks → Add Webhook:
   - Endpoint URL: `https://<CANONICAL_DOMAIN>/api/webhooks/resend`
   - Events subscribed: `email.delivered`, `email.bounced`, `email.complained`
   - Copy the signing secret (`whsec_...`) — **never paste into chat, git, or URLs**.

### Step 4 — Vercel Production Environment Variables (All Sensitive Marked `Secret`)

| Variable | Value / Setting | Scope |
|---|---|---|
| `RESEND_API_KEY` | Restricted sending-only key (`re_...`) | Production (`Secret`) |
| `RESEND_WEBHOOK_SECRET` | Svix signing secret (`whsec_...`) | Production (`Secret`) |
| `EMAIL_FROM_ADDRESS` | `Viewora <noreply@mail.<DOMAIN>>` *(or `noreply@<DOMAIN>`)* | Production |
| `EMAIL_REPLY_TO` | `support@<DOMAIN>` | Production |
| `PROVIDER_RESEND_ENABLED` | `true` *(only when ready to activate)* | Production |
| `EMAIL_NOTIFICATIONS_ENABLED` | `true` *(only when ready to activate)* | Production |

### Step 5 — Authorized Test Recipient & Delivery Acceptance Testing
Before opening beta onboarding, perform a controlled acceptance run targeting **ONLY owner-authorized test mailboxes**:
1. **Password Reset (`password_reset`):** Trigger `/api/auth/forgot-password` for an authorized test account → verify inbox receipt, DKIM/SPF pass in raw headers, single-use token works once, and `email_deliveries` transitions `accepted_by_provider` → `delivered` via webhook.
2. **Email Verification (`email_verification` & `verification_resend`):** Verify single-use link marks `email_verified` and expires cleanly.
3. **Security Notification (`password_changed` / `security_login_alert`):** Confirm delivery even when optional marketing preferences are disabled.
4. **Webhook Replay & Invalid Signature Check:** Send a forged signature to `/api/webhooks/resend` → confirm HTTP `401`; replay a valid `svix-id` → confirm HTTP `200` `{"ok":true,"deduplicated":true}`.
5. **Bounce/Complaint & Unsubscribe Verification:** Verify Resend's official test sink (`bounced@resend.dev` / `complained@resend.dev`) triggers `addEmailSuppression` and blocks subsequent `optional_engagement` sends, and verify one-click `/api/email/unsubscribe?token=...` works cleanly.
6. **Admin Communications Console Check:** Open `/en/admin` → `Communications` tab and verify counts update accurately with masked recipient addresses and zero secret exposure.

### Step 6 — Rate Limits, Cost Controls & Emergency Disable Switch
- **Rate Limits:** Existing auth route rate limits (`checkAuthRateLimit` on login/forgot-password/resend-verification) + `PROVIDER_RATE_LIMIT_PER_MIN` (`30/min` default) + per-event `dedupeKey` prevent email storms.
- **Cost Controls:** Start on Resend Free (`3,000/mo`, `100/day` hard ceiling) with billing alerts before ever upgrading to Pro (`$20/mo`).
- **Instant Emergency Disable Switch (Kill Switch):** Set `PROVIDER_RESEND_ENABLED=false` **or** `EMAIL_NOTIFICATIONS_ENABLED=false` in Vercel Production and redeploy (or toggle via Vercel env + redeploy) — `sendTransactionalEmail()` immediately stops all outbound HTTP calls and logs `status: 'disabled'` without crashing auth flows.
