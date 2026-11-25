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
  loadDbUserWorkspaceState,
  persistDbCreateComparison,
  persistDbCreateFolder,
  persistDbMarkNotificationRead,
  persistDbProfileMetaUpdate,
  persistDbRemoveProfile,
  persistDbSavedProfile,
  QuotaExceededError,
  readDbPrivateProfileNotes,
  WorkspaceAuthorizationError,
} from '@/lib/db/repositories/workspace.repo';
import {
  loadDbSupportTickets,
  persistDbFeatureFlagToggle,
  persistDbSupportTicketCreate,
} from '@/lib/db/repositories/admin.repo';
import { withUserRlsContext } from '@/lib/db/prisma';
import type { SavedProfileRecord } from '@/lib/dashboard/store';

/**
 * MANDATORY LIVE POSTGRESQL INTEGRATION TEST SUITE (Task 10)
 *
 * This suite NEVER skips when PostgreSQL is unavailable.
 * A disconnected or unconfigured test database MUST fail this verification gate.
 *
 * Required environment variables:
 *   - TEST_DATABASE_URL: PostgreSQL connection for `viewora_test` (admin/migration role)
 *   - TEST_DATABASE_APP_URL (optional): restricted `viewora_app` (`NOBYPASSRLS`) role URL
 *     for verifying native PostgreSQL RLS enforcement under non-superuser credentials.
 */
const ADMIN_TEST_URL = (process.env.TEST_DATABASE_URL || '').trim();
const APP_TEST_URL = (process.env.TEST_DATABASE_APP_URL || ADMIN_TEST_URL).trim();

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
      await adminClient.$disconnect();
    }
    if (appClient) {
      await appClient.$disconnect();
    }
  });

  it('verifies schema tables, RLS policies, and restricted runtime role permissions', async () => {
    const tables = await adminClient.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const names = new Set(tables.map((t) => t.tablename));
    for (const required of [
      'users',
      'sessions',
      'user_preferences',
      'workspaces',
      'workspace_members',
      'research_folders',
      'saved_profiles',
      'profile_research_notes',
      'comparison_projects',
      'notifications',
      'plans',
      'plan_entitlements',
      'subscriptions',
      'feature_flags',
      'support_tickets',
      'audit_logs',
    ]) {
      expect(names.has(required)).toBe(true);
    }

    const rlsPolicies = await adminClient.$queryRaw<Array<{ tablename: string; policyname: string }>>`
      SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
    `;
    expect(rlsPolicies.length).toBeGreaterThanOrEqual(15);

    if (process.env.TEST_DATABASE_APP_URL) {
      const roleInfo = await appClient.$queryRaw<
        Array<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>
      >`
        SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
      `;
      expect(roleInfo[0]?.rolsuper).toBe(false);
      expect(roleInfo[0]?.rolbypassrls).toBe(false);
    }
  });

  it('enforces transaction rollback, duplicate email prevention, and foreign-key constraints', async () => {
    const email = `rollback-${randomUUID().slice(0, 8)}@viewora.test`;

    // Transaction rollback
    await expect(
      appClient.$transaction(async (tx) => {
        await tx.user.create({
          data: { email, fullName: 'Will Rollback', role: 'user', segment: 'personal' },
        });
        throw new Error('Intentional rollback verification');
      })
    ).rejects.toThrow('Intentional rollback verification');

    const afterRollback = await appClient.user.findUnique({ where: { email } });
    expect(afterRollback).toBeNull();

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

    // Duplicate email rejection
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

  it('verifies RLS isolation, workspace access, private notes protection, and concurrent quota enforcement under viewora_app', async () => {
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

    // Customer A saves profile preferences, folder, saved profile + private note, comparison
    const prefsA = await saveDbProfilePrefs(
      regA.user.id,
      {
        fullName: 'Customer Alpha Updated',
        professionalTitle: 'Head of Social Intelligence',
        coverPreset: 'emerald',
        avatarPreset: 'emerald-teal',
      },
      appClient
    );
    expect(prefsA.coverPreset).toBe('emerald');

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

    // Mark notification read
    const notifId = wsA.notifications[0]!.id;
    const afterRead = await persistDbMarkNotificationRead(
      regA.user.id,
      notifId,
      true,
      'Personal Workspace',
      appClient
    );
    expect(afterRead.notifications.find((n) => n.id === notifId)?.read).toBe(true);

    // Cross-account isolation via repository AND raw PostgreSQL RLS under viewora_app
    const wsB = await loadDbUserWorkspaceState(regB.user.id, 'Personal Workspace', appClient);
    expect(wsB.savedProfiles).toHaveLength(0);
    expect(wsB.comparisons).toHaveLength(0);

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

    // Even a super_admin RLS context MUST NOT read Customer A's private research notes
    if (process.env.TEST_DATABASE_APP_URL) {
      const adminReadPrivateNotes = await withUserRlsContext(
        { userId: regB.user.id, role: 'super_admin' },
        (tx) => tx.profileResearchNote.findMany({ where: { savedProfileId: savedProfile.id } }),
        appClient
      );
      expect(adminReadPrivateNotes).toHaveLength(0);
    }

    // Concurrent quota enforcement on Customer B (limit = 1): 4 concurrent writes -> strictly 1 wins!
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

    const fulfilled = raceResults.filter((r) => r.status === 'fulfilled');
    const quotaRejected = raceResults.filter(
      (r) => r.status === 'rejected' && r.reason instanceof QuotaExceededError
    );
    expect(fulfilled).toHaveLength(1);
    expect(quotaRejected).toHaveLength(3);

    // Persistence verification across fresh PrismaClient connection
    const freshClient = new PrismaClient({ datasources: { db: { url: APP_TEST_URL } } });
    try {
      const reloadedPrefs = await getDbProfilePrefs(regA.user.id, freshClient);
      expect(reloadedPrefs.coverPreset).toBe('emerald');
      const reloadedWs = await loadDbUserWorkspaceState(regA.user.id, 'Personal Workspace', freshClient);
      expect(reloadedWs.savedProfiles.some((p) => p.username === 'alpha.target')).toBe(true);
    } finally {
      await freshClient.$disconnect();
    }
  });

  it('verifies session expiration, revocation, password change/reset, suspension, role removal, support RLS, payments lock, and account deletion', async () => {
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
    const pwRes = await changeDbUserPassword(
      {
        userId: reg.user.id,
        currentPassword: 'LifecyclePass!2026',
        newPassword: 'ChangedPass!2026',
        keepCurrentSessionRawToken: keepSess.rawToken,
      },
      appClient
    );
    expect(pwRes.ok).toBe(true);
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
    await persistDbAdminUserUpdate(reg.user.id, { role: 'admin' }, appClient);
    expect((await resolveDbSessionByRawToken(roleSess.rawToken, appClient))?.role).toBe('admin');
    await persistDbAdminUserUpdate(reg.user.id, { role: 'user' }, appClient);
    expect((await resolveDbSessionByRawToken(roleSess.rawToken, appClient))?.role).toBe('user');

    // Support ticket creation & RLS visibility for support_agent
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
    const supportQueue = await loadDbSupportTickets(appClient, { role: 'support_agent' });
    expect(supportQueue.some((t) => t.id === ticket.id)).toBe(true);

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
});
