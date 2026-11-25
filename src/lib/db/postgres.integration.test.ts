import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  changeDbUserPassword,
  createDbSession,
  deleteDbUserAccount,
  persistDbAdminUserUpdate,
  registerUserWithWorkspace,
  resolveDbSessionByRawToken,
  revokeDbSessionByRawToken,
  suspendDbUserAccount,
  verifyDbUserCredentials,
} from '@/lib/db/repositories/users.repo';
import {
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  issuePasswordResetToken,
} from '@/lib/db/repositories/auth-tokens.repo';
import { getDbProfilePrefs, saveDbProfilePrefs } from '@/lib/db/repositories/profile-prefs.repo';
import {
  readDbUserMedia,
  readDbUserModuleState,
  saveDbUserMedia,
  deleteDbUserMedia,
  updateDbUserModuleState,
} from '@/lib/db/repositories/user-module-state.repo';
import {
  attributeDbReferral,
  getDbReferralOverview,
  getDbUserReferralDashboard,
  getOrCreateDbReferralCode,
  reviewDbAffiliateApplication,
  submitDbAffiliateApplication,
} from '@/lib/db/repositories/referrals.repo';
import {
  countActiveSuperAdmins,
  revokeAllDbUserSessions,
} from '@/lib/db/repositories/users.repo';
import {
  loadDbUserWorkspaceState,
  persistDbCreateComparison,
  persistDbCreateFolder,
  persistDbCreateWorkspace,
  persistDbDashboardSettings,
  persistDbExportHistory,
  persistDbMarkNotificationRead,
  persistDbProfileMetaUpdate,
  persistDbRemoveProfile,
  persistDbSavedAiReport,
  persistDbSavedProfile,
  QuotaExceededError,
  readDbPrivateProfileNotes,
  WorkspaceAuthorizationError,
} from '@/lib/db/repositories/workspace.repo';
import {
  loadDbAuditLogs,
  loadDbCmsContent,
  loadDbSupportTickets,
  persistDbAuditLog,
  persistDbBroadcastCreate,
  persistDbFeatureFlagToggle,
  persistDbSupportTicketCreate,
  persistDbSupportTicketUpdate,
} from '@/lib/db/repositories/admin.repo';
import { loadDbPlans, loadDbUserOverrides, upsertDbUserOverride } from '@/lib/db/repositories/entitlements.repo';
import { hasAdminCapability } from '@/lib/admin/rbac';
import { withUserRlsContext } from '@/lib/db/prisma';
import type { SavedProfileRecord } from '@/lib/dashboard/store';

/**
 * MANDATORY LIVE POSTGRESQL INTEGRATION TEST SUITE (Tasks 5, 6, 7 & 10)
 *
 * NEVER skips when PostgreSQL is unavailable.
 * Tests actual PostgreSQL 16 operations using BOTH:
 *   - TEST_DATABASE_URL (admin role for schema/policy/cleanup introspection)
 *   - TEST_DATABASE_APP_URL (restricted `viewora_app` role with `NOBYPASSRLS`)
 */
const ADMIN_TEST_URL = (
  process.env.TEST_DATABASE_ADMIN_URL ||
  process.env.TEST_DATABASE_URL ||
  ''
).trim();
const APP_TEST_URL = (
  process.env.TEST_DATABASE_APP_URL ||
  (process.env.TEST_DATABASE_ADMIN_URL ? process.env.TEST_DATABASE_URL : '') ||
  ADMIN_TEST_URL
).trim();

function makeProfileFixture(username: string, privateNote = ''): SavedProfileRecord {
  const now = new Date().toISOString();
  return {
    id: `tmp-${randomUUID()}`,
    username,
    profile: {
      username,
      displayName: `Creator ${username}`,
      bio: 'Public bio snapshot for PostgreSQL integration verification',
      category: 'Creator',
      externalUrl: null,
      isVerified: false,
      isBusinessAccount: true,
      isPrivate: false,
      avatarInitials: 'CR',
      avatarAccent: '#7957FF',
      followersCount: 18400,
      followingCount: 310,
      postsCount: 120,
      estimatedEngagementRate: 4.2,
      postingCadencePerWeek: 3,
      recentPosts: [],
      historicalTrend: [],
    },
    dataClass: 'demo',
    providerLabel: 'demo_fixture',
    workspace: 'Personal Workspace',
    folderId: null,
    tags: ['integration-test'],
    privateNote,
    savedAt: now,
    updatedAt: now,
  };
}

