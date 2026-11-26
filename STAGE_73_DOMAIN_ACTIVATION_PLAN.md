# VIEWORA — Stage 73: Custom Domain & Brand Infrastructure Activation Plan

**Date:** 2026-11-26  
**Current Operational Production URL (Kept Active):** https://instagram1-beta.vercel.app  
**Status:** Blueprint Ready — **No domain purchased and no DNS modified** (awaiting owner approval).

---

## 1. Codebase-Verified Domain & SEO Baseline

Direct inspection of the Viewora codebase confirms that canonical URLs, `hreflang` alternates, sitemap, robots, CSRF origin checks, and `__Host-` authentication cookies are **already parameterized dynamically** from `NEXT_PUBLIC_APP_URL` and `AUTH_URL`:

| Subsystem | Source File | Current Verified Behavior |
|---|---|---|
| **Localized Canonical URLs & `hreflang`** | [metadata.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/seo/metadata.ts) | `buildLocalizedUrl()` & `buildHreflangAlternates()` generate `<link rel="canonical">` and `<link rel="alternate" hrefLang="...">` for all 5 locales (`en`, `pt-BR`, `es`, `de`, `fr`) + `x-default` using `NEXT_PUBLIC_APP_URL`. |
| **XML Sitemap** | [sitemap.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/sitemap.ts) | Dynamically renders **135 localized URLs** (27 public paths × 5 locales) with `<xhtml:link rel="alternate" hreflang="...">` entries. |
| **Robots Policy** | [robots.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/robots.ts) | Disallows `/api/`, `/*/dashboard`, `/*/admin`, `/*/auth`, `/*/login`, `/*/register`, `/*/checkout`, `/*/beta`; declares `Sitemap: <NEXT_PUBLIC_APP_URL>/sitemap.xml`. |
| **Locale Middleware** | [middleware.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/middleware.ts) | Redirects `/` to `/<preferredLocale>` based on `viewora_locale` cookie or `Accept-Language` while preserving `/sitemap.xml`, `/robots.txt`, `/api/*`. |
| **Auth Cookies & CSRF** | [session.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/auth/session.ts), [secret.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/auth/secret.ts) | Uses `__Host-viewora_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, **no `Domain` attribute**) in HTTPS production; `isAllowedCsrfOrigin()` validates `Origin` against `AUTH_URL` / `NEXT_PUBLIC_APP_URL` and request `Host`. |
| **Security Headers** | [next.config.ts](file:///c:/Users/Scorpio/Videos/Instagram/next.config.ts) | Emits `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`; Vercel edge enforces `Strict-Transport-Security`. |

---

## 2. Domain Ownership Verification & Vercel Domain Configuration

Let `<DOMAIN>` represent the owner's approved canonical domain (e.g., `viewora.app` — default email addresses in [env.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/env.ts) already reference `viewora.app`):

1. **Domain Acquisition & Registrar Security (Owner Action):**
   - Purchase `<DOMAIN>` at a Tier-1 registrar (Cloudflare Registrar, Namecheap, Porkbun, or Google Cloud Domains).
   - Enable **Registrar Transfer Lock**, **WHOIS Privacy**, **DNSSEC**, and **Hardware/TOTP 2FA** on the registrar account.
2. **Add Domains in Vercel (`scorpioconsultingdxb-9036/instagram1`):**
   - Navigate to Vercel Dashboard → Project `instagram1` → Settings → Domains.
   - Add apex domain `<DOMAIN>` as **Primary Production Domain**.
   - Add `www.<DOMAIN>` configured as a **308 Permanent Redirect → `https://<DOMAIN>`**.
   - If domain was previously associated with another Vercel team, publish Vercel's `_vercel` TXT verification record first.
3. **Preserve `instagram1-beta.vercel.app` During Cutover:**
   - Keep `instagram1-beta.vercel.app` attached during DNS propagation and TLS issuance.
   - After custom domain verification succeeds, either keep `instagram1-beta.vercel.app` as an internal alias or configure a `308` redirect to `https://<DOMAIN>` so search engines never index duplicate hosts.

---

## 3. DNS Requirements & HTTPS Certificate Verification

