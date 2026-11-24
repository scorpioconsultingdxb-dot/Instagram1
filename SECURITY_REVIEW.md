# Viewora — Security & Privacy Review

## Implemented Controls

1. **Authentication & Demo Isolation**:
   - Production authentication uses Supabase Auth (`@supabase/ssr`) with HttpOnly cookies.
   - `DEMO_MODE_ENABLED` defaults to `false`. When disabled, all local demo sign-in and demo session lookups are rejected server-side (`HTTP 503` / `null` session).
   - Local evaluation cookies (when explicitly enabled for local dev) are HMAC-SHA256 signed and verified with `crypto.timingSafeEqual`.
   - `/auth/callback` enforces `sanitizeRedirectPath()` to block open redirects (`//evil.com`, external origins, backslashes).
2. **Authorization & Multi-Tenant Isolation**:
   - Server-side RBAC guards protect every `/[locale]/admin/*` page and `/api/admin/*` route (`401` unauthenticated, `403` non-admin).
   - PostgreSQL Row-Level Security (RLS) policies isolate workspace data (`is_workspace_member(workspace_id)`).
   - Private user research notes (`profile_research_notes`) intentionally exclude admin read access in RLS.
   - Centralized entitlement assertions (`assertEntitlement`) run server-side before report exports and AI report generation.
3. **HTTP Security & Validation**:
   - `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and restrictive `Permissions-Policy` configured in `next.config.ts`.
   - Zod schema validation enforced on all mutating API endpoints.
   - Contact form includes honeypot anti-spam filtering.
4. **Webhook, AI & Payment Safety**:
   - Meta webhooks verify `X-Hub-Signature-256` with `timingSafeEqual` and enforce replay protection via `claimWebhookEventId`.
   - Gemini AI prompts isolate external bio/caption text inside `<UNTRUSTED_PROFILE_DATA>` JSON blocks with explicit anti-injection instructions and strict Zod output parsing.
   - `PAYMENTS_ENABLED=false` enforced server-side; Stripe checkout & webhook endpoints return `503` and `payments_enabled` feature flag is locked.
5. **Privacy & Data Protection Considerations (GDPR, LGPD, UAE PDPL)**:
   - Self-service Personal Data Export (`GET /api/auth/export-data`) and confirmed Account Deletion (`POST /api/auth/delete-account`) implemented.
   - Consent banner gates optional analytics; searched usernames and private notes are never transmitted to analytics services.
   - **Legal Disclaimer**: `/privacy`, `/terms`, and `/cookies` are structured drafts and MUST be reviewed by qualified legal counsel before public commercial launch.
