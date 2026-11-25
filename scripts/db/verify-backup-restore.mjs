#!/usr/bin/env node
/**
 * Viewora — PostgreSQL Backup & Restore Fidelity Verification Script (Task 8)
 *
 * Modes:
 *   - `seed-synthetic`: Creates a synthetic customer, workspace, folder, saved profile,
 *     private note, and subscription in the source database before pg_dump.
 *   - `compare`: Compares the source database (`SOURCE_DATABASE_URL`) against the
 *     restored disposable database (`RESTORED_DATABASE_URL`) on:
 *       * All table row counts
 *       * Representative synthetic customer & workspace records
 *       * Foreign-key constraints count
 *       * Indexes count
 *       * RLS policies count
 *       * Subscriptions & plan entitlements
 *       * Active queryability under the restricted `viewora_app` role (`RESTORED_APP_URL`)
 */
import assert from 'assert';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const mode = process.argv[2];

async function seedSynthetic() {
  const url = process.env.SOURCE_DATABASE_URL;
  assert(url, 'SOURCE_DATABASE_URL is required');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const email = 'backup.synthetic@viewora.test';
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.delete({ where: { id: existing.id } });
    }
    const passwordHash = await bcrypt.hash('BackupCheckPass!2026', 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: 'Backup Synthetic Customer',
        name: 'Backup Synthetic Customer',
        role: 'user',
        segment: 'business',
        preferredLocale: 'en',
        onboardingCompleted: true,
        preferences: {
          create: {
            professionalTitle: 'Backup Verification Analyst',
            coverPreset: 'emerald',
            avatarPreset: 'emerald-teal',
          },
        },
      },
    });
    const ws = await prisma.workspace.create({
      data: {
        ownerId: user.id,
        name: 'Backup Verification Workspace',
        slug: `ws-backup-${user.id.slice(0, 8)}`,
        segment: 'business',
        isDefault: true,
      },
    });
    await prisma.workspaceMember.create({
      data: { workspaceId: ws.id, userId: user.id, memberRole: 'owner' },
    });
    const folder = await prisma.researchFolder.create({
      data: {
        workspaceId: ws.id,
        userId: user.id,
        name: 'Backup Folder',
        color: 'violet',
        description: 'Synthetic backup check',
      },
    });
    const sp = await prisma.savedProfile.create({
      data: {
        workspaceId: ws.id,
        userId: user.id,
        folderId: folder.id,
        username: 'backup.creator',
        displayName: 'Backup Creator',
        isDemo: true,
        dataSource: 'demo_fixture',
        notes: 'Backup fidelity note',
        tags: ['backup-check'],
      },
    });
    await prisma.profileResearchNote.create({
      data: {
        savedProfileId: sp.id,
        workspaceId: ws.id,
        authorId: user.id,
        noteBody: 'Backup fidelity private note',
      },
    });
    const plan = await prisma.plan.findUnique({ where: { code: 'premium' } });
    if (plan) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          workspaceId: ws.id,
          planId: plan.id,
          billingInterval: 'annual',
          status: 'active',
          paymentProvider: 'disabled',
        },
      });
    }
    console.log(JSON.stringify({ seeded: true, userId: user.id, email, workspaceId: ws.id }));
  } finally {
    await prisma.$disconnect();
  }
}

