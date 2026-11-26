# Viewora — Database Migration Runbook (Stage 51)

**Date:** 2026-11-26  
**Schema Baseline:** 58 application tables · 74 foreign keys · 147 indexes · **24 RLS policies** · **6 forward-only Prisma migrations** (`prisma/migrations/`)

---

## 1. Current Applied Migration Ledger

| # | Migration Directory | Purpose |
| :-: | :--- | :--- |
| 1 | `20261125000001_init` | Core 58-table multi-tenant SaaS schema, indexes, foreign keys |
| 2 | `20261125000002_rls_and_grants` | Initial 23 tenant Row-Level Security policies & least-privilege `viewora_app` grants |
| 3 | `20261125000003_auth_security_hardening` | Session revocation, token/audit indexes, security constraints |
| 4 | `20261125000004_test_role_grants` | Isolated `viewora_test_app` least-privilege grants (eliminating hardcoded runtime assumptions) |
| 5 | `20261126000000_audit_immutability_and_public_schema_hardening` | Revoked `UPDATE`/`DELETE`/`TRUNCATE` on `audit_logs`, added `trg_audit_logs_immutable`, revoked `CREATE ON SCHEMA public FROM PUBLIC` |
| 6 | `20261126000001_profile_snapshots_rls` | Enabled database-level RLS (`profile_snapshots_workspace_isolation`) on `profile_snapshots` (total: **24 RLS policies**) |

---

## 2. Strict Migration Governance Rules

1. **Forward-Only & Additive First:** Never edit an already-applied migration SQL file. Use expand-and-contract (add nullable column → backfill → switch app code → drop legacy column in a subsequent release) so N-1 application pods keep running cleanly during deployment.
2. **Dedicated Admin Connection Only:** Always execute `prisma migrate deploy` with `DATABASE_ADMIN_URL` (direct PostgreSQL connection, never PgBouncer transaction pooler, never the runtime `viewora_app` role).
3. **Never Reset Operational Databases:** `prisma migrate reset` and `DROP SCHEMA` are strictly forbidden on `viewora`, staging, and production.
4. **Role & RLS Re-Verification:** Every new tenant-owned table MUST include `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, a workspace/user isolation policy, and explicit least-privilege grants for `viewora_app` in the same migration.

---

## 3. Standard Migration Execution Sequence (Staging & Production)

```bash
# Step 1: Capture pre-migration encrypted backup (admin role)
# (See DISASTER_RECOVERY_RUNBOOK.md)

# Step 2: Inspect pending migrations
DATABASE_URL="$DATABASE_ADMIN_URL" npx prisma migrate status

# Step 3: Apply forward-only migrations
DATABASE_URL="$DATABASE_ADMIN_URL" npx prisma migrate deploy

# Step 4: Verify exact schema invariants (tables, RLS count, immutable audit trigger)
psql "$DATABASE_ADMIN_URL" -c "
  SELECT
    (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations') AS app_tables,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS rls_policies,
    (SELECT count(*) FROM pg_trigger WHERE tgname='trg_audit_logs_immutable') AS audit_trigger,
    (SELECT rolbypassrls FROM pg_roles WHERE rolname='viewora_app') AS app_bypassrls;
"
```

Expected baseline output: `app_tables >= 58`, `rls_policies >= 24`, `audit_trigger = 1`, `app_bypassrls = f`.
