# Viewora — Official Meta Instagram API Activation Guide (Stage 65)

**Date:** 2026-11-26  
**Activation Status:** **AWAITING OWNER META BUSINESS VERIFICATION & APP REVIEW (`PROVIDER_META_ENABLED=false`, `PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=false`)**  
**Codebase Readiness:** AES-256-GCM encrypted `provider_connections` under RLS, HMAC-SHA256 user-bound OAuth CSRF state, `/api/meta/oauth/{start,callback}`, `/api/meta/connections` disconnect, 256 KB replay-deduplicated `/api/webhooks/meta`, and SSRF port-443 host allowlist are **all implemented and verified locally**.

---

## 1. Verified Official Meta / Instagram API Landscape (Late 2026)

1. **Active Graph API Versions:** Meta maintains quarterly/tri-annual Graph API versions with ~2-year support windows (versions **`v22.0`** through **`v26.0` / `v27.0`** active in 2025–2026). Pin a single verified current version (e.g., `v25.0` or `v26.0`) via server configuration on activation day.
2. **Legacy API Permanently Shut Down:** The legacy **Instagram Basic Display API** was permanently deprecated on **December 4, 2024**. **Personal Instagram accounts are NOT supported via any official Meta API.**
3. **Supported Account Types Only:** Strictly **Instagram Professional Accounts (Business and Creator)** — and **no unrestricted anonymous lookup of arbitrary personal or private accounts exists**.
4. **Metric Migration Note:** Legacy media `impressions` and select clip-play metrics were replaced by unified `views` metrics in recent Graph API versions — normalize missing/deprecated fields as `null` (`Unavailable`), never `0`.
5. **Authentication Paths:**
   - **Instagram API with Instagram Login (Business Login for Instagram):** Allows Instagram Professional (Creator/Business) accounts to authorize directly without mandatory Facebook Page linkage.
   - **Instagram Graph API via Facebook Login:** Required when using Page-linked Business Discovery (`GET /{ig-user-id}?fields=business_discovery.username(...)`) and Facebook Business asset permissions.

---

## 2. Exact Meta Developer Application Requirements

| Requirement | Configuration Detail |
| :--- | :--- |
| **Developer & Business Verification** | Verified Meta Business Portfolio (`business.facebook.com`) matching Viewora's legal entity; Tech Provider / App Review verification completed |
| **Required Scopes (Submit in App Review with Screencast)** | `instagram_business_basic` (or `instagram_basic` + `pages_show_list` for Facebook Login), `instagram_manage_insights` / `instagram_business_manage_insights` (only request read-only analytics scopes; do **not** request messaging or publishing scopes unless needed) |
| **Valid OAuth Redirect URI** | `https://staging.<owner-domain>/api/meta/oauth/callback` (Staging) · `https://<owner-domain>/api/meta/oauth/callback` (Production) |
| **Webhook Callback URL & Verify Token** | `https://<domain>/api/webhooks/meta` with `META_WEBHOOK_VERIFY_TOKEN` and HMAC-SHA256 `X-Hub-Signature-256` validated using `META_APP_SECRET` |
| **Mandatory Data Deletion Callback / Instructions URL** | Configure **Settings → Basic → Data Deletion Instructions URL** (`https://<domain>/en/privacy#data-deletion`) AND implement/register signed `POST` Data Deletion Callback returning `{ "url": "https://<domain>/deletion-status?id=<code>", "confirmation_code": "<code>" }` after verifying `signed_request` with `META_APP_SECRET` |
| **Token Lifecycle** | Short-lived token (1 hour) → exchange for **60-day long-lived token** (`grant_type=ig_exchange_token`) → proactively refresh around **Day 50** (`GET /refresh_access_token`); expired tokens require user re-authorization |
| **Data Retention & Platform Restrictions** | Respect Meta's **24-hour cache limit** on Business Discovery public lookups; honor immediate deletion on user disconnect/revocation; **never** scrape, store passwords, or access private accounts |

---

## 3. Post-Approval Controlled Staging Verification Protocol

Using **authorized test Instagram Business & Creator accounts** owned by Viewora/Scorpio:
1. Connect authorized test account via `/api/meta/oauth/start` → verify encrypted ciphertext (zero plaintext token) in `provider_connections`.
2. Verify **supported profile retrieval**, **authorized account insights**, and **Business Discovery** lookup of another public Business/Creator account — confirm personal/private test handles cleanly return `unsupported_or_private` with zero fabricated data.
3. Verify explicit provenance badges (`sourceProvider`, `fetchedAt`), **snapshot recording** (`profile_snapshots` under Migration 6 RLS), **historical trend deltas**, **compatibility-checked Competitor Studio**, and **binary `%PDF-1.4` / CSV report export**.
4. Verify **1-click Account Disconnection**, **Meta-side Authorization Revocation**, and **Data Deletion Callback** purge encrypted tokens immediately and record immutable `audit_logs`.
5. Record signed `mode: 'live_provider_verified'` JSON output in [LIVE_PROVIDER_ACCEPTANCE_REPORT.md](file:///c:/Users/Scorpio/Videos/Instagram/LIVE_PROVIDER_ACCEPTANCE_REPORT.md).