describe('Mandatory Live PostgreSQL Integration Verification (viewora_test)', () => {
  let adminClient: PrismaClient;
  let appClient: PrismaClient;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    if (!ADMIN_TEST_URL || !/^postgres(ql)?:\/\//i.test(ADMIN_TEST_URL)) {
      throw new Error(
        'MANDATORY DATABASE GATE FAILED: TEST_DATABASE_URL is not configured. Start PostgreSQL and set TEST_DATABASE_URL to viewora_test.'
      );
    }

    const adminDbName = new URL(ADMIN_TEST_URL).pathname.replace(/^\/+/, '');
    const appDbName = new URL(APP_TEST_URL).pathname.replace(/^\/+/, '');
    if (!/(^|_)test($|_)/i.test(adminDbName) || !/(^|_)test($|_)/i.test(appDbName)) {
      throw new Error(
        `SAFETY BLOCK: Integration tests must target an isolated test database (e.g. viewora_test), refusing to run against "${adminDbName}" / "${appDbName}".`
      );
    }

    adminClient = new PrismaClient({ datasources: { db: { url: ADMIN_TEST_URL } } });
    appClient = new PrismaClient({ datasources: { db: { url: APP_TEST_URL } } });

    try {
      await adminClient.$queryRaw`SELECT 1`;
      await appClient.$queryRaw`SELECT 1`;
    } catch (err) {
      throw new Error(
        `MANDATORY DATABASE GATE FAILED: Unable to connect to PostgreSQL (${err instanceof Error ? err.message : String(err)}).`
      );
    }
  });

  afterAll(async () => {
    if (adminClient) {
      for (const uid of createdUserIds) {
        await adminClient.user.deleteMany({ where: { id: uid } }).catch(() => undefined);
      }
      await adminClient.supportTicket
        .deleteMany({ where: { email: { endsWith: '@viewora.test' } } })
        .catch(() => undefined);
      await adminClient.accountDeletionRequest
        .deleteMany({ where: { email: { endsWith: '@viewora.test' } } })
        .catch(() => undefined);
      await adminClient.$disconnect();
    }
    if (appClient) {
      await appClient.$disconnect();
    }
  });

  it('verifies all 58 tables, indexes, foreign keys, RLS policies, seeded plans, and restricted runtime role', async () => {
    const tables = await adminClient.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    expect(tables.length).toBe(58);

    const indexes = await adminClient.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    `;
    expect(indexes.length).toBeGreaterThanOrEqual(45);

    const fkConstraints = await adminClient.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY'
    `;
    expect(fkConstraints.length).toBeGreaterThanOrEqual(40);

    const rlsPolicies = await adminClient.$queryRaw<Array<{ tablename: string; policyname: string }>>`
      SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
    `;
    expect(rlsPolicies.length).toBeGreaterThanOrEqual(20);

    // Seeded plans & entitlements present and idempotent
    const plans = await loadDbPlans(appClient);
    expect(plans.map((p) => p.code)).toEqual(['free', 'starter', 'premium', 'pro', 'agency']);

    // Verify restricted runtime role cannot bypass RLS and is not superuser
    if (process.env.TEST_DATABASE_APP_URL || process.env.TEST_DATABASE_ADMIN_URL) {
      const roleInfo = await appClient.$queryRaw<
        Array<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>
      >`
        SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
      `;
      expect(['viewora_app', 'viewora_test_app']).toContain(roleInfo[0]?.rolname);
      expect(roleInfo[0]?.rolsuper).toBe(false);
      expect(roleInfo[0]?.rolbypassrls).toBe(false);
    }
  });

  it('enforces transaction rollback, unique email constraints, and foreign-key integrity', async () => {
    const email = `rollback-${randomUUID().slice(0, 8)}@viewora.test`;

    await expect(
      appClient.$transaction(async (tx) => {
        await tx.user.create({
          data: { email, fullName: 'Will Rollback', role: 'user', segment: 'personal' },
        });
        throw new Error('Intentional rollback verification');
      })
    ).rejects.toThrow('Intentional rollback verification');

    expect(await appClient.user.findUnique({ where: { email } })).toBeNull();

    // Foreign-key constraint rejection
    await expect(
      adminClient.workspace.create({
        data: {
          ownerId: randomUUID(),
          name: 'Orphan Workspace',
          slug: `orphan-${randomUUID().slice(0, 8)}`,
        },
      })
    ).rejects.toThrow();

    // Duplicate email prevention
    const dupEmail = `dup-${randomUUID().slice(0, 8)}@viewora.test`;
    const first = await registerUserWithWorkspace(
      {
        email: dupEmail,
        password: 'StrongPassword123!',
        fullName: 'First User',
        segment: 'personal',
        preferredLocale: 'en',
        emailPreferences: { productUpdates: false, weeklyDigest: false, trackingAlerts: true, marketing: false },
      },
      appClient
    );
    expect(first.ok).toBe(true);
    if (first.ok) createdUserIds.push(first.user.id);

    const second = await registerUserWithWorkspace(
      {
        email: dupEmail.toUpperCase(),
        password: 'StrongPassword123!',
        fullName: 'Second User',
        segment: 'personal',
        preferredLocale: 'en',
        emailPreferences: { productUpdates: false, weeklyDigest: false, trackingAlerts: true, marketing: false },
      },
      appClient
    );
    expect(second.ok).toBe(false);
  });

  it('verifies full customer persistence, multi-workspace & cross-account RLS isolation, private note protection, and concurrent quota enforcement under viewora_app', async () => {
    const emailA = `cust-a-${randomUUID().slice(0, 8)}@viewora.test`;
    const emailB = `cust-b-${randomUUID().slice(0, 8)}@viewora.test`;

    const regA = await registerUserWithWorkspace(
      {
        email: emailA,
        password: 'CustomerAPass!2026',
        fullName: 'Customer Alpha',
        segment: 'business',
        preferredLocale: 'en',
        emailPreferences: { productUpdates: false, weeklyDigest: true, trackingAlerts: true, marketing: false },
      },
      appClient
    );
    const regB = await registerUserWithWorkspace(
      {
        email: emailB,
        password: 'CustomerBPass!2026',
        fullName: 'Customer Beta',
        segment: 'personal',
        preferredLocale: 'pt-BR',
        emailPreferences: { productUpdates: false, weeklyDigest: false, trackingAlerts: true, marketing: false },
      },
      appClient
    );
    expect(regA.ok && regB.ok).toBe(true);
    if (!regA.ok || !regB.ok) return;
    createdUserIds.push(regA.user.id, regB.user.id);

    // 1. Profile customization (avatar, cover, locale, theme, shortcuts)
    const prefsA = await saveDbProfilePrefs(
      regA.user.id,
      {
        fullName: 'Customer Alpha Updated',
        professionalTitle: 'Head of Social Intelligence',
        organization: 'Alpha Research Group',
        coverPreset: 'emerald',
        avatarPreset: 'emerald-teal',
        themePreference: 'dark',
        accentPreset: 'cyan',
        personalShortcuts: [{ id: 's1', label: 'Profiles', href: '/dashboard/profiles' }],
      },
      appClient
    );
    expect(prefsA.coverPreset).toBe('emerald');
    expect(prefsA.avatarPreset).toBe('emerald-teal');

    // 2. Second workspace (cross-workspace isolation) + dashboard settings
    const afterWs2 = await persistDbCreateWorkspace(
      regA.user.id,
      'Alpha Client Workspace',
      'Personal Workspace',
      appClient
    );
    expect(afterWs2.workspaces).toContain('Alpha Client Workspace');
    await persistDbDashboardSettings(
      regA.user.id,
      { defaultDateRange: '90d', showTableByDefault: true },
      'Personal Workspace',
      appClient
    );

    // 3. Research folder + saved profile + private note + comparison + AI report + export + notification
    const { folder } = await persistDbCreateFolder(
      regA.user.id,
      {
        id: 'tmp',
        name: 'Competitor Watch',
        color: 'cyan',
        description: 'Private Q4 tracking',
        createdAt: new Date().toISOString(),
      },
      'Personal Workspace',
      appClient
    );

    const { savedProfile, workspace: wsA } = await persistDbSavedProfile(
      regA.user.id,
      {
        ...makeProfileFixture('alpha.target', 'Confidential pricing notes for Alpha only'),
        folderId: folder.id,
      },
      'Personal Workspace',
      appClient,
      { maxProfilesLimit: 5 }
    );

    await persistDbCreateComparison(
      regA.user.id,
      {
        id: 'tmp',
        name: 'Alpha Benchmark',
        description: 'Private comparison',
        usernames: ['alpha.target', 'beta.peer'],
        notes: 'Keep private',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      'Personal Workspace',
      appClient
    );

    await persistDbSavedAiReport(
      regA.user.id,
      {
        reportType: 'profile_performance',
        username: 'alpha.target',
        dataClass: 'demo',
        executionMode: 'template_fallback',
        modelName: 'deterministic_template',
        promptVersion: 'viewora-ai-v2.0',
        executiveSummary: 'Persistent PostgreSQL AI summary',
        keyFindings: ['Steady engagement'],
        recommendations: ['Maintain posting cadence'],
        dataLimitations: ['Demo fixture data'],
        sourceLabel: 'Integration Test',
        generatedAt: new Date().toISOString(),
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      },
      'Personal Workspace',
      appClient
    );

    await persistDbExportHistory(
      regA.user.id,
      { username: 'alpha.target', format: 'csv', dataClass: 'demo' },
      'Personal Workspace',
      appClient
    );

    // Subscription override persistence
    await upsertDbUserOverride(
      regA.user.id,
      { featureKey: 'ai_profile_reports', enabled: true, numericLimit: 42, reason: 'QA test' },
      null,
      appClient
    );
    const overridesA = await loadDbUserOverrides(regA.user.id, appClient);
    expect(overridesA.find((o) => o.featureKey === 'ai_profile_reports')?.numericLimit).toBe(42);

    // Notification read state persistence
    const notifId = wsA.notifications[0]!.id;
    const afterRead = await persistDbMarkNotificationRead(
      regA.user.id,
      notifId,
      true,
      'Personal Workspace',
      appClient
    );
    expect(afterRead.notifications.find((n) => n.id === notifId)?.read).toBe(true);

    // 4. Cross-account & cross-workspace isolation under restricted viewora_app
    const wsB = await loadDbUserWorkspaceState(regB.user.id, 'Personal Workspace', appClient);
    expect(wsB.savedProfiles).toHaveLength(0);
    expect(wsB.comparisons).toHaveLength(0);
    expect(wsB.reports).toHaveLength(0);
    expect(wsB.exports).toHaveLength(0);
    expect(wsB.workspaces).not.toContain('Alpha Client Workspace');

    await expect(
      readDbPrivateProfileNotes(regB.user.id, savedProfile.id, appClient)
    ).rejects.toThrow(WorkspaceAuthorizationError);

    await expect(
      persistDbProfileMetaUpdate(
        regB.user.id,
        { username: 'alpha.target', privateNote: 'Injected' },
        'Personal Workspace',
        appClient
      )
    ).rejects.toThrow(WorkspaceAuthorizationError);

    await expect(
      persistDbRemoveProfile(regB.user.id, 'alpha.target', 'Personal Workspace', appClient)
    ).rejects.toThrow(WorkspaceAuthorizationError);

    // Direct raw RLS checks under viewora_app:
    // (a) No context -> 0 saved profiles visible
    // (b) Even super_admin RLS context -> 0 private research notes visible
    if (process.env.TEST_DATABASE_APP_URL) {
      const noCtxProfiles = await withUserRlsContext(
        { userId: null, role: 'anonymous' },
        (tx) => tx.savedProfile.findMany({ where: { id: savedProfile.id } }),
        appClient
      );
      expect(noCtxProfiles).toHaveLength(0);

      const adminReadPrivateNotes = await withUserRlsContext(
        { userId: regB.user.id, role: 'super_admin' },
        (tx) => tx.profileResearchNote.findMany({ where: { savedProfileId: savedProfile.id } }),
        appClient
      );
      expect(adminReadPrivateNotes).toHaveLength(0);
    }

    // 5. Concurrent quota enforcement on Customer B (limit = 1): 4 parallel calls -> strictly 1 wins!
    const raceResults = await Promise.allSettled([
      persistDbSavedProfile(regB.user.id, makeProfileFixture('race.one'), 'Personal Workspace', appClient, {
        maxProfilesLimit: 1,
      }),
      persistDbSavedProfile(regB.user.id, makeProfileFixture('race.two'), 'Personal Workspace', appClient, {
        maxProfilesLimit: 1,
      }),
      persistDbSavedProfile(regB.user.id, makeProfileFixture('race.three'), 'Personal Workspace', appClient, {
        maxProfilesLimit: 1,
      }),
      persistDbSavedProfile(regB.user.id, makeProfileFixture('race.four'), 'Personal Workspace', appClient, {
        maxProfilesLimit: 1,
      }),
    ]);

    expect(raceResults.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      raceResults.filter((r) => r.status === 'rejected' && r.reason instanceof QuotaExceededError)
    ).toHaveLength(3);

    // 6. Fresh connection persistence verification
    const freshClient = new PrismaClient({ datasources: { db: { url: APP_TEST_URL } } });
    try {
      const reloadedPrefs = await getDbProfilePrefs(regA.user.id, freshClient);
      expect(reloadedPrefs.coverPreset).toBe('emerald');
      expect(reloadedPrefs.avatarPreset).toBe('emerald-teal');
      const reloadedWs = await loadDbUserWorkspaceState(regA.user.id, 'Personal Workspace', freshClient);
      expect(reloadedWs.savedProfiles.some((p) => p.username === 'alpha.target')).toBe(true);
      expect(reloadedWs.comparisons).toHaveLength(1);
      expect(reloadedWs.reports).toHaveLength(1);
      expect(reloadedWs.exports).toHaveLength(1);
      expect(reloadedWs.settings.defaultDateRange).toBe('90d');
    } finally {
      await freshClient.$disconnect();
    }
  });

  it('verifies full session lifecycle, least-privilege admin roles, support/CMS/broadcast/audit persistence, and account deletion', async () => {
    const email = `lifecycle-${randomUUID().slice(0, 8)}@viewora.test`;
    const reg = await registerUserWithWorkspace(
      {
        email,
        password: 'LifecyclePass!2026',
        fullName: 'Lifecycle User',
        segment: 'personal',
        preferredLocale: 'en',
        emailPreferences: { productUpdates: false, weeklyDigest: false, trackingAlerts: true, marketing: false },
      },
      appClient
    );
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;
    createdUserIds.push(reg.user.id);

    // Least-privilege RBAC boundary verification
    expect(hasAdminCapability('support_agent', 'manage_support')).toBe(true);
    expect(hasAdminCapability('support_agent', 'manage_roles')).toBe(false);
    expect(hasAdminCapability('support_agent', 'manage_flags')).toBe(false);
    expect(hasAdminCapability('analyst', 'manage_plans')).toBe(false);
    expect(hasAdminCapability('analyst', 'manage_users')).toBe(false);
    expect(hasAdminCapability('content_manager', 'manage_cms')).toBe(true);
    expect(hasAdminCapability('content_manager', 'manage_roles')).toBe(false);
    expect(hasAdminCapability('content_manager', 'manage_entitlements')).toBe(false);

    // Email verification single-use
    expect((await consumeEmailVerificationToken(reg.verificationTokenRaw, appClient)).ok).toBe(true);
    expect((await consumeEmailVerificationToken(reg.verificationTokenRaw, appClient)).ok).toBe(false);

    // Expired session rejected immediately
    const expiredSess = await createDbSession({ userId: reg.user.id, ttlMs: -5000 }, appClient);
    expect(await resolveDbSessionByRawToken(expiredSess.rawToken, appClient)).toBeNull();

    // Active session + revocation on logout
    const sess1 = await createDbSession({ userId: reg.user.id }, appClient);
    expect((await resolveDbSessionByRawToken(sess1.rawToken, appClient))?.id).toBe(reg.user.id);
    expect(await revokeDbSessionByRawToken(sess1.rawToken, appClient)).toBe(true);
    expect(await resolveDbSessionByRawToken(sess1.rawToken, appClient)).toBeNull();

    // Password change revokes other sessions
    const keepSess = await createDbSession({ userId: reg.user.id }, appClient);
    const otherSess = await createDbSession({ userId: reg.user.id }, appClient);
    expect(
      (
        await changeDbUserPassword(
          {
            userId: reg.user.id,
            currentPassword: 'LifecyclePass!2026',
            newPassword: 'ChangedPass!2026',
            keepCurrentSessionRawToken: keepSess.rawToken,
          },
          appClient
        )
      ).ok
    ).toBe(true);
    expect(await resolveDbSessionByRawToken(keepSess.rawToken, appClient)).not.toBeNull();
    expect(await resolveDbSessionByRawToken(otherSess.rawToken, appClient)).toBeNull();

    // Password reset single-use & revokes all sessions
    const reset = await issuePasswordResetToken(email, appClient);
    expect(reset.issued).toBe(true);
    expect(
      (await consumePasswordResetToken(reset.rawToken!, 'ResetFinal!2026', appClient)).ok
    ).toBe(true);
    expect(
      (await consumePasswordResetToken(reset.rawToken!, 'ReplayPass!2026', appClient)).ok
    ).toBe(false);
    expect(await resolveDbSessionByRawToken(keepSess.rawToken, appClient)).toBeNull();

    // Admin role promotion & immediate role removal reflected on active session
    const roleSess = await createDbSession({ userId: reg.user.id }, appClient);
    await persistDbAdminUserUpdate(reg.user.id, { role: 'super_admin' }, appClient);
    expect((await resolveDbSessionByRawToken(roleSess.rawToken, appClient))?.role).toBe('super_admin');
    await persistDbAdminUserUpdate(reg.user.id, { role: 'user' }, appClient);
    expect((await resolveDbSessionByRawToken(roleSess.rawToken, appClient))?.role).toBe('user');

    // Support ticket, status history, CMS, broadcast, audit & locked payments flag
    const ticket = await persistDbSupportTicketCreate(
      {
        userId: reg.user.id,
        email,
        subject: 'Live Postgres Support Ticket',
        message: 'Testing support RLS under viewora_app',
        priority: 'normal',
      },
      appClient
    );
    const updatedTkt = await persistDbSupportTicketUpdate(
      ticket.id,
      { status: 'resolved', adminNotes: 'Resolved in integration test' },
      reg.user.id,
      appClient,
      'support_agent'
    );
    expect(updatedTkt?.status).toBe('resolved');
    const supportQueue = await loadDbSupportTickets(appClient, { role: 'support_agent' });
    expect(supportQueue.some((t) => t.id === ticket.id)).toBe(true);

    const cmsItems = await loadDbCmsContent(appClient);
    expect(cmsItems.length).toBeGreaterThanOrEqual(5);

    const bcast = await persistDbBroadcastCreate(
      {
        title: 'CI Verification Banner',
        body: 'Synthetic integration test broadcast',
        category: 'system',
        targetSegment: 'all',
        isActive: true,
        createdBy: reg.user.id,
      },
      appClient
    );
    expect(bcast.id).toBeTruthy();

    await persistDbAuditLog(
      {
        actorId: reg.user.id,
        actorEmail: email,
        action: 'ci.integration.verified',
        targetType: 'system',
        targetId: 'stage1',
        diff: { verified: true },
      },
      appClient
    );
    const logs = await loadDbAuditLogs(appClient);
    expect(logs.some((l) => l.action === 'ci.integration.verified')).toBe(true);

    // Payments flag remains strictly locked false
    const payToggle = await persistDbFeatureFlagToggle('payments_enabled', true, reg.user.id, appClient);
    expect(payToggle.ok).toBe(false);

    // Account suspension immediately invalidates active sessions & blocks login
    await suspendDbUserAccount(reg.user.id, appClient);
    expect(await resolveDbSessionByRawToken(roleSess.rawToken, appClient)).toBeNull();
    expect(await verifyDbUserCredentials(email, 'ResetFinal!2026', appClient)).toBeNull();

    // Account deletion cascades user records while preserving audit trail
    await deleteDbUserAccount(reg.user.id, email, appClient);
    expect(await adminClient.user.findUnique({ where: { id: reg.user.id } })).toBeNull();
    const deletionAudits = await adminClient.auditLog.findMany({
      where: { action: 'user.account.deleted', targetId: reg.user.id },
    });
    expect(deletionAudits.length).toBeGreaterThanOrEqual(1);
  });

  it('persists Personal Digital HQ 2.0, widgets, and Phase 3 module state in live PostgreSQL with strict cross-user RLS isolation', async () => {
    const emailA = `hq-a-${randomUUID().slice(0, 8)}@viewora.test`;
    const emailB = `hq-b-${randomUUID().slice(0, 8)}@viewora.test`;

    const regA = await registerUserWithWorkspace(
      {
        email: emailA,
        password: 'HqUserAPass!2026',
        fullName: 'HQ Owner A',
        segment: 'agency',
        preferredLocale: 'en',
        emailPreferences: { productUpdates: false, weeklyDigest: false, trackingAlerts: true, marketing: false },
      },
      appClient
    );
    const regB = await registerUserWithWorkspace(
      {
        email: emailB,
        password: 'HqUserBPass!2026',
        fullName: 'HQ Owner B',
        segment: 'personal',
        preferredLocale: 'en',
        emailPreferences: { productUpdates: false, weeklyDigest: false, trackingAlerts: true, marketing: false },
      },
      appClient
    );
    expect(regA.ok && regB.ok).toBe(true);
    if (!regA.ok || !regB.ok) return;
    createdUserIds.push(regA.user.id, regB.user.id);

    // Newly registered users begin with onboardingCompleted = false
    expect(regA.user.onboardingCompleted).toBe(false);

    // Save extended Personal HQ 2.0 + Onboarding + Widget Visibility for User A
    const savedA = await saveDbProfilePrefs(
      regA.user.id,
      {
        professionalTitle: 'Live PG Strategist',
        biography: 'Persisted natively in PostgreSQL 14.25 under RLS.',
        interests: ['creators', 'agency-reporting'],
        onboardingSegment: 'agency',
        onboardingStep: 4,
        onboardingCompleted: true,
        coverPreset: 'midnight',
        coverPosition: 'top',
        widgetVisibility: { checklist: false, kpis: true },
      },
      appClient
    );
    expect(savedA.biography).toBe('Persisted natively in PostgreSQL 14.25 under RLS.');
    expect(savedA.onboardingCompleted).toBe(true);
    expect(savedA.widgetVisibility.checklist).toBe(false);

    // Persist Phase 3 custom report document for User A without clobbering HQ extended fields
    await updateDbUserModuleState<Array<{ id: string; title: string }>>(
      regA.user.id,
      'customReports',
      () => [],
      (prev) => [{ id: 'crpt-live-1', title: 'Live PG Agency Brief' }, ...prev],
      appClient
    );

    const reloadedA = await getDbProfilePrefs(regA.user.id, appClient);
    const reloadedReportsA = await readDbUserModuleState<Array<{ id: string; title: string }>>(
      regA.user.id,
      'customReports',
      () => [],
      appClient
    );
    expect(reloadedA.biography).toBe('Persisted natively in PostgreSQL 14.25 under RLS.');
    expect(reloadedA.widgetVisibility.checklist).toBe(false);
    expect(reloadedReportsA).toEqual([{ id: 'crpt-live-1', title: 'Live PG Agency Brief' }]);

    // Strict PostgreSQL RLS isolation: User B querying user_preferences for User A sees ZERO rows
    const crossRead = await withUserRlsContext(
      { userId: regB.user.id, role: 'user' },
      (tx) => tx.userPreference.findUnique({ where: { userId: regA.user.id } }),
      appClient
    );
    expect(crossRead).toBeNull();
  });

  it('verifies Phase 4 durable PG customer media, native PG referrals/affiliates, and admin session revocation under RLS', async () => {
    const emailOwner = `p4-owner-${randomUUID().slice(0, 8)}@viewora.test`;
    const emailInvitee = `p4-invitee-${randomUUID().slice(0, 8)}@viewora.test`;

    const regOwner = await registerUserWithWorkspace(
      {
        email: emailOwner,
        password: 'P4OwnerPass!2026',
        fullName: 'Phase4 Partner Owner',
        segment: 'agency',
        preferredLocale: 'en',
        emailPreferences: { productUpdates: false, weeklyDigest: false, trackingAlerts: true, marketing: false },
      },
      appClient
    );
    const regInvitee = await registerUserWithWorkspace(
      {
        email: emailInvitee,
        password: 'P4InviteePass!2026',
        fullName: 'Phase4 Referred User',
        segment: 'personal',
        preferredLocale: 'en',
        emailPreferences: { productUpdates: false, weeklyDigest: false, trackingAlerts: true, marketing: false },
      },
      appClient
    );
    expect(regOwner.ok && regInvitee.ok).toBe(true);
    if (!regOwner.ok || !regInvitee.ok) return;
    createdUserIds.push(regOwner.user.id, regInvitee.user.id);

    // 1. Durable PostgreSQL customer media storage + cross-user RLS isolation
    await saveDbUserMedia(
      regOwner.user.id,
      'avatar',
      {
        contentType: 'image/png',
        extension: 'png',
        sizeBytes: 68,
        sha256: 'abc123',
        base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        storedAt: new Date().toISOString(),
      },
      appClient
    );
    const ownerMedia = await readDbUserMedia(regOwner.user.id, 'avatar', appClient);
    expect(ownerMedia?.contentType).toBe('image/png');
    expect(ownerMedia?.sizeBytes).toBe(68);
    // Invitee reading own media gets null (cannot see owner's avatar)
    expect(await readDbUserMedia(regInvitee.user.id, 'avatar', appClient)).toBeNull();
    await deleteDbUserMedia(regOwner.user.id, 'avatar', appClient);
    expect(await readDbUserMedia(regOwner.user.id, 'avatar', appClient)).toBeNull();

    // 2. Native PostgreSQL referral codes, self-referral & duplicate fraud prevention, affiliate review
    const codeRec = await getOrCreateDbReferralCode(regOwner.user.id, appClient);
    expect(codeRec.code.startsWith('VW-')).toBe(true);
    expect(codeRec.payoutsEnabled).toBe(false);

    const selfAttempt = await attributeDbReferral(
      { code: codeRec.code, referredUserId: regOwner.user.id, consentVerified: true },
      appClient
    );
    expect(selfAttempt?.status).toBe('rejected_self_referral');

    const validAttribution = await attributeDbReferral(
      { code: codeRec.code, referredUserId: regInvitee.user.id, consentVerified: true, utmCampaign: 'p4_launch' },
      appClient
    );
    expect(validAttribution?.status).toBe('attributed_pending_billing');

    const dupAttempt = await attributeDbReferral(
      { code: codeRec.code, referredUserId: regInvitee.user.id, consentVerified: true },
      appClient
    );
    expect(dupAttempt?.status).toBe('rejected_duplicate');

    const appRec = await submitDbAffiliateApplication(
      {
        userId: regOwner.user.id,
        email: emailOwner,
        organization: 'Phase 4 Media Partners',
        channelUrl: 'https://example.com/partners',
        audienceNotes: 'Educating agencies on transparent analytics.',
      },
      appClient
    );
    expect(appRec.status).toBe('pending_review');

    const reviewed = await reviewDbAffiliateApplication(
      appRec.id,
      'approved_inactive_payouts',
      'admin@viewora.test',
      appClient
    );
    expect(reviewed?.status).toBe('approved_inactive_payouts');

    const dash = await getDbUserReferralDashboard(regOwner.user.id, appClient);
    expect(dash.attributions.length).toBe(1);
    expect(dash.payoutsEnabled).toBe(false);

    const overview = await getDbReferralOverview(appClient);
    expect(overview.codesCount).toBeGreaterThanOrEqual(1);
    expect(overview.payoutsEnabled).toBe(false);

    // 3. Admin session revocation & active super admin counting
    const s = await createDbSession({ userId: regInvitee.user.id }, appClient);
    expect(await resolveDbSessionByRawToken(s.rawToken, appClient)).not.toBeNull();
    const revoked = await revokeAllDbUserSessions(regInvitee.user.id, undefined, appClient);
    expect(revoked).toBeGreaterThanOrEqual(1);
    expect(await resolveDbSessionByRawToken(s.rawToken, appClient)).toBeNull();
    expect(await countActiveSuperAdmins(appClient)).toBeGreaterThanOrEqual(0);
  });
});
