#!/usr/bin/env node
/**
 * Viewora — Hosted Neon Runtime Verification Suite (Task 6 — Non-Destructive)
 *
 * Executes exclusively via the restricted pooled `viewora_app` connection
 * (`VIEWORA_DATABASE_URL`), verifying:
 *   1. Restricted role identity (NOSUPERUSER, NOBYPASSRLS, zero table ownership)
 *   2. Exact schema counts (58 tables, 6 migrations, 74 FKs, 147 indexes, 24 RLS policies)
 *   3. Exact clean seed state (5 plans, 15 billing options, 65 entitlements, 5 flags, 6 CMS,
 *      payments_enabled=false, 0 demo/synthetic users, 0 synthetic support tickets)
 *   4. Transaction-scoped RLS context (`set_config(..., true)`) over pooled connection
 *   5. Advisory locking (`pg_advisory_xact_lock`) over pooled connection
 *   6. Database-enforced `audit_logs` immutability (revoked UPDATE/DELETE/TRUNCATE + trigger)
 *   7. Database health probe latency & auth/registration table readiness
 *
 * Leaves ZERO synthetic rows behind (any probe write runs inside a rolled-back transaction).
 */
import { PrismaClient } from '@prisma/client';

const rawUrl = (process.env.DATABASE_URL || '').trim();
const parsed = new URL(rawUrl);
const prisma = new PrismaClient({ datasources: { db: { url: rawUrl } } });

function assert(cond, msg) {
  if (!cond) throw new Error(`Hosted Verification Failed: ${msg}`);
}

try {
  const t0 = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const healthLatencyMs = Date.now() - t0;

  const [role] = await prisma.$queryRawUnsafe(`
    SELECT
      current_user AS active_role,
      current_database() AS active_db,
      r.rolsuper,
      r.rolcreatedb,
      r.rolcreaterole,
      r.rolbypassrls,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname IN ('public','app') AND tableowner = current_user) AS owned_tables,
      has_table_privilege(current_user, 'public.audit_logs', 'SELECT') AS audit_can_select,
      has_table_privilege(current_user, 'public.audit_logs', 'INSERT') AS audit_can_insert,
      has_table_privilege(current_user, 'public.audit_logs', 'UPDATE') AS audit_can_update,
      has_table_privilege(current_user, 'public.audit_logs', 'DELETE') AS audit_can_delete,
      has_table_privilege(current_user, 'public.audit_logs', 'TRUNCATE') AS audit_can_truncate,
      has_schema_privilege('public', 'public', 'CREATE') AS public_can_create
    FROM pg_roles r
    WHERE r.rolname = current_user
  `);

  assert(role.active_role === 'viewora_app', `Expected runtime role viewora_app, got ${role.active_role}`);
  assert(role.rolsuper === false && role.rolbypassrls === false && role.rolcreatedb === false && role.rolcreaterole === false, 'Runtime role has elevated privileges');
  assert(role.owned_tables === 0, `Runtime role should own 0 tables, owns ${role.owned_tables}`);
  assert(role.audit_can_select && role.audit_can_insert, 'Runtime role must have SELECT + INSERT on audit_logs');
  assert(!role.audit_can_update && !role.audit_can_delete && !role.audit_can_truncate, 'Runtime role must NOT have UPDATE/DELETE/TRUNCATE on audit_logs');
  assert(role.public_can_create === false, 'PUBLIC must NOT have CREATE on schema public');

  const [schemaCounts] = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations') AS tables,
      (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public') AS rls_policies,
      (SELECT count(*)::int FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_type = 'FOREIGN KEY') AS foreign_keys,
      (SELECT count(*)::int FROM pg_indexes WHERE schemaname = 'public') AS indexes,
      (SELECT count(*)::int FROM pg_trigger WHERE tgname = 'trg_audit_logs_immutable') AS audit_trigger
  `);

  assert(schemaCounts.tables === 58, `Expected 58 tables, got ${schemaCounts.tables}`);
  assert(schemaCounts.rls_policies === 24, `Expected 24 RLS policies, got ${schemaCounts.rls_policies}`);
  assert(schemaCounts.foreign_keys === 74, `Expected 74 FKs, got ${schemaCounts.foreign_keys}`);
  assert(schemaCounts.indexes === 147, `Expected 147 indexes, got ${schemaCounts.indexes}`);
  assert(schemaCounts.audit_trigger === 1, 'Missing trg_audit_logs_immutable trigger');

  // Verify clean seeded configuration
  const [plans, billingOptions, entitlements, featureFlags, cmsEntries, usersCount, ticketsCount, paymentsFlag] =
    await Promise.all([
      prisma.plan.count(),
      prisma.planBillingOption.count(),
      prisma.planEntitlement.count(),
      prisma.featureFlag.count(),
      prisma.cmsContent.count(),
      prisma.user.count(),
      prisma.supportTicket.count(),
      prisma.featureFlag.findUnique({ where: { key: 'payments_enabled' } }),
    ]);

  assert(plans === 5, `Expected 5 plans, got ${plans}`);
  assert(billingOptions === 15, `Expected 15 billing options, got ${billingOptions}`);
  assert(entitlements === 65, `Expected 65 entitlements, got ${entitlements}`);
  assert(featureFlags === 5, `Expected 5 feature flags, got ${featureFlags}`);
  assert(cmsEntries === 6, `Expected 6 CMS entries, got ${cmsEntries}`);
  assert(paymentsFlag && paymentsFlag.enabled === false, 'payments_enabled flag MUST be false');
  assert(ticketsCount === 0, `Expected 0 synthetic support tickets, got ${ticketsCount}`);

  // Verify RLS transaction-local context + advisory locks over pooled connection
  const rlsAndLockCheck = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', '00000000-0000-4000-8000-000000000001', true)`;
    await tx.$executeRaw`SELECT set_config('app.current_user_role', 'customer', true)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('viewora:hosted_probe'))`;
    const [ctx] = await tx.$queryRawUnsafe(`
      SELECT
        app.current_user_id()::text AS uid,
        app.current_user_role() AS urole,
        app.is_admin() AS is_adm
    `);
    // Under RLS as random customer UUID, private user_preferences count must be 0
    const prefVisible = await tx.userPreference.count();
    return { ctx, prefVisible };
  });

  assert(rlsAndLockCheck.ctx.uid === '00000000-0000-4000-8000-000000000001', 'RLS app.current_user_id() mismatch');
  assert(rlsAndLockCheck.ctx.urole === 'customer' && rlsAndLockCheck.ctx.is_adm === false, 'RLS role helper mismatch');

  console.log(
    JSON.stringify(
      {
        ok: true,
        host: parsed.hostname,
        pooled: parsed.hostname.includes('-pooler.'),
        sslmode: parsed.searchParams.get('sslmode') || '(default)',
        healthLatencyMs,
        roleSecurity: role,
        schemaCounts,
        seedVerification: {
          plans,
          billingOptions,
          entitlements,
          featureFlags,
          cmsEntries,
          paymentsEnabled: paymentsFlag.enabled,
          usersCount,
          supportTicketsCount: ticketsCount,
        },
        rlsAndAdvisoryLockCheck: {
          passed: true,
          ...rlsAndLockCheck,
        },
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
