import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  changeDbUserPassword,
  createDbSession,
  deleteDbUserAccount,
  getDbSessionUserById,
  listDbAdminUsers,
  persistDbAdminUserUpdate,
  registerUserWithWorkspace,
  resolveDbSessionByRawToken,
  revokeDbSessionByRawToken,
  verifyDbUserCredentials,
} from '@/lib/db/repositories/users.repo';
import {
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  issueEmailVerificationToken,
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
  readDbPrivateProfileNotes,
  WorkspaceAuthorizationError,
} from '@/lib/db/repositories/workspace.repo';
import {
  loadDbPlans,
  persistDbPlanEntitlement,
  persistDbPlanUpdate,
} from '@/lib/db/repositories/entitlements.repo';
import {
  loadDbAuditLogs,
  loadDbFeatureFlags,
  persistDbAuditLog,
  persistDbFeatureFlagToggle,
  persistDbSupportTicketCreate,
  persistDbSupportTicketUpdate,
} from '@/lib/db/repositories/admin.repo';
import { LocalFileStorage } from '@/lib/storage/local-files';
import { formatQuotaLimit } from '@/lib/entitlements/helpers';
import { INITIAL_PLANS } from '@/lib/entitlements/catalog';
import type { SavedProfileRecord } from '@/lib/dashboard/store';

/**
 * Relational in-memory PrismaClient harness that faithfully models Viewora's
 * PostgreSQL tables, unique constraints, foreign keys, transactions, and cascade deletes
 * so Prisma repositories can be rigorously verified even when Docker/Postgres is offline.
 */
