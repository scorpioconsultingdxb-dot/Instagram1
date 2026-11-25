# Viewora — Production Database & Hosting Architecture Guide

**Date:** 2026-11-25  
**Target:** Independent, zero-Supabase PostgreSQL 16 production deployment for Viewora on serverless or containerized hosting (Vercel, Google Cloud Run, Render, Railway, AWS ECS/App Runner, Fly.io).

---

## 1. Recommended Managed PostgreSQL 16 Hosting Options

| Provider | Best Fit For | Built-In Pooling | TLS & Automated Backups | Notes |
| --- | --- | --- | --- | --- |
| **Google Cloud SQL (PostgreSQL 16)** | Cloud Run / GKE / enterprise compliance | Cloud SQL Auth Proxy + PgBouncer | Managed TLS + daily backups + PITR | Strong IAM & private VPC peering |
| **AWS RDS / Aurora PostgreSQL 16** | AWS ECS / App Runner / high scale | RDS Proxy | Enforced TLS (`rds.force_ssl=1`) + PITR | Enterprise multi-AZ failover |
| **Neon (Serverless PostgreSQL 16)** | Vercel / serverless Next.js | Native PgBouncer (`-pooler` endpoint) | Mandatory `sslmode=require` + instant branching | Separate direct URL for Prisma migrations |
| **Render / DigitalOcean Managed PG 16** | Simple full-stack deployment | Managed PgBouncer | Mandatory TLS + daily snapshots + PITR | Low operational overhead |

> **Strict Rule:** Do **not** use Supabase Database, Auth, or Storage. Do **not** fall back to local JSON files in production.

---

## 2. Serverless & Read-Only Filesystem Compatibility

Viewora's runtime recovery and database activation hardening guarantee full compatibility with immutable/read-only container filesystems (e.g. Vercel `/var/task`, Cloud Run read-only rootfs):

1. **Zero Disk Writes on Public Traffic:** Homepage, 12 Free Tools, Pricing, and all 11 localized informational pages never invoke `fs.mkdirSync` or write to `.viewora-data`.
2. **All Core & Extended Customer Data in PostgreSQL:** Users, sessions, onboarding, Personal Digital HQ 2.0, dashboard widget preferences, workspaces, folders, saved profiles, private notes, comparisons, Research Pro projects, Report Builder documents, Agency workspaces, Automation rules, support tickets, notifications, entitlements, CMS, feature flags, and audit logs persist in PostgreSQL.
3. **Two Remaining Local-Disk Features to Upgrade Before Multi-Instance Scaling:**
   - **Customer Uploaded Media (`/api/auth/media`):** Currently uses `LocalFileStorage` (`VIEWORA_STORAGE_DIR`). Before horizontal autoscaling or serverless hosting, plug an S3 / GCS / Cloudflare R2 implementation into the existing `FileStorageDriver` interface (`src/lib/storage/local-files.ts`) with private bucket ACLs and signed/proxied owner-scoped serving.
   - **Referrals Store (`src/lib/referrals/service.ts`):** Currently fails closed (`503`) on read-only disks; promote its reads/writes to the existing PostgreSQL `referral_codes`, `referral_attributions`, and `affiliate_accounts` tables before activating public partner programs.

---

## 3. Connection Pooling & PgBouncer Configuration

Viewora's `withUserRlsContext()` uses **transaction-local** `set_config(..., true)`, which is **100% safe with PgBouncer transaction pooling**:

- **Runtime (`DATABASE_URL`):** Point to the pooled endpoint (`pgbouncer` / RDS Proxy / Neon `-pooler`) using the restricted `viewora_app` role:
  ```env
  DATABASE_URL=postgresql://viewora_app:<STRONG_APP_PW>@<POOLER_HOST>:6432/viewora?schema=public&sslmode=require&pgbouncer=true&connection_limit=10
  ```
- **Migrations & Admin Tasks (`DATABASE_ADMIN_URL`):** Point to the **direct** (non-pooled) PostgreSQL 16 host using `viewora_admin`:
  ```env
  DATABASE_ADMIN_URL=postgresql://viewora_admin:<STRONG_ADMIN_PW>@<DIRECT_HOST>:5432/viewora?schema=public&sslmode=require
  ```
- **SSL / TLS:** Always require `?sslmode=require` (or `verify-full` with provider CA bundle) on every non-local connection.

---

## 4. Production Environment Variables & Secrets Checklist

Configure exclusively in your hosting provider's encrypted secret manager (never in Git or client bundles):

| Variable | Production Requirement |
| --- | --- |
| `DATABASE_URL` | Restricted `viewora_app` (`NOBYPASSRLS`) + `?sslmode=require` |
| `DATABASE_ADMIN_URL` | Direct `viewora_admin` used ONLY during deployment migration job |
| `AUTH_SECRET` | Random 32+ bytes (`openssl rand -hex 32`), rotated via planned window |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Exact HTTPS canonical origin (`https://viewora.yourdomain.com`) |
| `DEMO_MODE_ENABLED` | `false` (also hard-disabled in code when `NODE_ENV=production`) |
| `PAYMENTS_ENABLED` / `NEXT_PUBLIC_PAYMENTS_ENABLED` | `false` until explicit billing authorization |
| `NODE_ENV` | `production` |

---

## 5. Production Release & Rollout Sequence

1. Run `npm run env:check -- --strict` in the deployment pipeline (verifies secrets, role separation, TLS, zero Supabase, and `PAYMENTS_ENABLED=false`).
2. Take an automated pre-migration snapshot of the production PostgreSQL database.
3. Run `npm run db:migrate:deploy` using `DATABASE_ADMIN_URL` (never `prisma migrate dev` or `prisma db push` in production).
4. Run `npm run db:seed` (idempotent reference plans, entitlements, feature flags, CMS disclosures).
5. On initial launch only, run `npm run db:bootstrap-admin` once from a secured admin shell with an interactive or secret-injected password (>= 12 chars, mixed classes).
6. Deploy the Next.js production build and verify `GET /api/health` returns `database.status === "healthy"`, `demoMode.enabled === false`, and `payments.enabled === false`.
7. Monitor PostgreSQL connection pool saturation, slow queries (`pg_stat_statements`), `audit_logs`, and daily PITR backup health.