async function getDbSnapshot(prisma) {
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;
  const fks = await prisma.$queryRaw`
    SELECT count(*)::int AS cnt FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'
  `;
  const indexes = await prisma.$queryRaw`
    SELECT count(*)::int AS cnt FROM pg_indexes WHERE schemaname = 'public'
  `;
  const rlsPolicies = await prisma.$queryRaw`
    SELECT count(*)::int AS cnt FROM pg_policies WHERE schemaname = 'public'
  `;

  const counts = {
    users: await prisma.user.count(),
    workspaces: await prisma.workspace.count(),
    workspaceMembers: await prisma.workspaceMember.count(),
    researchFolders: await prisma.researchFolder.count(),
    savedProfiles: await prisma.savedProfile.count(),
    profileResearchNotes: await prisma.profileResearchNote.count(),
    plans: await prisma.plan.count(),
    planBillingOptions: await prisma.planBillingOption.count(),
    planEntitlements: await prisma.planEntitlement.count(),
    subscriptions: await prisma.subscription.count(),
    featureFlags: await prisma.featureFlag.count(),
    cmsContent: await prisma.cmsContent.count(),
  };

  return {
    tableCount: tables.length,
    fkCount: fks[0].cnt,
    indexCount: indexes[0].cnt,
    rlsPolicyCount: rlsPolicies[0].cnt,
    counts,
  };
}

async function compare() {
  const srcUrl = process.env.SOURCE_DATABASE_URL;
  const dstUrl = process.env.RESTORED_DATABASE_URL;
  const dstAppUrl = process.env.RESTORED_APP_URL;
  assert(srcUrl && dstUrl, 'SOURCE_DATABASE_URL and RESTORED_DATABASE_URL are required');

  const src = new PrismaClient({ datasources: { db: { url: srcUrl } } });
  const dst = new PrismaClient({ datasources: { db: { url: dstUrl } } });
  const dstApp = dstAppUrl ? new PrismaClient({ datasources: { db: { url: dstAppUrl } } }) : null;

  try {
    const srcSnap = await getDbSnapshot(src);
    const dstSnap = await getDbSnapshot(dst);

    assert.strictEqual(dstSnap.tableCount, srcSnap.tableCount, 'Restored table count mismatch');
    assert.strictEqual(dstSnap.fkCount, srcSnap.fkCount, 'Restored FK constraint count mismatch');
    assert.strictEqual(dstSnap.indexCount, srcSnap.indexCount, 'Restored index count mismatch');
    assert.strictEqual(dstSnap.rlsPolicyCount, srcSnap.rlsPolicyCount, 'Restored RLS policy count mismatch');
    assert.deepStrictEqual(dstSnap.counts, srcSnap.counts, 'Restored row counts mismatch');

    // Verify representative synthetic customer & workspace relationship survived restore
    const restoredUser = await dst.user.findUnique({
      where: { email: 'backup.synthetic@viewora.test' },
      include: {
        preferences: true,
        ownedWorkspaces: true,
        savedProfiles: true,
        subscriptions: { include: { plan: true } },
      },
    });
    assert(restoredUser, 'Restored synthetic customer not found');
    assert.strictEqual(restoredUser.preferences?.coverPreset, 'emerald');
    assert.strictEqual(restoredUser.ownedWorkspaces[0]?.name, 'Backup Verification Workspace');
    assert.strictEqual(restoredUser.savedProfiles[0]?.username, 'backup.creator');
    assert.strictEqual(restoredUser.subscriptions[0]?.plan.code, 'premium');

    // Verify restored database is usable under restricted viewora_app role with RLS context
    if (dstApp) {
      const appRead = await dstApp.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${restoredUser.id}, true)`;
        await tx.$executeRaw`SELECT set_config('app.current_user_role', 'user', true)`;
        return tx.savedProfile.findMany({ where: { userId: restoredUser.id } });
      });
      assert.strictEqual(appRead.length, 1, 'Expected viewora_app to read restored savedProfile under RLS');
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          source: srcSnap,
          restored: dstSnap,
          restoredCustomerVerified: restoredUser.email,
          restrictedRoleReadVerified: Boolean(dstApp),
        },
        null,
        2
      )
    );
  } finally {
    await src.$disconnect();
    await dst.$disconnect();
    if (dstApp) await dstApp.$disconnect();
  }
}

if (mode === 'seed-synthetic') {
  seedSynthetic().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (mode === 'compare') {
  compare().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.error('Usage: node scripts/db/verify-backup-restore.mjs <seed-synthetic|compare>');
  process.exit(1);
}
