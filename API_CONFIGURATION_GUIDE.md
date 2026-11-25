# Viewora — External API Configuration Guide (Phase 5 Activation Runbook)

**Date:** 2026-11-26  
**Security Rule:** Configure all secrets exclusively in server-side `.env.local` (development) or your host's encrypted secret manager (staging/production). **Never commit secrets to Git and never prefix provider secrets with `NEXT_PUBLIC_`.**

## 1. Two-Key Activation Safety Model

Every external integration in Viewora requires **BOTH**:
1. Its explicit server-side feature flag set to `'true'` (`PROVIDER_*_ENABLED=true`), **AND**
2. All required non-placeholder credentials populated in the environment.

If either is missing — or if a secret starts with `your_`, `replace_me`, `placeholder`, `changeme`, or `example` — the provider stays **disabled** with zero outbound calls.

## 2. Environment Variables Reference

### Global Resilience, Caching & Cost Caps
```bash
PROVIDER_TIMEOUT_MS=8000            # AbortController timeout per upstream attempt (1000-30000ms)
PROVIDER_MAX_RETRIES=2              # Bounded retries on network/timeout/408/429/5xx (0-3)
PROVIDER_CACHE_TTL_SECONDS=900      # Default server-side cache expiration (seconds)
PROVIDER_RATE_LIMIT_PER_MIN=30      # Default sliding-window limit per provider
API_DAILY_COST_CAP_USD=15           # Hard daily external API spend cap
API_MONTHLY_COST_CAP_USD=200        # Hard monthly external API spend cap
```

### A. Official Meta Instagram Graph API (Business Discovery)
```bash
PROVIDER_META_ENABLED=false                         # Set to true only after Meta App Review approval
META_API_VERSION=v22.0
META_INSTAGRAM_BUSINESS_ACCOUNT_ID=                 # Numeric IG Business Account ID
META_GRAPH_API_ACCESS_TOKEN=                        # Server-side long-lived system user token
```

### B. Authorized Connected-Account Insights (Meta OAuth)
```bash
PROVIDER_AUTHORIZED_INSIGHTS_ENABLED=false          # Set to true only after OAuth scopes approved
META_APP_ID=
META_APP_SECRET=
META_OAUTH_REDIRECT_URI=https://your-domain.com/api/meta/oauth/callback
META_WEBHOOK_VERIFY_TOKEN=
```

### C. Licensed Commercial Third-Party Social Data Partner
```bash
PROVIDER_LICENSED_THIRD_PARTY_ENABLED=false         # Set to true only after signed commercial license
LICENSED_PROVIDER_NAME=                             # Display attribution label
LICENSED_PROVIDER_API_URL=                          # Base HTTPS endpoint
LICENSED_DATA_PROVIDER_API_KEY=                     # Server-side Bearer API key
```

### D. Permitted Public Benchmark Dataset
```bash
PROVIDER_PUBLIC_DATASET_ENABLED=false
PUBLIC_DATASET_ENDPOINT_URL=
```

### E. Google Gemini AI Analytical Summaries
```bash
PROVIDER_GEMINI_ENABLED=false                       # Set to true only when owner approves Gemini billing
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
AI_DAILY_BUDGET_USD=10
AI_MONTHLY_BUDGET_USD=150
```

### F. Resend Transactional Email & Scheduled Jobs
```bash
PROVIDER_RESEND_ENABLED=false                       # Set to true only after domain SPF/DKIM/DMARC verified
EMAIL_NOTIFICATIONS_ENABLED=false
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_REPLY_TO=support@yourdomain.com
BACKGROUND_JOBS_ENABLED=false
CRON_SECRET=                                        # 48+ random bytes for external cron POST /api/jobs/run
```

### G. Payments (Locked Disabled)
```bash
PAYMENTS_ENABLED=false
NEXT_PUBLIC_PAYMENTS_ENABLED=false
```

## 3. Activation Verification Steps (When Approved in Phase 5)

1. Populate variables in staging secret manager and run `npm run env:check`.
2. Sign in as Super Admin (`marketing@scorpio.consulting`), open `/en/admin` → **Integration Center** tab.
3. Confirm the target provider transitions from `DISABLED BY FLAG` → `ENABLED READY`, while all unapproved providers remain `DISABLED BY FLAG`.
4. Confirm raw secrets never appear in `/api/admin/integrations`, `/api/health`, or browser network responses.
5. Run a single non-destructive lookup and verify provenance metadata (`LIVE` vs `CACHED`), cache hit on repeat lookup, and redacted log entry in Integration Center.
