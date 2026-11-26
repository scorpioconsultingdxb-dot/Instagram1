# Viewora — Production Infrastructure & Deployment Architecture Plan (Stage 51)

**Date:** 2026-11-26  
**Scope:** Target hosted staging and production topology for Viewora (Next.js `15.5.29` App Router + Independent PostgreSQL + Optional Upstash Redis + External Cron + Off-Host Encrypted Backups + WORM Audit Archival).  
**Important Notice:** Zero external cloud resources, domains, DNS entries, or paid services have been purchased or provisioned. Local development continues cleanly on PostgreSQL `14.25` without automated local upgrade.

---

## 1. Recommended Target Production Topology

```text
Internet (HTTPS / TLS 1.3 + HSTS + WAF / DDoS Edge)
         │
         ▼
[Edge CDN & Reverse Proxy (Cloudflare / Managed Platform Edge)]
  ├── Static assets & 322 pre-rendered locale pages (zero-DB dependent)
  ├── Edge rate limiting & Bot/Abuse filtering
  └── HTTPS forwarding → Next.js 15.5.29 Node 22/24 LTS Compute (2+ stateless replicas in Prod)
         │
         ├──► [Managed PostgreSQL 16 LTS or 17 LTS (Primary + Synchronous Standby / PITR)]
         │      ├── Restricted Runtime Role: viewora_app (NOBYPASSRLS, least-privilege CRUD, 24 RLS policies)
         │      ├── Migration Admin Role: viewora_migrator / postgres (CI/runbook only, never in app runtime)
         │      ├── Connection Pooler: PgBouncer (transaction/session-safe mode compatible with SET LOCAL RLS)
         │      └── Automated Encrypted Daily pg_dump + Continuous WAL Archiving (off-host object storage)
         │
         ├──► [Optional Upstash Redis (TLS)] — Distributed cache & rate-limit coordination for 2+ pods
         ├──► [External Managed Cron] — Authenticated POST /api/jobs/run (Bearer CRON_SECRET)
         ├──► [External WORM / SIEM Sink] — Immutable off-host copy of append-only public.audit_logs
         └──► [Gated External Providers (ALL OFF UNTIL STAGE 52 OWNER SIGN-OFF)]
                ├── Meta Official Graph API / OAuth (SSRF allowlisted, HTTPS 443)
                ├── Licensed Commercial Social Data Partner (contract-gated)
                ├── Google Gemini API (micro-USD budget-capped)
                └── Resend Transactional Email (SPF/DKIM/DMARC + Svix webhook verification)
```

---

## 2. PostgreSQL Production Version Lifecycle Evaluation (PG 14 vs. 16 vs. 17 vs. 18)

| PostgreSQL Major | Community Support EOL | Assessment for Viewora Production | Recommendation |
| :--- | :--- | :--- | :--- |
| **PostgreSQL 14** *(current local dev: `14.25`)* | **November 2026** | Reached end-of-life window; acceptable to keep undisturbed on the local workstation for baseline continuity, **not recommended** for a new hosted production deployment. | Keep locally undisturbed; **do not** provision PG 14 in production |
| **PostgreSQL 16** | **November 2028** | Mature, universally supported across AWS RDS, GCP Cloud SQL, Neon, DigitalOcean, Railway, Render, and Prisma `6.19.x`; battle-tested RLS & `FOR UPDATE SKIP LOCKED` behavior. | **Recommended (Primary Safe Default)** |
| **PostgreSQL 17** | **November 2029** | Current long-term production standard with improved vacuum memory management, streaming I/O, and JSON/index performance; fully supported by Prisma `6.19.x` and major managed clouds. | **Recommended (Preferred for New Managed Provisioning)** |
| **PostgreSQL 18** | **November 2030** | Newer release with asynchronous I/O improvements; managed cloud provider rollout, extension parity, and Prisma edge-case soak time should be confirmed on staging before committing production workloads. | **Evaluate on staging first**; adopt only once target managed cloud + Prisma parity is confirmed |

**Actionable Decision:** Provision **Managed PostgreSQL 17 LTS** (or **PostgreSQL 16 LTS** if required by the chosen managed cloud region) for **both HTTPS Staging and Production** so staging matches production engine behavior 1:1.

---

## 3. Connection Pooling & Row-Level Security (RLS) Compatibility Rule

Viewora enforces **24 PostgreSQL Row-Level Security policies** using transaction-scoped session variables (`SET LOCAL app.current_user_id = ...`) inside `withUserContext()` / `withDbContext()` transactions:
- If PgBouncer is enabled in **transaction pooling mode**, every RLS query **MUST** remain inside an explicit transaction using `SET LOCAL` (already implemented across Viewora repositories) and Prisma must be configured with `?pgbouncer=true` on runtime `DATABASE_URL`, while `DATABASE_ADMIN_URL` connects **directly** (bypassing PgBouncer) for `prisma migrate deploy`.
- Never grant `SUPERUSER`, `BYPASSRLS`, `CREATEDB`, or `CREATE ON SCHEMA public` to the runtime `viewora_app` role.

---

## 4. Hosted Compute, TLS, Observability & Security Baseline

| Layer | Staging Requirement | Production Requirement |
| :--- | :--- | :--- |
| **Compute** | 1 Linux container (Node 22/24 LTS, 1 vCPU, 1–2 GB RAM), read-only root FS compatible | ≥2 stateless Linux replicas across AZs (2 vCPU, 2–4 GB RAM each), zero-downtime rolling/blue-green deploy |
| **HTTPS / TLS** | Managed TLS 1.3 certificate on `staging.<domain>` (`noindex` header/robots enforced) | Managed TLS 1.3 + HSTS preload-ready + strict CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |
| **Secrets** | Hosted secret manager (zero `.env` in Git, unique staging `AUTH_SECRET` & `OAUTH_TOKEN_ENCRYPTION_KEY`) | Dedicated HSM/KMS-backed secret vault, 90-day rotation policy, zero secret sharing with staging |
| **Health Checks** | `GET /api/health` readiness/liveness probe + DB latency check | Synthetic external uptime checks every 60s + error-rate & DB-connection alerts |
| **Audit Archival** | PostgreSQL `audit_logs` (Migration 5 immutable trigger) | PostgreSQL `audit_logs` + continuous streaming export to off-host WORM object storage / SIEM |
| **Estimated Monthly Base Cost** *(Planning Estimate Only)* | ~\$30–\$65/mo (1 app container + small managed PG 17) | ~\$150–\$450/mo fixed baseline depending on replica count, HA standby, Redis, and log retention (see [COMMERCIAL_FINANCIAL_MODEL.md](file:///c:/Users/Scorpio/Videos/Instagram/COMMERCIAL_FINANCIAL_MODEL.md)) |
