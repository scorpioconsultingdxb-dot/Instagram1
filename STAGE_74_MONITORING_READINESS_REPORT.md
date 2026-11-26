# VIEWORA — Stage 74: Production Monitoring & Observability Readiness Report

**Date:** 2026-11-26  
**Live Canonical Endpoint:** https://instagram1-beta.vercel.app  
**Paid Monitoring Providers:** **Disabled** (zero paid accounts or SaaS subscriptions provisioned without owner approval).

---

## 1. Public Health Endpoint Security Review & Completed Hardening

### Finding Before Stage 74
An unauthenticated `GET /api/health` previously returned internal infrastructure details publicly:
- Database role name & privilege flags (`connectedRole.role: "viewora_app"`, `rolsuper`, `rolcreatedb`, `rolcreaterole`, `rolbypassrls`)
- Internal environment variable resolution metadata (`security.source: "VIEWORA_DATABASE_URL"`, `adminUrlAbsentFromRuntime`)
- AI daily spend & budget caps (`dailySpentUsd`, `dailyBudgetUsd`)
- Internal background job queue counts (`total`, `queued`, `deadLetter`) and internal provider IDs.

### Completed Stage 74 Hardening (Verified Locally — Ready for Next Authorized Deployment)
Refactored [src/app/api/health/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/health/route.ts) into a strict **two-tier observability contract**:

1. **Public Unauthenticated `GET /api/health` (Minimal Non-Sensitive Status):**
   - Returns **only**: `ok`, `status` (`"healthy" | "degraded"`), `correlationId`, `checkedAt`, `responseTimeMs`, `uptimeMeasured`, `services.database` (`{ status, reachable, latencyMs }`), and coarse boolean feature flags (`registration.publicOpen`, `demoMode.enabled`, `payments.enabled`, `backgroundJobs.enabled`, `emailDelivery.enabled`).
   - Returns **HTTP `503`** when PostgreSQL is configured but unreachable (enabling external uptime monitors to alert immediately on HTTP status alone).
   - Sets `Cache-Control: no-store, max-age=0`, `x-request-id`, and `x-response-time-ms`.
   - **Strictly omits** `connectedRole`, `security`, `aiEngine`, `providers`, `observability`, and all environment/role names.
2. **Authorized Full Diagnostics (`GET /api/health?detail=full`):**
   - Strictly gated behind **either** an authenticated `super_admin` session **or** a timing-safe `HEALTH_DIAGNOSTICS_TOKEN` (`>= 24` chars, via `x-health-diagnostics-token` or `Authorization: Bearer ...`).
   - Invalid or missing tokens safely fall back to the minimal public payload.
   - Returns full database role/security diagnostics, provider readiness, queue summary, AI cost caps, and live internal observability metrics (`observability`).

---

## 2. Independently Executable Internal Monitoring Improvements Implemented

Implemented with **zero new external npm dependencies** (preserving `0` vulnerabilities):

