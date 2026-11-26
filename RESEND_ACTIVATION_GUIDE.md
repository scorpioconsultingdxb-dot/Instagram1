# Viewora — Resend Transactional Email Activation Guide (Stage 63)

**Date:** 2026-11-26  
**Activation Status:** **AWAITING OWNER DOMAIN DNS & CREDENTIALS (`PROVIDER_RESEND_ENABLED=false`, `EMAIL_NOTIFICATIONS_ENABLED=false`)**  
**Codebase Readiness:** 19 templates × 5 locales = **95** responsive HTML + plain-text variants ([`src/lib/email/templates.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/email/templates.ts)), durable PostgreSQL `email_deliveries` & suppression list ([`src/lib/db/repositories/email.repo.ts`](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/repositories/email.repo.ts)), Svix HMAC-SHA256 replay-protected `/api/webhooks/resend`, signed `/api/email/unsubscribe`, and Admin Communications Center all **implemented and unit/PG-verified**.

---

## 1. Verified Resend Pricing Plans (2026 Official Published Tiers)

| Plan | Monthly Cost `[Verified List]` | Monthly Volume | Daily Cap | Domains | Overage Rate |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Free** | **\$0 / mo** | 3,000 emails / mo | 100 / day hard cap | Up to 3 | None (pauses at limit) |
| **Pro** *(Recommended for Staging + Early Launch)* | **\$20 / mo** (50k) – **\$35 / mo** (100k) | 50,000 – 100,000 / mo | None | 10 | \$0.90 / 1,000 extra |
| **Scale** | **\$90 – \$1,150+ / mo** | 100,000 – 2,500,000 / mo | None | 1,000 | \$0.46 – \$0.90 / 1,000 |

*Recommendation:* Use **Resend Free (\$0)** strictly for isolated Staging verification (≤ 100/day), and upgrade to **Resend Pro (\$20/mo, 50,000 emails, no daily cap)** prior to opening the 14-day Beta / Commercial Launch.

---

## 2. Exact Owner Account, DNS & Webhook Setup Checklist

1. **Create Dedicated Sending Subdomain:** Configure `mail.<owner-domain>` (e.g., `noreply@mail.viewora.app`) so transactional reputation is isolated from corporate email.
2. **Publish Mandatory DNS Records (No Unauthorized DNS Changes Executed):**
   - **SPF (`TXT` on sending subdomain):** Authorize Resend's exact SPF include string provided in the Resend Domains dashboard (`v=spf1 include:amazonses.com ~all` / Resend return-path record).
   - **DKIM (`TXT` / `CNAME` selectors):** Publish all Resend-issued DKIM signing keys and confirm **`Verified`** status in Resend dashboard.
   - **DMARC (`TXT` at `_dmarc.<owner-domain>`):** Start at `v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@<owner-domain>` and advance to `p=reject` after verifying alignment.
   - **Custom Return-Path (`MX` + `TXT`):** Verify bounce return-path alignment.
3. **Configure Resend Webhook Endpoint:**
   - Target URL: `https://staging.<owner-domain>/api/webhooks/resend` (then production URL).
   - Subscribe to events: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_delayed`.
   - Copy the Svix signing secret (`whsec_...`) into `RESEND_WEBHOOK_SECRET` in the hosted secret manager.
4. **Store Restricted API Key:** Create a **Sending-access-only** API key scoped exclusively to the verified domain and store in `RESEND_API_KEY`.

---

## 3. Post-Approval Controlled Staging Verification Protocol

> **Honesty Rule:** Never treat Resend HTTP `200` acceptance (`accepted`) as confirmed inbox delivery. Delivery is confirmed **only** after BOTH the signed `email.delivered` webhook updates `email_deliveries` AND actual receipt is visually confirmed in authorized test mailboxes (`Gmail`, `Outlook/Microsoft 365`, and `Apple Mail` / custom IMAP). **Never send test messages to genuine customers.**

1. Flip `PROVIDER_RESEND_ENABLED=true` and `EMAIL_NOTIFICATIONS_ENABLED=true` on **Staging only**.
2. Execute and verify actual inbox delivery + SPF/DKIM/DMARC `PASS` headers across all 5 mandatory staging flows:
   - Registration email verification (`email_verification`)
   - Verification resend (`verification_resend`)
   - Password recovery (`password_reset`)
   - Security alert notification (`security_login_alert` / `password_changed`)
   - Support communication reply (`support_ticket_update`)
3. Trigger Resend's official test sink addresses (`bounced@resend.dev`, `complained@resend.dev`) to verify webhook signature authentication, replay deduplication, `email_deliveries` state transition (`bounced` / `complained`), and automatic addition to Viewora's PostgreSQL suppression list.
4. Click a signed `/api/email/unsubscribe` link from an optional engagement email and verify optional emails stop while mandatory security emails remain deliverable.
