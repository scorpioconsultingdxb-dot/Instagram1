# Viewora — Final Hosted Staging & Production Deployment Plan (Tasks 1–3)

**Date:** 2026-11-26  
**Provisioning Status:** **AWAITING OWNER APPROVAL — ZERO PAID INFRASTRUCTURE PURCHASED OR PROVISIONED**  
**Local Baseline Preserved:** Local PostgreSQL `14.25` (`viewora` / `viewora_test`) untouched; permanent Super Admin `Scorpio Marketing Agency` (`marketing@scorpio.consulting`) untouched.

---

## 1. Selected Infrastructure Architectures (Primary + Alternative)

| Component | **Primary Recommendation: DigitalOcean (Frankfurt EU — `FRA1`)** | **Alternative Recommendation: Render (Frankfurt EU)** |
| :--- | :--- | :--- |
| **Application Hosting** | DigitalOcean App Platform (`Dockerfile` container, `apps-s-1vcpu-1gb` Staging → 2× `apps-s-2vcpu-4gb` Prod) | Render Docker Web Service (`Starter` Staging → 2× `Standard`/`Pro` Prod; Pro Workspace **\$25/mo** `[Verified List]`) |
| **Managed PostgreSQL** | **Managed PostgreSQL 17** (community support through Nov 8, 2029; PG 16 EOL Nov 9, 2028 fallback) — Staging: **1 GiB RAM / 1 vCPU / 10 GiB SSD (\$15.15/mo `[Verified List]`)**; Prod HA: **2–4 GiB RAM + Standby Node (\$60.90–\$121.80/mo `[Verified List]`)** | **Managed PostgreSQL 17** — Staging: Basic/Starter **~\$6–\$19/mo `[Verified List]`**; Prod: Pro 4–8 GiB **\$55–\$100+/mo `[Verified List]`** + ~\$0.25–\$0.30/GB storage |
| **Hosting Region** | **Frankfurt (`FRA1`, EU)** — GDPR-aligned EU residency with low latency to UAE & Europe *(upgrade path: AWS `me-central-1` UAE at enterprise scale)* | **Frankfurt (`frankfurt`, EU)** — GDPR-aligned EU residency |
| **Private DB Connectivity** | Built-in **VPC Private Networking** + **Trusted Sources firewall** (zero public PostgreSQL port exposure) | Built-in **Internal Private Network (`*.internal`)** with empty public `ipAllowList: []` |
| **Connection Pooling (RLS-Safe)** | Built-in **Managed PgBouncer** (Transaction mode with `?pgbouncer=true` on `viewora_app`; direct non-pooled admin connection for `prisma migrate deploy`) | Managed connection pooler / direct internal connection (verify `SET LOCAL` transaction compatibility on staging) |
| **HTTPS & Secure Cookies** | Managed Let's Encrypt TLS 1.3 + HSTS + `HttpOnly`/`Secure`/`SameSite=Lax` session cookies + `X-Robots-Tag: noindex` on Staging | Managed TLS 1.3 + HSTS + `HttpOnly`/`Secure`/`SameSite=Lax` cookies + `X-Robots-Tag: noindex` on Staging |
| **Backup Retention & WORM** | Automated daily snapshots + 7-day PITR + **DigitalOcean Spaces (FRA1)** with Object Lock (WORM) for encrypted daily `pg_dump -Fc` & off-host `audit_logs` (**\$5/mo base `[Verified List]`**) | Daily backups + PITR on paid tiers + external S3/GCS WORM bucket for independent encrypted dumps & `audit_logs` |
| **Secret Management** | Encrypted App Platform Secrets (never in Git, distinct keys per environment) | Encrypted Render Environment Groups (distinct per environment) |
| **Monitoring & Scheduler** | Built-in container metrics + `/api/health` synthetic probe + DO Scheduled Job / external cron (`POST /api/jobs/run`, disabled until Stage 67) | Built-in metrics + `/api/health` probe + native Render Cron Job (disabled until Stage 67) |
| **Declarative Blueprint** | [`deploy/staging/digitalocean-app.yaml`](file:///c:/Users/Scorpio/Videos/Instagram/deploy/staging/digitalocean-app.yaml) | [`deploy/staging/render.yaml`](file:///c:/Users/Scorpio/Videos/Instagram/deploy/staging/render.yaml) |
| **Estimated Staging Total / Mo** | **~\$32 – \$45 / mo `[Estimate]`** (1 App container + 1–2 GiB PG 17 + \$5 Spaces) | **~\$30 – \$55 / mo `[Estimate]`** (Starter container + Basic PG + optional Pro workspace) |
| **Estimated Early Prod HA / Mo** | **~\$130 – \$210 / mo `[Estimate]`** (2 App containers + HA PG 17 + Spaces + Resend Pro + Upstash) | **~\$140 – \$230 / mo `[Estimate]`** (Pro workspace + 2 containers + Pro PG + Resend Pro + Upstash) |

---

## 2. Verified Secure Deployment Package (Task 2 Artifacts Ready in Repo)

1. **[`Dockerfile`](file:///c:/Users/Scorpio/Videos/Instagram/Dockerfile):** Multi-stage Node `22-bookworm-slim` container running as non-root user `nextjs` (UID 1001), generating Prisma Client during build, executing pre-boot security checks, and exposing a built-in Docker `HEALTHCHECK` against `http://127.0.0.1:3000/api/health`.
2. **[`.dockerignore`](file:///c:/Users/Scorpio/Videos/Instagram/.dockerignore):** Guarantees `.env*`, `backups/`, `ci-screenshots/`, `executive_visual_evidence/`, and `*.zip` are never copied into container layers.
3. **[`.env.production.example`](file:///c:/Users/Scorpio/Videos/Instagram/.env.production.example):** Zero-secret Staging & Production template aligned 1:1 with `src/lib/env.ts` (all paid external flags, `DEMO_MODE_ENABLED`, `PAYMENTS_ENABLED`, `NEXT_PUBLIC_PAYMENTS_ENABLED`, and `BETA_PUBLIC_REGISTRATION_ENABLED` default `false`; Gemini pilot caps `$2/day` and `$15/mo`).
4. **[`deploy/scripts/startup-check.mjs`](file:///c:/Users/Scorpio/Videos/Instagram/deploy/scripts/startup-check.mjs):** Verified pre-boot guard that aborts startup (`exit 1`) if `DATABASE_URL` or `AUTH_SECRET` is missing/placeholder, if `DEMO_MODE_ENABLED=true`, if `DATABASE_ADMIN_URL` or `TEST_DATABASE_URL` is leaked into a web container, or if any Supabase variable exists.
5. **[`deploy/scripts/pg17-verify-and-backup.sh`](file:///c:/Users/Scorpio/Videos/Instagram/deploy/scripts/pg17-verify-and-backup.sh):** Executable Linux staging script that applies all 6 migrations on PostgreSQL 17, runs `prisma/seed.ts` twice, verifies exact schema counts (58 tables, 6 migrations, 74 FKs, 147 indexes, 24 RLS policies, `trg_audit_logs_immutable`, `viewora_app` `NOBYPASSRLS`), creates an AES-256 PBKDF2 encrypted `pg_dump -Fc`, restores into a disposable DB, verifies restored parity, and prints exact measured backup & restore durations.

---

## 3. Rollback & Environment Isolation Rules

- **Strict Isolation:** Staging and Production use separate PostgreSQL clusters, separate `AUTH_SECRET` roots (which also derive AES-256-GCM OAuth encryption keys via HKDF-SHA256 in `token-crypto.ts`), separate domains, and zero shared customer rows.
- **Zero-Downtime Rollback:** All Viewora Prisma migrations are additive and N-1 compatible. To roll back a bad release, redeploy the previous immutable container digest (< 2 minutes). To stop an external API incident without redeploying, click **Halt All External APIs** in Admin Integration Center 2.0.
