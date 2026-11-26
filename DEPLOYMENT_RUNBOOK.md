# Viewora — Production & Staging Deployment Runbook (Stage 51)

**Date:** 2026-11-26  
**Target Environments:** Hosted Linux HTTPS Staging → Hosted Linux HTTPS Production  
**Zero-Downtime Policy:** Forward-only Prisma migrations, immutable release artifacts, strict pre-flight verification, and instant traffic/provider rollback.

---

## 1. Pre-Deployment Verification Checklist (Mandatory Before Every Release)

Run against the exact candidate Git commit in CI/CD before building the release container:

```bash
npm ci
npm run env:check
npx prisma validate
npm run db:generate
npm run typecheck
npm run lint
npm audit --omit=dev
npm test
npm run test:db        # Executes exclusively against isolated staging/CI test DB
npm run build
```

**Hard Release Stop Conditions:**
- Any non-zero exit code in `typecheck`, `lint`, `test`, `test:db`, or `build`.
- Any high/critical production vulnerability in `npm audit --omit=dev`.
- Any accidentally enabled `PAYMENTS_ENABLED=true`, `PROVIDER_*_ENABLED=true`, or `BETA_PUBLIC_REGISTRATION_ENABLED=true` without matching owner change ticket.
- Any `NEXT_PUBLIC_*` variable containing server secrets or API keys.

---

## 2. Step-by-Step Staging Deployment Procedure

1. **Snapshot Staging Database First:**
   - Capture an encrypted logical backup (`pg_dump --format=custom`) via the staging admin role before applying schema changes.
2. **Apply Forward-Only Database Migrations:**
   - Run `npx prisma migrate deploy` using `DATABASE_ADMIN_URL` (direct PostgreSQL connection, never the app runtime role).
   - Verify least-privilege grants for `viewora_app` (`NOBYPASSRLS`, immutable `audit_logs` trigger intact).
3. **Seed Reference Data (Idempotent):**
   - Run `npm run db:seed` twice on initial environment bootstrap to verify idempotency (5 plans, 15 billing options, 65 entitlements, 5 feature flags, 6 CMS entries).
4. **Deploy Application Container / Release:**
   - Inject environment secrets exclusively from the hosted secret manager (see [ENVIRONMENT_CONFIGURATION_MATRIX.md](file:///c:/Users/Scorpio/Videos/Instagram/ENVIRONMENT_CONFIGURATION_MATRIX.md)).
   - Roll out the container with `NODE_ENV=production` and `NEXT_TELEMETRY_DISABLED=1`.
5. **Post-Deploy Smoke Verification:**
   - Verify `GET /api/health` returns `200` and healthy PostgreSQL status.
   - Verify public pages (`/en`, `/en/pricing`, `/en/tools`, `/en/launch`, `/robots.txt`, `/sitemap.xml`) return `200` with zero console errors.
   - Verify `/en/beta` displays invitation-only state and `POST /api/beta` returns `403 BETA_CLOSED` without a valid invite code.
   - Verify Super Admin login, Admin Console overview, Integration Center 2.0 (confirming all unapproved providers remain `disabled`), and Communications Center.

---

## 3. Production Promotion Procedure

1. Require **100% pass** on HTTPS staging smoke checks, fresh backup verification, and written owner approval for any newly activated provider or flag.
2. Take a pre-release Production encrypted snapshot + confirm PITR WAL archiving is healthy.
3. Run additive `prisma migrate deploy` via `DATABASE_ADMIN_URL` (never destructive DDL during active traffic).
4. Deploy new stateless replicas (blue-green or rolling with health-probe gate).
5. Monitor `GET /api/health`, HTTP 5xx rate, PostgreSQL active connections, and `api_usage_logs` / `cost_budgets` for 30 minutes post-release.

---

## 4. Emergency Rollback Procedure

- **Application Regression:** Immediately shift load-balancer traffic back to the prior immutable container image (blue-green swap < 2 minutes). Because all Viewora migrations are additive and backward-compatible across N-1 releases, code rollback does **not** require destructive database rollback.
- **External API Cost or Abuse Spike:** Trigger **Global Emergency Halt** or **Per-Provider Emergency Halt** in Super Admin Integration Center 2.0 (`cost_budgets.kill_switch_active = true`), which halts both interactive gateway calls and background workers immediately across all pods without requiring a redeploy.
- **Catastrophic Data Corruption:** Follow [DISASTER_RECOVERY_RUNBOOK.md](file:///c:/Users/Scorpio/Videos/Instagram/DISASTER_RECOVERY_RUNBOOK.md) using PITR or verified encrypted `pg_dump` restore.
