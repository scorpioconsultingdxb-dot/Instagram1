# Viewora — Secure HTTPS Staging Deployment Guide (Stage 61)

**Date:** 2026-11-26  
**Target:** Managed Linux HTTPS Staging (`https://staging.<owner-domain>`) with Managed PostgreSQL 17 (or 16) + Private Networking + TLS 1.3 + Zero-Indexing Protection (`X-Robots-Tag: noindex, nofollow`).  
**Prerequisite:** Explicit owner approval and provisioning of the chosen host from [HOSTING_PROVIDER_COMPARISON.md](file:///c:/Users/Scorpio/Videos/Instagram/HOSTING_PROVIDER_COMPARISON.md).

---

## 1. Staging Architecture Requirements

1. **Application Runtime:** Node.js `22 LTS` or `24 LTS` Linux container running `npm ci && npx prisma generate && npm run build` followed by `npm run start` (`NODE_ENV=production`).
2. **Database:** Independent Managed PostgreSQL **17** (primary target) or **16** (alternative) inside a **private VPC/internal network** with TLS enforced (`sslmode=require` / `verify-full`).
3. **Database Roles (Strict Separation):**
   - `viewora_migrator` (or managed admin role): used **exclusively** during migration/seed/backup steps via `DATABASE_ADMIN_URL` on a direct (non-PgBouncer) connection. **Never injected into the running Next.js container.**
   - `viewora_app`: restricted runtime role (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`) with least-privilege table grants, enforced by **24 RLS policies** and Migration 5 append-only `audit_logs` protection.
4. **Search Engine Isolation:** Configure staging edge proxy to inject `X-Robots-Tag: noindex, nofollow` and optionally HTTP Basic Auth / IP allowlist so search engines never index staging.
5. **External Providers & Billing Locked Off Initially:** Deploy staging first with ALL `PROVIDER_*_ENABLED=false`, `PAYMENTS_ENABLED=false`, `NEXT_PUBLIC_PAYMENTS_ENABLED=false`, `BACKGROUND_JOBS_ENABLED=false`, and `BETA_PUBLIC_REGISTRATION_ENABLED=false`.

---

## 2. Exact Staging Bootstrap & Verification Sequence

```bash
# 1. Verify environment configuration locally/CI before deploy
npm ci
npm run env:check
npx prisma validate
npm run db:generate
npm run typecheck
npm run lint
npm audit --omit=dev
npm test
npm run build

# 2. Provision restricted runtime role on fresh Managed PostgreSQL 17 staging DB (Admin connection)
psql "$STAGING_DATABASE_ADMIN_URL" -c "
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'viewora_app') THEN
      CREATE ROLE viewora_app LOGIN PASSWORD '<VAULT_STRONG_PASSWORD>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
  END \$\$;
"

# 3. Apply all 6 forward-only migrations via direct admin connection
DATABASE_URL="$STAGING_DATABASE_ADMIN_URL" npx prisma migrate deploy

# 4. Run idempotent seed TWICE and confirm identical counts
DATABASE_URL="$STAGING_DATABASE_ADMIN_URL" npx tsx prisma/seed.ts
DATABASE_URL="$STAGING_DATABASE_ADMIN_URL" npx tsx prisma/seed.ts

# 5. Verify schema, RLS policies (24), immutable audit trigger, and NOBYPASSRLS
psql "$STAGING_DATABASE_ADMIN_URL" -c "
  SELECT
    (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations') AS app_tables,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS rls_policies,
    (SELECT count(*) FROM pg_trigger WHERE tgname='trg_audit_logs_immutable') AS audit_trigger,
    (SELECT rolbypassrls FROM pg_roles WHERE rolname='viewora_app') AS app_bypassrls;
"

# 6. Bootstrap Staging Super Admin (distinct staging-only credentials; NEVER copy operational DB data without owner approval)
ADMIN_EMAIL="staging-admin@<owner-domain>" ADMIN_NAME="Viewora Staging Admin" ADMIN_PASSWORD="<VAULT_ADMIN_PASS>" \
  DATABASE_URL="$STAGING_DATABASE_ADMIN_URL" npx tsx scripts/db/create-admin.ts

# 7. Start Next.js production container using ONLY restricted DATABASE_URL (viewora_app)
# 8. Post-deploy smoke verification
curl -fsS "https://staging.<owner-domain>/api/health"
curl -fsS -I "https://staging.<owner-domain>/en/launch"
curl -fsS -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" \
  -d '{"email":"probe@example.com","cohort":"personal"}' "https://staging.<owner-domain>/api/beta"
# Expected: 403 (BETA_CLOSED)
```

---

## 3. Staging Promotion Criteria (Before Activating Stage 63–67 Providers)

- `GET /api/health` returns `200` with `database.status: "healthy"`, `demoMode.enabled: false`, `payments.enabled: false`.
- Fresh encrypted 6-migration `pg_dump -Fc` + disposable `pg_restore` drill succeeds on Linux staging (Stage 62).
- Zero TLS warnings, HSTS active, security headers verified, and zero `5xx` errors across all 21 application views.