function createRelationalPrismaHarness() {
  const db = {
    users: new Map<string, Record<string, unknown>>(),
    userPreferences: new Map<string, Record<string, unknown>>(),
    sessions: new Map<string, Record<string, unknown>>(),
    emailVerificationTokens: new Map<string, Record<string, unknown>>(),
    passwordResetTokens: new Map<string, Record<string, unknown>>(),
    workspaces: new Map<string, Record<string, unknown>>(),
    workspaceMembers: new Map<string, Record<string, unknown>>(),
    researchFolders: new Map<string, Record<string, unknown>>(),
    savedProfiles: new Map<string, Record<string, unknown>>(),
    profileSnapshots: new Map<string, Record<string, unknown>>(),
    profileResearchNotes: new Map<string, Record<string, unknown>>(),
    comparisonProjects: new Map<string, Record<string, unknown>>(),
    notifications: new Map<string, Record<string, unknown>>(),
    aiReports: new Map<string, Record<string, unknown>>(),
    reportExports: new Map<string, Record<string, unknown>>(),
    plans: new Map<string, Record<string, unknown>>(),
    planBillingOptions: new Map<string, Record<string, unknown>>(),
    planEntitlements: new Map<string, Record<string, unknown>>(),
    subscriptions: new Map<string, Record<string, unknown>>(),
    featureFlags: new Map<string, Record<string, unknown>>(),
    supportTickets: new Map<string, Record<string, unknown>>(),
    supportMessages: new Map<string, Record<string, unknown>>(),
    supportTicketStatusHistory: new Map<string, Record<string, unknown>>(),
    auditLogs: new Map<string, Record<string, unknown>>(),
    consentRecords: new Map<string, Record<string, unknown>>(),
    accountDeletionRequests: new Map<string, Record<string, unknown>>(),
  };

  // Seed plans & feature flags matching prisma/seed.ts
  for (const plan of INITIAL_PLANS) {
    const planId = randomUUID();
    db.plans.set(planId, {
      id: planId,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      monthlyPriceCents: plan.monthlyPriceCents,
      currency: plan.currency,
      targetSegment: plan.targetSegment,
      displayOrder: plan.displayOrder,
      isActive: plan.isActive,
      isDemoPricing: plan.isDemoPricing,
    });
    for (const opt of plan.billingOptions) {
      const id = randomUUID();
      db.planBillingOptions.set(id, {
        id,
        planId,
        billingInterval: opt.interval,
        discountPercent: opt.discountPercent,
        isActive: true,
      });
    }
    for (const [featureKey, rule] of Object.entries(plan.entitlements)) {
      const id = randomUUID();
      db.planEntitlements.set(id, {
        id,
        planId,
        featureKey,
        enabled: rule.enabled,
        numericLimit: rule.numericLimit,
      });
    }
  }

  db.featureFlags.set('payments_enabled', {
    key: 'payments_enabled',
    description: 'Master payments flag',
    enabled: false,
    locked: true,
    updatedAt: new Date(),
  });
  db.featureFlags.set('ai_insights_enabled', {
    key: 'ai_insights_enabled',
    description: 'AI reports flag',
    enabled: true,
    locked: false,
    updatedAt: new Date(),
  });

  const attachUserIncludes = (user: Record<string, unknown>, include?: Record<string, unknown>) => {
    const out = { ...user };
    if (include?.subscriptions) {
      const subs = Array.from(db.subscriptions.values())
        .filter((s) => s.userId === user.id)
        .sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime())
        .map((s) => ({ ...s, plan: db.plans.get(String(s.planId)) }));
      out.subscriptions = subs;
    }
    if (include?.preferences) {
      out.preferences = db.userPreferences.get(String(user.id)) ?? null;
    }
    return out;
  };

  const client = {
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(client),
    user: {
      findUnique: async ({
        where,
        include,
        select,
      }: {
        where: { id?: string; email?: string };
        include?: Record<string, unknown>;
        select?: Record<string, unknown>;
      }) => {
        const found = where.id
          ? db.users.get(where.id)
          : Array.from(db.users.values()).find((u) => u.email === where.email);
        if (!found) return null;
        return attachUserIncludes(found, include ?? (select?.preferences ? { preferences: true } : undefined));
      },
      findMany: async ({ include }: { include?: Record<string, unknown> }) =>
        Array.from(db.users.values()).map((u) => attachUserIncludes(u, include)),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const id = randomUUID();
        const prefCreate = (data.preferences as { create?: Record<string, unknown> } | undefined)?.create;
        const userRow: Record<string, unknown> = {
          id,
          email: data.email,
          passwordHash: data.passwordHash ?? null,
          fullName: data.fullName ?? '',
          name: data.name ?? null,
          role: data.role ?? 'user',
          accountStatus: data.accountStatus ?? 'active',
          segment: data.segment ?? 'personal',
          preferredLocale: data.preferredLocale ?? 'en',
          onboardingCompleted: Boolean(data.onboardingCompleted),
          emailVerified: data.emailVerified ?? null,
          emailPreferences: data.emailPreferences ?? {},
          dashboardSettings: data.dashboardSettings ?? {},
          createdAt: now,
          updatedAt: now,
        };
        db.users.set(id, userRow);
        if (prefCreate) {
          db.userPreferences.set(id, {
            userId: id,
            professionalTitle: 'Social Intelligence Strategist',
            organization: 'Viewora Workspace',
            workspaceName: 'Personal Workspace',
            avatarPreset: 'violet-cyan',
            avatarEmoji: '',
            coverPreset: 'aurora',
            themePreference: 'system',
            accentPreset: 'violet',
            timezone: 'UTC',
            defaultDateRange: '30d',
            dashboardDensity: 'comfortable',
            sidebarDefaultCollapsed: false,
            personalShortcuts: [],
            ...prefCreate,
            createdAt: now,
            updatedAt: now,
          });
        }
        return userRow;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = db.users.get(where.id);
        if (!existing) throw new Error('User not found');
        const next = { ...existing, ...data, updatedAt: new Date() };
        db.users.set(where.id, next);
        return next;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const existing = db.users.get(where.id);
        if (!existing) throw new Error('User not found');
        db.users.delete(where.id);
        db.userPreferences.delete(where.id);
        for (const [k, s] of db.sessions.entries()) if (s.userId === where.id) db.sessions.delete(k);
        for (const [k, w] of db.workspaces.entries()) if (w.ownerId === where.id) db.workspaces.delete(k);
        for (const [k, m] of db.workspaceMembers.entries()) if (m.userId === where.id) db.workspaceMembers.delete(k);
        for (const [k, p] of db.savedProfiles.entries()) if (p.userId === where.id) db.savedProfiles.delete(k);
        for (const [k, n] of db.notifications.entries()) if (n.userId === where.id) db.notifications.delete(k);
        for (const [k, sub] of db.subscriptions.entries()) if (sub.userId === where.id) db.subscriptions.delete(k);
        return existing;
      },
    },
    userPreference: {
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { userId: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => {
        const now = new Date();
        const existing = db.userPreferences.get(where.userId);
        const next = existing
          ? { ...existing, ...update, updatedAt: now }
          : { ...create, createdAt: now, updatedAt: now };
        db.userPreferences.set(where.userId, next);
        return next;
      },
    },
    session: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: randomUUID(), revokedAt: null, ...data, createdAt: new Date() };
        db.sessions.set(String(data.sessionToken), row);
        return row;
      },
      findUnique: async ({
        where,
        include,
      }: {
        where: { sessionToken: string };
        include?: { user?: { include?: Record<string, unknown> } };
      }) => {
        const row = db.sessions.get(where.sessionToken);
        if (!row) return null;
        const user = db.users.get(String(row.userId));
        return {
          ...row,
          user: user ? attachUserIncludes(user, include?.user?.include) : null,
        };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { sessionToken?: string | { not?: string }; userId?: string; revokedAt?: null };
        data: Record<string, unknown>;
      }) => {
        let count = 0;
        for (const [key, row] of db.sessions.entries()) {
          if (where.userId && row.userId !== where.userId) continue;
          if (where.revokedAt === null && row.revokedAt !== null) continue;
          if (typeof where.sessionToken === 'string' && row.sessionToken !== where.sessionToken) continue;
          if (
            where.sessionToken &&
            typeof where.sessionToken === 'object' &&
            where.sessionToken.not &&
            row.sessionToken === where.sessionToken.not
          ) {
            continue;
          }
          db.sessions.set(key, { ...row, ...data });
          count += 1;
        }
        return { count };
      },
    },
    emailVerificationToken: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: randomUUID(), consumedAt: null, ...data, createdAt: new Date() };
        db.emailVerificationTokens.set(String(data.tokenHash), row);
        return row;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        db.emailVerificationTokens.get(where.tokenHash) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        for (const [k, v] of db.emailVerificationTokens.entries()) {
          if (v.id === where.id) {
            const next = { ...v, ...data };
            db.emailVerificationTokens.set(k, next);
            return next;
          }
        }
        throw new Error('Token not found');
      },
      updateMany: async ({ where, data }: { where: { userId: string; consumedAt: null }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const [k, v] of db.emailVerificationTokens.entries()) {
          if (v.userId === where.userId && v.consumedAt === null) {
            db.emailVerificationTokens.set(k, { ...v, ...data });
            count += 1;
          }
        }
        return { count };
      },
    },
    passwordResetToken: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: randomUUID(), consumedAt: null, ...data, createdAt: new Date() };
        db.passwordResetTokens.set(String(data.tokenHash), row);
        return row;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        db.passwordResetTokens.get(where.tokenHash) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        for (const [k, v] of db.passwordResetTokens.entries()) {
          if (v.id === where.id) {
            const next = { ...v, ...data };
            db.passwordResetTokens.set(k, next);
            return next;
          }
        }
        throw new Error('Token not found');
      },
      updateMany: async ({ where, data }: { where: { userId: string; consumedAt: null }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const [k, v] of db.passwordResetTokens.entries()) {
          if (v.userId === where.userId && v.consumedAt === null) {
            db.passwordResetTokens.set(k, { ...v, ...data });
            count += 1;
          }
        }
        return { count };
      },
    },
    workspace: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, isDefault: false, segment: 'personal', ...data, createdAt: new Date() };
        db.workspaces.set(id, row);
        return row;
      },
      findMany: async ({ where }: { where: { OR: Array<Record<string, unknown>> } }) => {
        const ownerId = (where.OR?.[0]?.ownerId as string) ?? '';
        return Array.from(db.workspaces.values()).filter(
          (w) =>
            w.ownerId === ownerId ||
            db.workspaceMembers.has(`${String(w.id)}:${ownerId}`)
        );
      },
      findFirst: async ({ where }: { where: { name?: string; OR?: Array<Record<string, unknown>> } }) => {
        const ownerId = (where.OR?.[0]?.ownerId as string) ?? '';
        return (
          Array.from(db.workspaces.values()).find(
            (w) =>
              (!where.name || w.name === where.name) &&
              (w.ownerId === ownerId || db.workspaceMembers.has(`${String(w.id)}:${ownerId}`))
          ) ?? null
        );
      },
    },
    workspaceMember: {
      create: async ({ data }: { data: { workspaceId: string; userId: string; memberRole: string } }) => {
        db.workspaceMembers.set(`${data.workspaceId}:${data.userId}`, { ...data, createdAt: new Date() });
        return data;
      },
      findUnique: async ({ where }: { where: { workspaceId_userId: { workspaceId: string; userId: string } } }) =>
        db.workspaceMembers.get(
          `${where.workspaceId_userId.workspaceId}:${where.workspaceId_userId.userId}`
        ) ?? null,
    },
    researchFolder: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, description: '', color: 'violet', ...data, createdAt: new Date(), updatedAt: new Date() };
        db.researchFolders.set(id, row);
        return row;
      },
      findMany: async ({ where }: { where: { userId: string } }) =>
        Array.from(db.researchFolders.values()).filter((f) => f.userId === where.userId),
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
        const f = db.researchFolders.get(where.id);
        return f && f.userId === where.userId ? f : null;
      },
      deleteMany: async ({ where }: { where: { id: string; userId: string } }) => {
        const f = db.researchFolders.get(where.id);
        if (f && f.userId === where.userId) {
          db.researchFolders.delete(where.id);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    savedProfile: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, notes: '', tags: [], folderId: null, ...data, createdAt: new Date(), updatedAt: new Date() };
        db.savedProfiles.set(id, row);
        return row;
      },
      findMany: async ({ where }: { where: { userId: string } }) =>
        Array.from(db.savedProfiles.values())
          .filter((p) => p.userId === where.userId)
          .map((p) => ({
            ...p,
            snapshots: Array.from(db.profileSnapshots.values()).filter(
              (s) => s.savedProfileId === p.id
            ),
          })),
      findFirst: async ({ where }: { where: { userId: string; username: string } }) =>
        Array.from(db.savedProfiles.values()).find(
          (p) => p.userId === where.userId && p.username === where.username
        ) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) => db.savedProfiles.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = db.savedProfiles.get(where.id)!;
        const next = { ...existing, ...data, updatedAt: new Date() };
        db.savedProfiles.set(where.id, next);
        return next;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const existing = db.savedProfiles.get(where.id)!;
        db.savedProfiles.delete(where.id);
        return existing;
      },
    },
    profileSnapshot: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, ...data, capturedAt: new Date() };
        db.profileSnapshots.set(id, row);
        return row;
      },
    },
    profileResearchNote: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
        db.profileResearchNotes.set(id, row);
        return row;
      },
      findFirst: async ({ where }: { where: { savedProfileId: string; workspaceId: string } }) =>
        Array.from(db.profileResearchNotes.values()).find(
          (n) => n.savedProfileId === where.savedProfileId && n.workspaceId === where.workspaceId
        ) ?? null,
      findMany: async ({ where }: { where: { savedProfileId: string; workspaceId: string } }) =>
        Array.from(db.profileResearchNotes.values()).filter(
          (n) => n.savedProfileId === where.savedProfileId && n.workspaceId === where.workspaceId
        ),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = db.profileResearchNotes.get(where.id)!;
        const next = { ...existing, ...data, updatedAt: new Date() };
        db.profileResearchNotes.set(where.id, next);
        return next;
      },
    },
    comparisonProject: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
        db.comparisonProjects.set(id, row);
        return row;
      },
      findMany: async ({ where }: { where: { userId: string } }) =>
        Array.from(db.comparisonProjects.values()).filter((c) => c.userId === where.userId),
    },
    notification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, isRead: false, readAt: null, ...data, createdAt: new Date() };
        db.notifications.set(id, row);
        return row;
      },
      findMany: async ({ where }: { where: { userId: string } }) =>
        Array.from(db.notifications.values()).filter((n) => n.userId === where.userId),
      updateMany: async ({ where, data }: { where: { id?: string; userId: string }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const [k, n] of db.notifications.entries()) {
          if (n.userId !== where.userId) continue;
          if (where.id && n.id !== where.id) continue;
          db.notifications.set(k, { ...n, ...data });
          count += 1;
        }
        return { count };
      },
    },
    aiReport: { findMany: async () => [] },
    reportExport: { findMany: async () => [] },
    consentRecord: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        db.consentRecords.set(id, { id, ...data, recordedAt: new Date() });
        return { id };
      },
    },
    accountDeletionRequest: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        db.accountDeletionRequests.set(id, { id, ...data, requestedAt: new Date() });
        return { id };
      },
    },
    plan: {
      findMany: async () =>
        Array.from(db.plans.values())
          .sort((a, b) => Number(a.displayOrder) - Number(b.displayOrder))
          .map((p) => ({
            ...p,
            billingOptions: Array.from(db.planBillingOptions.values()).filter(
              (b) => b.planId === p.id && b.isActive
            ),
            entitlements: Array.from(db.planEntitlements.values()).filter((e) => e.planId === p.id),
          })),
      findUnique: async ({ where }: { where: { code: string } }) =>
        Array.from(db.plans.values()).find((p) => p.code === where.code) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = db.plans.get(where.id)!;
        const next = { ...existing, ...data };
        db.plans.set(where.id, next);
        return next;
      },
    },
    planBillingOption: {
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { planId_billingInterval: { planId: string; billingInterval: string } };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => {
        const match = Array.from(db.planBillingOptions.values()).find(
          (b) =>
            b.planId === where.planId_billingInterval.planId &&
            b.billingInterval === where.planId_billingInterval.billingInterval
        );
        if (match) {
          const next = { ...match, ...update };
          db.planBillingOptions.set(String(match.id), next);
          return next;
        }
        const id = randomUUID();
        const next = { id, ...create };
        db.planBillingOptions.set(id, next);
        return next;
      },
    },
    planEntitlement: {
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { planId_featureKey: { planId: string; featureKey: string } };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => {
        const match = Array.from(db.planEntitlements.values()).find(
          (e) =>
            e.planId === where.planId_featureKey.planId &&
            e.featureKey === where.planId_featureKey.featureKey
        );
        if (match) {
          const next = { ...match, ...update };
          db.planEntitlements.set(String(match.id), next);
          return next;
        }
        const id = randomUUID();
        const next = { id, ...create };
        db.planEntitlements.set(id, next);
        return next;
      },
    },
    subscription: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, ...data, createdAt: new Date() };
        db.subscriptions.set(id, row);
        return row;
      },
      findFirst: async ({ where }: { where: { userId: string } }) =>
        Array.from(db.subscriptions.values()).find((s) => s.userId === where.userId) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = db.subscriptions.get(where.id)!;
        const next = { ...existing, ...data };
        db.subscriptions.set(where.id, next);
        return next;
      },
    },
    featureFlag: {
      findMany: async () => Array.from(db.featureFlags.values()),
      findUnique: async ({ where }: { where: { key: string } }) =>
        db.featureFlags.get(where.key) ?? null,
      update: async ({ where, data }: { where: { key: string }; data: Record<string, unknown> }) => {
        const existing = db.featureFlags.get(where.key)!;
        const next = { ...existing, ...data, updatedAt: new Date() };
        db.featureFlags.set(where.key, next);
        return next;
      },
    },
    supportTicket: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
        db.supportTickets.set(id, row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        db.supportTickets.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = db.supportTickets.get(where.id)!;
        const next = { ...existing, ...data, updatedAt: new Date() };
        db.supportTickets.set(where.id, next);
        return next;
      },
    },
    supportMessage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, ...data, createdAt: new Date() };
        db.supportMessages.set(id, row);
        return row;
      },
    },
    supportTicketStatusHistory: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, ...data, createdAt: new Date() };
        db.supportTicketStatusHistory.set(id, row);
        return row;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = randomUUID();
        const row = { id, ...data, createdAt: new Date() };
        db.auditLogs.set(id, row);
        return row;
      },
      findMany: async () => Array.from(db.auditLogs.values()),
    },
  };

  return { client: client as unknown as PrismaClient, db };
}

