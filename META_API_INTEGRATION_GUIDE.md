# Viewora — Official Meta Instagram Graph API Integration Guide (Stage 42)

**Date:** 2026-11-26  
**Activation Status:** **Implemented & contract-verified — DISABLED BY DEFAULT (`PROVIDER_META_ENABLED=false`, `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=false`) awaiting owner Meta App credentials & App Review.**

---

## 1. Legitimate Access Modes Supported

Viewora strictly limits Meta integration to two official, policy-compliant paths:

1. **Meta Instagram Business Discovery (`meta_official`):**
   - Queries publicly available metadata (`followers_count`, `follows_count`, `media_count`, `biography`, `website`, recent public media) exclusively for **public Instagram Business and Creator accounts** via `https://graph.facebook.com/<version>/<ig_business_id>?fields=business_discovery.username(...)`.
   - Personal or private accounts return Graph error `803` / HTTP `404`, which Viewora normalizes to `not_business_or_private` and stops fallback immediately.
2. **Authorized Connected-Account Insights (`authorized_insights`):**
   - First-party OAuth 2.0 connection allowing an authenticated Viewora customer to connect **their own** Instagram Business or Creator account to view owner-authorized insights.
   - Tokens are NEVER shared across customers, NEVER exposed to client browsers, and strictly scoped via PostgreSQL RLS (`provider_connections_owner_only`).

**Hard Prohibitions:** Zero scraping, zero private account lookup, zero Instagram username/password collection, zero hidden follower/viewer activity tracking.

---

## 2. Implemented Endpoints & Security Controls

| Component | File | Security Enforcement |
| :--- | :--- | :--- |
| **OAuth Crypto & Errors** | [src/lib/meta/oauth.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/meta/oauth.ts) | Supported versions `v19.0`–`v23.0`; HMAC-SHA256 user-bound CSRF `state` (`10m` TTL, timing-safe check); required scope validation (`instagram_basic`, `instagram_manage_insights`, `pages_show_list`); Graph error normalization (`190` expired, `10/200` permission denied, `4/17/32/613` rate limit, `803` unavailable); webhook `X-Hub-Signature-256` HMAC verification. |
| **Token Encryption at Rest** | [src/lib/security/token-crypto.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/security/token-crypto.ts) | AES-256-GCM authenticated encryption (`v1:<iv>:<tag>:<cipher>`) with HKDF-SHA256 key derived from `AUTH_SECRET`; unique 96-bit random IV per write. |
| **RLS Connection Store** | [src/lib/db/repositories/provider-connections.repo.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/db/repositories/provider-connections.repo.ts) | Stores encrypted tokens inside `withUserRlsContext`; `listUserProviderConnections()` strips all token columns; `disconnectUserProviderConnection()` immediately sets `status = 'revoked'` and nulls `encryptedAccessToken`. |
| **OAuth Start** | [src/app/api/meta/oauth/start/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/meta/oauth/start/route.ts) | Requires authenticated Viewora session; returns HTTP `503` when disabled; sets `HttpOnly`, `SameSite=Lax`, `Secure` (HTTPS prod) state cookie. |
| **OAuth Callback** | [src/app/api/meta/oauth/callback/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/meta/oauth/callback/route.ts) | Verifies CSRF cookie + HMAC user binding + SSRF host allowlist (`graph.facebook.com`) + 1 MB bounded JSON response + granted scopes before persisting encrypted token. |
| **Connection Management** | [src/app/api/meta/connections/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/meta/connections/route.ts) | `GET` lists non-secret connections + `oauthEnabled` status; `DELETE` enforces CSRF origin check, scrubs encrypted token, and writes immutable audit log. |
| **Meta Webhooks** | [src/app/api/webhooks/meta/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/webhooks/meta/route.ts) | `GET` hub challenge verification; `POST` enforces 256 KB body ceiling, `X-Hub-Signature-256` HMAC check, durable PostgreSQL `webhook_events` replay deduplication, and automatic token revocation on permission-revoke callbacks. |

---

## 3. Step-by-Step Owner Activation Procedure (When Approved)

1. Create a Meta Developer App (Business type) and complete Meta Business Verification.
2. Add the **Instagram Graph API** product and submit App Review for `instagram_basic`, `instagram_manage_insights`, and `pages_show_list` (with screencast demonstrating Viewora's transparent analytics dashboard).
3. Configure server-only environment variables in `.env.local` (or hosted secret vault — NEVER commit):
   - `META_API_VERSION=v21.0`
   - `META_APP_ID=...`
   - `META_APP_SECRET=...`
   - `META_OAUTH_REDIRECT_URI=https://<your-domain>/api/meta/oauth/callback`
   - `META_WEBHOOK_VERIFY_TOKEN=<random-32-char-token>`
   - For Business Discovery: `META_GRAPH_API_ACCESS_TOKEN=...` and `META_INSTAGRAM_BUSINESS_ACCOUNT_ID=...`
4. Enable feature flags only after verifying staging health:
   - `PROVIDER_META_ENABLED=true` (Business Discovery)
   - `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=true` (First-party customer OAuth)
5. Register `https://<your-domain>/api/webhooks/meta` in the Meta App Dashboard for deauthorization/permission revocation events.
6. Confirm status transitions from `DISABLED BY FLAG` to `ENABLED READY` inside the Super Admin **Integration Center**.