| Module | File | Capabilities Added |
|---|---|---|
| **Internal Telemetry & Structured Logger** | [src/lib/observability/metrics.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/observability/metrics.ts) | Process-scoped ring buffer (last 200 latency samples + 100 events), DB & API `avg` / `p95` latency calculation, counters for `healthChecksTotal`, `healthChecksDegraded`, `authSuccessTotal`, `authFailureTotal`, `authRateLimitedTotal`, `csrfBlockedTotal`, `registrationClosedBlocksTotal`, `appErrorsTotal`, `securityEventsTotal`; automatic secret redaction (`postgres(ql)://...`, `Bearer ...`, `token/secret/password=...`); single-line JSON log emitter (`emitStructuredLog`) ready for Vercel Log Drains. |
| **Health Route Telemetry** | [src/app/api/health/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/health/route.ts) | Measures per-request `responseTimeMs` and DB latency; emits structured `error` logs when DB is unreachable; feeds internal metrics counters. |
| **Authentication Security Telemetry** | [src/app/api/auth/login/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/auth/login/route.ts) | Records CSRF rejections (`403`), IP & account rate-limit hits (`429`), credential failures (`401`), login successes (`200`), and DB errors (`503`) without logging emails, passwords, or session tokens. |
| **Super Admin Observability Surface** | [src/app/api/admin/overview/route.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/app/api/admin/overview/route.ts) | Surfaces `observability.metrics` and `observability.recentEvents` (last 25 sanitized events) inside the authenticated Super Admin Console overview API. |
| **Automated Unit Test Suite** | [src/lib/observability/phase8-stage74.test.ts](file:///c:/Users/Scorpio/Videos/Instagram/src/lib/observability/phase8-stage74.test.ts) | 4 tests asserting public `/api/health` redaction, forged-token rejection, authorized `HEALTH_DIAGNOSTICS_TOKEN` diagnostics, latency p95 + counter accuracy, and URI/Bearer/secret redaction. |

---

## 3. Production Monitoring Architecture (All 11 Required Pillars)

| Pillar | Signal / Metric | Collection Layer | Alert Threshold (Recommended) |
|---|---|---|---|
| **1. Website Availability** | HTTP `200` on `/en`, `/pt-BR`, `/es`, `/de`, `/fr`, `/en/tools` | External synthetic monitor (1–3 min interval, multi-region) | 2 consecutive failures (`> 2 min` outage) → Page Owner |
| **2. API Health** | `GET /api/health` HTTP `200` & JSON `ok === true` | External monitor + Vercel Logs | Any HTTP `503` or `ok !== true` → Immediate Alert |
| **3. Database Availability** | `services.database.reachable === true` + Neon Monitoring | `/api/health` + Neon Console Metrics | `reachable === false` or Neon compute error → Immediate Alert |
| **4. Authentication Failures** | `authFailureTotal`, `authRateLimitedTotal`, `401`/`429` spikes | `src/lib/observability/metrics.ts` + structured JSON logs | `> 20` failed logins / 5 min or `> 5` rate-limit lockouts → Security Warn |
| **5. Application Errors** | Unhandled `5xx` responses, `appErrorsTotal`, React error boundaries | Vercel Runtime Logs + optional Sentry (`SENTRY_DSN`, disabled today) | `5xx` rate `> 1%` over 5 min or any unhandled auth/DB exception |
| **6. Response Latency** | `x-response-time-ms`, DB `latencyMs`, `dbP95Ms`, `apiP95Ms` | `/api/health` headers + Vercel Speed Insights / external monitor | Public route p95 `> 1,500 ms` or DB p95 `> 500 ms` sustained 10 min |
| **7. DB Connection Saturation** | Active pooled connections vs. Neon `max_connections` (`112`) | Neon Console Connection Metrics (PgBouncer pooler active) | Active connections `> 75%` (`> 84`) or pool wait timeout → Scale/Investigate |
| **8. Security Events** | `csrfBlockedTotal`, `securityEventsTotal`, immutable `audit_logs` | `metrics.ts` + PostgreSQL `public.audit_logs` (`trg_audit_logs_immutable`) | Any unexpected `super_admin` role mutation or sustained CSRF/401 bursts |
| **9. Background-Job Readiness** | `backgroundJobs.enabled`, `deadLetter`, `lastHeartbeatAt` | Authenticated `/api/health?detail=full` + `/api/admin/overview` | Once enabled: `deadLetter > 0` or stale heartbeat `> 15 min` |
| **10. Provider Readiness** | `providers[].status` (Meta, Authorized Insights, Gemini, Resend) + daily AI spend | Authenticated `/api/health?detail=full` + `/api/admin/overview` | Once enabled: provider `degraded`/`down` or AI spend `>= 80%` of daily cap (`\$10`) |
| **11. Infrastructure Costs** | Monthly compute/DB/bandwidth/API burn vs. hard budgets | Vercel Usage + Neon Billing + `AI_DAILY_BUDGET_USD` / `API_MONTHLY_COST_CAP_USD` | Hard budget alerts at `50%`, `80%`, `100%` of monthly budget |

---

## 4. Uptime Monitoring, Error Tracking & Estimated Infrastructure Costs

All external monitoring and error-tracking SaaS tools remain **disabled** until owner authorization. Recommended free-first activation options:

| Capability | Recommended Option | Free Tier | Paid Tier (When Scaling) | Current State |
|---|---|---|---|---|
| **Synthetic Uptime Monitoring** | Better Stack Uptime *or* UptimeRobot | `\$0 / mo` (10–50 monitors, 3–5 min checks, email alerts) | `\$25–\$29 / mo` (30s checks, status page, SMS/Slack) | **Disabled — owner setup** |
| **Error Tracking & Stack Traces** | Sentry (`SENTRY_DSN` already supported in `src/lib/env.ts`) | `\$0 / mo` (Developer: 5k errors/mo) | `\$26 / mo` (Team: 50k errors/mo) | **Disabled (`SENTRY_DSN=""`)** |
| **Product Analytics (Optional)** | PostHog (`NEXT_PUBLIC_POSTHOG_KEY` supported in `env.ts`) | `\$0 / mo` (1M events/mo) | Usage-based beyond free tier | **Disabled** |
| **Platform Hosting** | Vercel | `\$0 / mo` (Hobby) | `\$20 / seat / mo` (Pro — required for commercial use & Log Drains) | Active on Vercel |
| **Hosted Database** | Neon PostgreSQL 18 | `\$0 / mo` (Free: 6h history) | `~\$19 / mo` (Launch: 7d) / `~\$69 / mo` (Scale: 30d) | Active (Free tier) |
| **Durable Rate-Limit / Jobs (Future)** | Upstash Redis | `\$0 / mo` (500k commands/mo) | Pay-as-you-go (`\$0.20 / 100k cmds`) | **Disabled** |

**Estimated Pre-Beta Total Monthly Infrastructure Cost:** `\$0 / mo` (Free tiers across Vercel, Neon, Better Stack/UptimeRobot, Sentry Developer, Resend Free) or `~\$39 / mo` if upgrading to Vercel Pro (`\$20`) + Neon Launch (`\$19`) for commercial Terms & 7-day PITR.

### Exact Owner Actions
1. Authorize one controlled Vercel Production deployment so the hardened two-tier `/api/health` endpoint and internal observability telemetry go live.
2. *(Optional)* Add a random 48-char `HEALTH_DIAGNOSTICS_TOKEN` secret in Vercel Production if an external private monitoring script needs `/api/health?detail=full`.
3. Configure a free uptime monitor (Better Stack or UptimeRobot) targeting `https://instagram1-beta.vercel.app/api/health` (expect HTTP `200` and JSON `"ok":true`) and `/en` (expect HTTP `200`).
4. When ready for beta, provision Sentry (`SENTRY_DSN`) with PII scrubbing enabled and review Vercel Pro Log Drains.