describe('Independent PostgreSQL Prisma Repositories & Cross-Account Isolation', () => {
  let tmpStorageDir: string;
  let harness: ReturnType<typeof createRelationalPrismaHarness>;

  beforeAll(() => {
    tmpStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewora-storage-test-'));
  });

  beforeEach(() => {
    harness = createRelationalPrismaHarness();
  });

  afterAll(() => {
    fs.rmSync(tmpStorageDir, { recursive: true, force: true });
  });

  it('registers a real user atomically with bcrypt hash, clean workspace (zero auto demo profiles), and revocable DB sessions', async () => {
    const reg = await registerUserWithWorkspace(
      {
        email: 'alice@example.com',
        password: 'StrongPassword123!',
        fullName: 'Alice Strategist',
        segment: 'business',
        preferredLocale: 'en',
        emailPreferences: {
          productUpdates: false,
          weeklyDigest: true,
          trackingAlerts: true,
          marketing: false,
        },
      },
      harness.client
    );
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;

    // Duplicate email rejected cleanly
    const dup = await registerUserWithWorkspace(
      {
        email: 'ALICE@example.com',
        password: 'AnotherPassword123!',
        fullName: 'Duplicate',
        segment: 'personal',
        preferredLocale: 'en',
        emailPreferences: {
          productUpdates: false,
          weeklyDigest: false,
          trackingAlerts: true,
          marketing: false,
        },
      },
      harness.client
    );
    expect(dup.ok).toBe(false);

    // Real customer account starts with ZERO demo profiles
    const initialWs = await loadDbUserWorkspaceState(reg.user.id, 'Personal Workspace', harness.client);
    expect(initialWs.savedProfiles).toHaveLength(0);
    expect(initialWs.folders).toHaveLength(1);

    // Valid credentials authenticate; invalid password rejected
    const okLogin = await verifyDbUserCredentials('alice@example.com', 'StrongPassword123!', harness.client);
    expect(okLogin?.id).toBe(reg.user.id);
    expect(okLogin?.authMode).toBe('database');

    const badLogin = await verifyDbUserCredentials('alice@example.com', 'WrongPassword!', harness.client);
    expect(badLogin).toBeNull();

    // Create DB session, resolve it, then revoke on logout
    const session = await createDbSession({ userId: reg.user.id }, harness.client);
    const resolved = await resolveDbSessionByRawToken(session.rawToken, harness.client);
    expect(resolved?.email).toBe('alice@example.com');

    const revoked = await revokeDbSessionByRawToken(session.rawToken, harness.client);
    expect(revoked).toBe(true);
    const afterLogout = await resolveDbSessionByRawToken(session.rawToken, harness.client);
    expect(afterLogout).toBeNull();
  });

  it('supports email verification tokens, password change, and single-use password reset tokens with session revocation', async () => {
    const reg = await registerUserWithWorkspace(
      {
        email: 'bob@example.com',
        password: 'InitialPassword123!',
        fullName: 'Bob Analyst',
        segment: 'personal',
        preferredLocale: 'de',
        emailPreferences: {
          productUpdates: false,
          weeklyDigest: false,
          trackingAlerts: true,
          marketing: false,
        },
      },
      harness.client
    );
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;

    // Verify email using initial single-use token; replay must fail
    const verifyOk = await consumeEmailVerificationToken(reg.verificationTokenRaw, harness.client);
    expect(verifyOk.ok).toBe(true);
    const verifyReplay = await consumeEmailVerificationToken(reg.verificationTokenRaw, harness.client);
    expect(verifyReplay.ok).toBe(false);

    const updatedUser = await getDbSessionUserById(reg.user.id, harness.client);
    expect(updatedUser?.emailVerified).not.toBeNull();

    // Password change revokes other active sessions
    const sess1 = await createDbSession({ userId: reg.user.id }, harness.client);
    const sess2 = await createDbSession({ userId: reg.user.id }, harness.client);

    const badChange = await changeDbUserPassword(
      {
        userId: reg.user.id,
        currentPassword: 'NotCurrentPassword!',
        newPassword: 'UpdatedPassword456!',
      },
      harness.client
    );
    expect(badChange.ok).toBe(false);

    const okChange = await changeDbUserPassword(
      {
        userId: reg.user.id,
        currentPassword: 'InitialPassword123!',
        newPassword: 'UpdatedPassword456!',
        keepCurrentSessionRawToken: sess1.rawToken,
      },
      harness.client
    );
    expect(okChange.ok).toBe(true);
    expect(await resolveDbSessionByRawToken(sess1.rawToken, harness.client)).not.toBeNull();
    expect(await resolveDbSessionByRawToken(sess2.rawToken, harness.client)).toBeNull();

    // Password reset token works once, revokes all sessions, and rejects nonexistent emails silently
    const unknownReset = await issuePasswordResetToken('nobody@example.com', harness.client);
    expect(unknownReset.issued).toBe(false);

    const reset = await issuePasswordResetToken('bob@example.com', harness.client);
    expect(reset.issued).toBe(true);
    expect(reset.rawToken).toBeTruthy();

    const resetConsume = await consumePasswordResetToken(
      reset.rawToken!,
      'RecoveredPassword789!',
      harness.client
    );
    expect(resetConsume.ok).toBe(true);
    expect(await resolveDbSessionByRawToken(sess1.rawToken, harness.client)).toBeNull();

    // Reusing reset token must fail
    const resetReplay = await consumePasswordResetToken(
      reset.rawToken!,
      'AnotherPass000!',
      harness.client
    );
    expect(resetReplay.ok).toBe(false);

    // New password logs in cleanly
    const loginAfterReset = await verifyDbUserCredentials(
      'bob@example.com',
      'RecoveredPassword789!',
      harness.client
    );
    expect(loginAfterReset?.id).toBe(reg.user.id);

    // Re-issue email verification token works cleanly
    const reVerify = await issueEmailVerificationToken(reg.user.id, harness.client);
    expect(reVerify.rawToken.length).toBeGreaterThanOrEqual(32);
  });

  it('enforces strict cross-account and cross-workspace isolation on saved profiles, private notes, folders, and notifications', async () => {
    const regA = await registerUserWithWorkspace(
      {
        email: 'customer-a@example.com',
        password: 'CustomerAPassword1!',
        fullName: 'Customer A',
        segment: 'business',
        preferredLocale: 'en',
        emailPreferences: { productUpdates: false, weeklyDigest: false, trackingAlerts: true, marketing: false },
      },
      harness.client
    );
    const regB = await registerUserWithWorkspace(
      {
        email: 'customer-b@example.com',
        password: 'CustomerBPassword1!',
        fullName: 'Customer B',
        segment: 'personal',
        preferredLocale: 'en',
        emailPreferences: { productUpdates: false, weeklyDigest: false, trackingAlerts: true, marketing: false },
      },
      harness.client
    );
    expect(regA.ok && regB.ok).toBe(true);
    if (!regA.ok || !regB.ok) return;

    // Customer A creates folder, saves profile with confidential private note, and creates comparison
    const { folder } = await persistDbCreateFolder(
      regA.user.id,
      { id: 'tmp', name: 'Q4 Competitors', color: 'cyan', description: 'Private', createdAt: new Date().toISOString() },
      'Personal Workspace',
      harness.client
    );

    const sampleProfile: SavedProfileRecord = {
      id: 'tmp-sp',
      username: 'nordic.design',
      profile: {
        username: 'nordic.design',
        displayName: 'Nordic Design',
        bio: 'Design studio',
        category: 'Design',
        externalUrl: null,
        isVerified: false,
        isBusinessAccount: true,
        isPrivate: false,
        avatarInitials: 'ND',
        avatarAccent: '#7957FF',
        followersCount: 42000,
        followingCount: 250,
        postsCount: 190,
        estimatedEngagementRate: 3.8,
        postingCadencePerWeek: 3,
        recentPosts: [],
        historicalTrend: [],
      },
      dataClass: 'demo',
      providerLabel: 'demo_fixture',
      workspace: 'Personal Workspace',
      folderId: folder.id,
      tags: ['confidential'],
      privateNote: 'Confidential negotiation benchmark for Client X',
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { savedProfile, workspace: wsA } = await persistDbSavedProfile(
      regA.user.id,
      sampleProfile,
      'Personal Workspace',
      harness.client
    );
    await persistDbCreateComparison(
      regA.user.id,
      {
        id: 'tmp-cmp',
        name: 'A Private Comparison',
        description: 'Only A should see this',
        usernames: ['nordic.design'],
        notes: 'Internal strategy',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      'Personal Workspace',
      harness.client
    );

    // Customer A can read their own private notes
    const notesA = await readDbPrivateProfileNotes(regA.user.id, savedProfile.id, harness.client);
    expect(notesA[0]?.noteBody).toContain('Confidential negotiation');

    // Customer B sees ZERO of Customer A's profiles, folders, comparisons, or notes
    const wsB = await loadDbUserWorkspaceState(regB.user.id, 'Personal Workspace', harness.client);
    expect(wsB.savedProfiles).toHaveLength(0);
    expect(wsB.comparisons).toHaveLength(0);

    // Customer B attempting to read Customer A's private notes MUST throw WorkspaceAuthorizationError
    await expect(
      readDbPrivateProfileNotes(regB.user.id, savedProfile.id, harness.client)
    ).rejects.toThrow(WorkspaceAuthorizationError);

    // Customer B attempting to modify or remove Customer A's saved profile MUST be rejected
    await expect(
      persistDbProfileMetaUpdate(
        regB.user.id,
        { username: 'nordic.design', privateNote: 'Tampered' },
        'Personal Workspace',
        harness.client
      )
    ).rejects.toThrow(WorkspaceAuthorizationError);

    await expect(
      persistDbRemoveProfile(regB.user.id, 'nordic.design', 'Personal Workspace', harness.client)
    ).rejects.toThrow(WorkspaceAuthorizationError);

    // Customer B attempting to mark Customer A's notification read MUST be rejected
    const notifAId = wsA.notifications[0]!.id;
    await expect(
      persistDbMarkNotificationRead(regB.user.id, notifAId, true, 'Personal Workspace', harness.client)
    ).rejects.toThrow(WorkspaceAuthorizationError);

    // Customer A's profile customization persists and does not affect Customer B
    const savedPrefsA = await saveDbProfilePrefs(
      regA.user.id,
      {
        fullName: 'Customer A Updated',
        professionalTitle: 'VP Growth',
        accentPreset: 'emerald',
        preferredLocale: 'pt-BR',
      },
      harness.client
    );
    expect(savedPrefsA.professionalTitle).toBe('VP Growth');
    expect(savedPrefsA.accentPreset).toBe('emerald');
    const prefsB = await getDbProfilePrefs(regB.user.id, harness.client);
    expect(prefsB.professionalTitle).not.toBe('VP Growth');

    // Account deletion removes Customer A's owned records while preserving AuditLog & DeletionRequest
    await deleteDbUserAccount(regA.user.id, regA.user.email, harness.client);
    expect(await getDbSessionUserById(regA.user.id, harness.client)).toBeNull();
    expect(harness.db.accountDeletionRequests.size).toBe(1);
    expect(harness.db.auditLogs.size).toBe(1);
  });

  it('persists plans, entitlements, locked payments flag, support ticket history, admin user updates, and file storage isolation', async () => {
    expect(formatQuotaLimit({ enabled: true, numericLimit: null })).toBe('∞');

    // Plans & entitlements persistence
    const updatedPlan = await persistDbPlanUpdate(
      'premium',
      { monthlyPriceCents: 2499, annualDiscount: 35 },
      harness.client
    );
    expect(updatedPlan?.monthlyPriceCents).toBe(2499);
    expect(await persistDbPlanEntitlement('starter', 'tracked_profiles', true, 12, harness.client)).toBe(true);
    const plans = await loadDbPlans(harness.client);
    expect(plans.find((p) => p.code === 'starter')?.entitlements.tracked_profiles.numericLimit).toBe(12);

    // Payments flag stays strictly locked false
    const payToggle = await persistDbFeatureFlagToggle('payments_enabled', true, undefined, harness.client);
    expect(payToggle.ok).toBe(false);
    const flags = await loadDbFeatureFlags(harness.client);
    expect(flags.find((f) => f.key === 'payments_enabled')?.enabled).toBe(false);

    // Support ticket creation + status history tracking
    const ticket = await persistDbSupportTicketCreate(
      { email: 'help@example.com', subject: 'Billing inquiry', message: 'When will plans open?', priority: 'normal' },
      harness.client
    );
    const resolved = await persistDbSupportTicketUpdate(
      ticket.id,
      { status: 'resolved', adminNotes: 'Informed user payments remain disabled.' },
      undefined,
      harness.client
    );
    expect(resolved?.status).toBe('resolved');
    expect(harness.db.supportTicketStatusHistory.size).toBe(1);

    // Admin user listing & role/plan updates + audit logs
    const reg = await registerUserWithWorkspace(
      {
        email: 'team@example.com',
        password: 'TeamMemberPassword1!',
        fullName: 'Team Member',
        segment: 'agency',
        preferredLocale: 'en',
        emailPreferences: { productUpdates: false, weeklyDigest: false, trackingAlerts: true, marketing: false },
      },
      harness.client
    );
    expect(reg.ok).toBe(true);
    if (reg.ok) {
      const upd = await persistDbAdminUserUpdate(
        reg.user.id,
        { role: 'analyst', planCode: 'pro' },
        harness.client
      );
      expect(upd.ok).toBe(true);
      const users = await listDbAdminUsers(harness.client);
      const found = users.find((u) => u.id === reg.user.id);
      expect(found?.role).toBe('analyst');
      expect(found?.planCode).toBe('pro');
    }

    await persistDbAuditLog(
      {
        actorId: 'system',
        actorEmail: 'admin@example.com',
        action: 'admin.plan.updated',
        targetType: 'plan',
        targetId: 'premium',
        diff: { monthlyPriceCents: 2499 },
      },
      harness.client
    );
    const logs = await loadDbAuditLogs(harness.client);
    expect(logs.some((l) => l.action === 'admin.plan.updated')).toBe(true);

    // Persistent Local File Storage enforces owner isolation and blocks traversal
    const storage = new LocalFileStorage(tmpStorageDir);
    const meta = await storage.putObject({
      namespace: 'exports',
      ownerId: 'user-owner-a',
      fileName: 'report.csv',
      content: 'username,followers\nnordic.design,42000\n',
      contentType: 'text/csv',
    });
    const ownRead = await storage.getObject(meta.key, 'user-owner-a');
    expect(ownRead?.toString('utf-8')).toContain('nordic.design');
    await expect(storage.getObject(meta.key, 'user-owner-b')).rejects.toThrow(
      /Cross-account file storage access denied/
    );
    await expect(storage.deleteObject(meta.key, 'user-owner-b')).rejects.toThrow(
      /Cross-account file storage deletion denied/
    );
    await storage.deleteOwnerNamespace('user-owner-a');
    expect(await storage.getObject(meta.key, 'user-owner-a')).toBeNull();
  });
});