| Record Type | Host / Name | Target / Value | TTL | Purpose |
|---|---|---|---|---|
| `A` *(or `ALIAS`/`ANAME`)* | `@` (`<DOMAIN>`) | `76.76.21.21` *(or Vercel-assigned project IP)* | `300s` during cutover, then `3600s` | Apex root routing to Vercel Edge Network |
| `CNAME` | `www` | `cname.vercel-dns.com` *(or project-specific Vercel CNAME)* | `300s` → `3600s` | Redirects `www.<DOMAIN>` → `https://<DOMAIN>` |
| `CAA` | `@` | `0 issue "letsencrypt.org"` | `3600s` | Restricts certificate issuance to Let's Encrypt |
| `TXT` *(if required)* | `_vercel` | `vc-domain-verify=<DOMAIN>,<token>` | `300s` | Vercel domain ownership verification |

### HTTPS Certificate & Redirect Verification Checklist
- Verify Vercel displays **Valid Configuration** and **SSL Certificate Issued** (TLS 1.2/1.3, Let's Encrypt auto-renew).
- Confirm `http://<DOMAIN>` → `308` `https://<DOMAIN>`.
- Confirm `https://www.<DOMAIN>` → `308` `https://<DOMAIN>`.
- Confirm `https://<DOMAIN>/` → `307` `https://<DOMAIN>/en` (or `Accept-Language` matched locale).
- Confirm `Strict-Transport-Security` header is present on `https://<DOMAIN>/en`.

---

## 4. Canonical URLs, `AUTH_URL`, `NEXT_PUBLIC_APP_URL` & Cookie Cutover Behavior

### Required Environment Variable Updates (Vercel Production Only — Execute After TLS Is Valid)
1. `AUTH_URL=https://<DOMAIN>`
2. `NEXT_PUBLIC_APP_URL=https://<DOMAIN>`
3. *(When Meta OAuth is later activated)* `META_OAUTH_REDIRECT_URI=https://<DOMAIN>/api/meta/oauth/callback`
4. Trigger **one controlled Production redeployment** so statically generated pages (322 pages), `/sitemap.xml`, and `/robots.txt` rebuild with the new canonical host.

### Authentication Cookie & Session Cutover Behavior
- Because Viewora uses the RFC 6265bis **`__Host-viewora_session`** prefix (`Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, **host-only without `Domain`**):
  - Sessions issued on `instagram1-beta.vercel.app` will **not** transfer to `https://<DOMAIN>` (this is expected and desirable for host-bound security).
  - Existing database sessions remain valid if accessed via the old host until revoked; after cutover, the Super Admin signs in fresh on `https://<DOMAIN>/en/login`, minting a new `__Host-viewora_session` cookie scoped strictly to `<DOMAIN>`.
  - `isAllowedCsrfOrigin()` automatically authorizes `https://<DOMAIN>` once `AUTH_URL` and `NEXT_PUBLIC_APP_URL` are updated.

---

## 5. Localized Canonicals, Sitemap & Search Console Readiness

1. **Post-Cutover Verification:**
   - Fetch `https://<DOMAIN>/sitemap.xml` → verify all **135** `<loc>` and `<xhtml:link rel="alternate" hreflang="...">` entries point to `https://<DOMAIN>/...` (zero `instagram1-beta.vercel.app` references).
   - Fetch `https://<DOMAIN>/robots.txt` → verify `Sitemap: https://<DOMAIN>/sitemap.xml` and private routes remain disallowed.
   - Inspect HTML `<head>` across `/en`, `/pt-BR`, `/es`, `/de`, `/fr` → verify exact self-referencing canonical URL and 6 `hrefLang` alternates (`en`, `pt-BR`, `es`, `de`, `fr`, `x-default`).
2. **Google Search Console & Bing Webmaster Setup:**
   - Create a **Domain Property** (`<DOMAIN>`) verified via DNS `TXT` record (`google-site-verification=...`).
   - Submit `https://<DOMAIN>/sitemap.xml`.
   - Confirm `/en/dashboard`, `/en/admin`, `/en/login`, `/en/register` remain excluded (`noindex` / `robots.txt` disallowed).

---

## 6. Transactional Email Domain & SPF / DKIM / DMARC Preparation

Do **not** activate `PROVIDER_RESEND_ENABLED` until email authentication DNS records verify cleanly:

- **Recommended Sender Subdomain (Protects Apex Reputation):** `mail.<DOMAIN>` (or apex `<DOMAIN>` if preferred) with:
  - `EMAIL_FROM_ADDRESS=noreply@<DOMAIN>`
  - `EMAIL_REPLY_TO=support@<DOMAIN>`
- **Required DNS Records (Provisioned When Resend Domain Is Added):**

| Protocol | DNS Record | Purpose | Rollout Policy |
|---|---|---|---|
| **SPF** | `TXT` on `send.<DOMAIN>` (Resend custom return-path) + apex `TXT`: `v=spf1 include:amazonses.com ~all` *(exact value from Resend)* | Authorizes sending IPs and prevents spoofing | Verify single SPF record (never duplicate `v=spf1`) |
| **DKIM** | `TXT` / `CNAME` (`resend._domainkey.<DOMAIN>` — 2048-bit RSA key provided by Resend) | Cryptographically signs outbound emails | Must show `Verified` in Resend before enabling |
| **DMARC** | `TXT` on `_dmarc.<DOMAIN>`: Phase 1 `v=DMARC1; p=none; rua=mailto:dmarc@<DOMAIN>; pct=100; adkim=s; aspf=s` | Telemetry → enforcement against domain spoofing | Day 1–14: `p=none` → Day 15–30: `p=quarantine` → Production: `p=reject` |
| **Inbound Support MX** | `MX` records for `support@<DOMAIN>` (Google Workspace / Cloudflare Email Routing) | Ensures replies to `support@<DOMAIN>` are received | Required before public beta launch |

---

## 8. Final 12-Point Domain Activation Checklist (Zero Purchases / Zero DNS Changes Made)

- [ ] **1. Domain Ownership:** Purchase canonical `<DOMAIN>`, enable Registrar Lock, WHOIS Privacy, DNSSEC, and 2FA; publish `_vercel` TXT record if requested.
- [ ] **2. DNS Configuration:** Configure apex `A` (`76.76.21.21` / Vercel project IP), `www` `CNAME` (`cname.vercel-dns.com`), and `CAA` (`0 issue "letsencrypt.org"`).
- [ ] **3. Vercel Configuration:** Attach `<DOMAIN>` as Primary Production Domain and `www.<DOMAIN>` as 308 redirect in `scorpioconsultingdxb-9036/instagram1` while keeping `https://instagram1-beta.vercel.app` operational during verification.
- [ ] **4. TLS & HSTS Verification:** Confirm Valid Configuration, TLS 1.2/1.3 Let's Encrypt issuance, HTTP→HTTPS 308, and `Strict-Transport-Security` header.
- [ ] **5. Canonical URLs:** Update `NEXT_PUBLIC_APP_URL=https://<DOMAIN>` and redeploy so all 322 static pages emit `<link rel="canonical" href="https://<DOMAIN>/...">` and 6 `hrefLang` alternates.
- [ ] **6. Authentication Origins:** Update `AUTH_URL=https://<DOMAIN>` so `isAllowedCsrfOrigin()` strictly enforces the new canonical origin.
- [ ] **7. Host-Bound Session Cookies:** Verify `__Host-viewora_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`) issues cleanly on fresh login to `https://<DOMAIN>/en/login`.
- [ ] **8. Redirects:** Verify `http://<DOMAIN>`, `https://www.<DOMAIN>`, and `/` locale redirects (`308`/`307`) with zero redirect loops.
- [ ] **9. Sitemap & Robots:** Verify `https://<DOMAIN>/sitemap.xml` (135 URLs) and `https://<DOMAIN>/robots.txt` reference `https://<DOMAIN>` exclusively.
- [ ] **10. Search Console:** Verify Domain Property via DNS TXT and submit `https://<DOMAIN>/sitemap.xml`.
- [ ] **11. Email Sending Subdomain:** Reserve `mail.<DOMAIN>` (or apex `<DOMAIN>`) for Stage 75 Resend transactional email (`noreply@mail.<DOMAIN>`, `support@<DOMAIN>`).
- [ ] **12. SPF, DKIM & DMARC:** Publish Resend return-path `MX`/`SPF`, 2048-bit `DKIM`, and phased `_dmarc` (`p=none` → `p=quarantine` → `p=reject`) before activating Resend.

## 7. Estimated Domain & Email Infrastructure Costs

| Item | Provider Option | Estimated Cost (USD) | Purchased? |
|---|---|---|---|
| Custom `.app` / `.com` Domain | Cloudflare Registrar / Namecheap | `\$11–\$18 / year` | **No — awaits owner approval** |
| DNS & SSL Certificates | Cloudflare Free DNS + Vercel Let's Encrypt | `\$0 / mo` | N/A |
| Transactional Email (Pre-Beta / Early Beta) | Resend Free Tier (`3,000 emails/mo`, `100/day`) | `\$0 / mo` (Pro `\$20/mo` at `50k/mo`) | **No — disabled** |
| Support Inbox (`support@<DOMAIN>`) | Cloudflare Email Routing (forwarding) or Google Workspace | `\$0 / mo` (forwarding) or `\$6–\$7 / user / mo` | **No — awaits owner approval** |
