# Viewora — Email Sending Domain & Resend Configuration Guide (Stage 47.6)

**Date:** 2026-11-26  
**Note:** Do NOT modify DNS records until the owner approves the sending domain and creates the Resend account.

---

## 1. Sending Domain & DNS Requirements

Use a dedicated transactional subdomain (recommended: `mail.viewora.app` or `notify.viewora.app`) to isolate domain reputation from the root website domain:

1. **SPF (TXT Record):** Authorize Resend / Amazon SES return-path mailers (`v=spf1 include:amazonses.com ~all` or the exact Resend-issued SPF record for your chosen region).
2. **DKIM (3× CNAME / TXT Records):** Publish all Resend-issued DKIM signing records (`resend._domainkey.<subdomain>`) so every outgoing email is cryptographically signed.
3. **DMARC (TXT Record at `_dmarc.<domain>`):** Start with `v=DMARC1; p=quarantine; rua=mailto:dmarc@viewora.app; adkim=s; aspf=s;` and tighten to `p=reject` after verifying alignment.
4. **Custom Return-Path (MX + SPF on `send.<subdomain>`):** Configure Resend's custom return-path CNAME/MX record so bounce alignment passes strict DMARC SPF alignment.

---

## 2. Required Server Environment Variables (Never Commit)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PROVIDER_RESEND_ENABLED` | `false` | Master provider flag in Integration Center |
| `EMAIL_NOTIFICATIONS_ENABLED` | `false` | Secondary transactional dispatch gate |
| `RESEND_API_KEY` | `""` | Server-only Resend API key (`re_...`) |
| `RESEND_WEBHOOK_SECRET` | `""` | Svix signing secret (`whsec_...`) for `/api/webhooks/resend` |
| `EMAIL_FROM_ADDRESS` | `noreply@viewora.app` | Verified domain sender address |
| `EMAIL_REPLY_TO` | `support@viewora.app` | Monitored support reply-to address |

---

## 3. Webhook & Test Delivery Procedure (Staging Only)

1. In Resend Dashboard → **Webhooks**, register `https://<staging-domain>/api/webhooks/resend` subscribing to `email.delivered`, `email.bounced`, and `email.complained`.
2. Store the issued `whsec_...` value in `RESEND_WEBHOOK_SECRET`.
3. Enable `PROVIDER_RESEND_ENABLED=true` and `EMAIL_NOTIFICATIONS_ENABLED=true` on staging.
4. Trigger a single test verification email to an owner-controlled inbox and verify:
   - SPF, DKIM, and DMARC all show `PASS` in email headers.
   - `email_deliveries` transitions from `accepted_by_provider` → `delivered` upon Resend webhook callback.
   - Clicking the signed unsubscribe link on an optional email registers suppression cleanly without affecting mandatory security emails.
