import type { Prisma, PrismaClient } from '@prisma/client';
import {
  getPrismaClient,
  withUserRlsContext,
  type DbTransactionClient,
} from '@/lib/db/prisma';
import type { DataClass, PublicProfileData } from '@/lib/providers/types';
import type { AiReportOutput } from '@/lib/ai/gemini';
import type {
  ComparisonProjectRecord,
  DashboardSettingsRecord,
  ExportHistoryRecord,
  ResearchFolderRecord,
  SavedAiReportRecord,
  SavedProfileRecord,
  UserWorkspaceState,
  WorkspaceNotificationRecord,
} from '@/lib/dashboard/store';

export class WorkspaceAuthorizationError extends Error {
  readonly statusCode = 403;
  constructor(message = 'Access denied: you do not have permission for this workspace resource.') {
    super(message);
    this.name = 'WorkspaceAuthorizationError';
  }
}

export class QuotaExceededError extends Error {
  readonly statusCode = 403;
  constructor(message = 'Plan quota limit reached.') {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuidOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return UUID_REGEX.test(value) ? value : null;
}

export async function assertWorkspaceMemberTx(
  tx: DbTransactionClient,
  userId: string,
  workspaceId: string
): Promise<void> {
  const membership = await tx.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { workspaceId: true },
  });
  if (!membership) {
    throw new WorkspaceAuthorizationError();
  }
}

export async function assertWorkspaceMember(
  userId: string,
  workspaceId: string,
  client: PrismaClient = getPrismaClient()
): Promise<void> {
  await withUserRlsContext(
    { userId, role: 'user' },
    (tx) => assertWorkspaceMemberTx(tx, userId, workspaceId),
    client
  );
}

async function ensureDefaultDbWorkspaceTx(
  tx: DbTransactionClient,
  userId: string,
  defaultName: string
): Promise<{ id: string; name: string }> {
  const workspaces = await tx.workspace.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, isDefault: true },
  });

  if (workspaces.length > 0) {
    const def = workspaces.find((w) => w.isDefault) ?? workspaces[0]!;
    return { id: def.id, name: def.name };
  }

  const ws = await tx.workspace.create({
    data: {
      ownerId: userId,
      name: defaultName,
      slug: `ws-${userId.replace(/-/g, '').slice(0, 8)}-${Date.now().toString(36)}`,
      isDefault: true,
    },
    select: { id: true, name: true },
  });
  await tx.workspaceMember.create({
    data: { workspaceId: ws.id, userId, memberRole: 'owner' },
  });
  return ws;
}

async function resolveTargetDbWorkspaceTx(
  tx: DbTransactionClient,
  userId: string,
  targetName: string | undefined,
  defaultName: string
): Promise<{ id: string; name: string }> {
  if (targetName) {
    const match = await tx.workspace.findFirst({
      where: {
        name: targetName,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true, name: true },
    });
    if (match) return match;
  }
  return ensureDefaultDbWorkspaceTx(tx, userId, defaultName);
}

function fallbackPublicProfileFromRow(row: {
  username: string;
  displayName: string | null;
  category: string | null;
}): PublicProfileData {
  const displayName = row.displayName || row.username;
  const avatarInitials =
    displayName
      .split(/\s+/)
      .map((s) => s[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'IG';
  return {
    username: row.username,
    displayName,
    bio: '',
    category: row.category || 'Public Creator',
    externalUrl: null,
    isVerified: false,
    isBusinessAccount: false,
    isPrivate: false,
    avatarInitials,
    avatarAccent: '#7957FF',
    followersCount: null,
    followingCount: null,
    postsCount: null,
    estimatedEngagementRate: null,
    postingCadencePerWeek: null,
    recentPosts: [],
    historicalTrend: [],
  };
}

async function loadUserWorkspaceStateTx(
  tx: DbTransactionClient,
  userId: string,
  defaultWorkspace: string
): Promise<UserWorkspaceState> {
  const defWs = await ensureDefaultDbWorkspaceTx(tx, userId, defaultWorkspace);

  const [
    wsRows,
    folderRows,
    savedRows,
    compRows,
    notifRows,
    reportRows,
    exportRows,
    userRow,
  ] = await Promise.all([
    tx.workspace.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    }),
    tx.researchFolder.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
    tx.savedProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
        },
      },
    }),
    tx.comparisonProject.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    tx.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    tx.aiReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    tx.reportExport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    tx.user.findUnique({
      where: { id: userId },
      select: { dashboardSettings: true, updatedAt: true },
    }),
  ]);

  const wsNameById = new Map(wsRows.map((w) => [w.id, w.name]));
  const workspaces = wsRows.length > 0 ? wsRows.map((w) => w.name) : [defWs.name];

  const folders: ResearchFolderRecord[] = folderRows.map((f) => ({
    id: f.id,
    name: f.name,
    color: (f.color as ResearchFolderRecord['color']) || 'violet',
    description: f.description,
    createdAt: f.createdAt.toISOString(),
  }));

  const savedProfiles: SavedProfileRecord[] = savedRows.map((r) => {
    const snap = r.snapshots[0];
    const meta =
      snap?.rawMetadata && typeof snap.rawMetadata === 'object'
        ? (snap.rawMetadata as Record<string, unknown>)
        : null;
    const snapProfile =
      meta?.profile && typeof meta.profile === 'object'
        ? (meta.profile as PublicProfileData)
        : null;
    const snapDc = snap?.dataClass as DataClass | undefined;
    const resolvedDc: DataClass =
      snapDc === 'live' || snapDc === 'cached' || snapDc === 'estimate' || snapDc === 'demo'
        ? snapDc
        : r.isDemo
          ? 'demo'
          : 'live';

    return {
      id: r.id,
      username: r.username,
      profile: snapProfile ?? fallbackPublicProfileFromRow(r),
      dataClass: resolvedDc,
      providerLabel: r.dataSource,
      workspace: wsNameById.get(r.workspaceId) ?? defWs.name,
      folderId: r.folderId,
      tags: r.tags,
      privateNote: r.notes,
      savedAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });

  const comparisons: ComparisonProjectRecord[] = compRows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    usernames: c.usernames,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const notifications: WorkspaceNotificationRecord[] = notifRows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    category: (n.category as WorkspaceNotificationRecord['category']) || 'system',
    read: n.isRead,
    createdAt: n.createdAt.toISOString(),
    actionUrl: n.actionUrl ?? undefined,
  }));

  const reports: SavedAiReportRecord[] = reportRows.map((r) => {
    const insightsRaw = r.insights as Record<string, unknown> | null;
    const storedReport: AiReportOutput =
      insightsRaw &&
      typeof insightsRaw === 'object' &&
      !Array.isArray(insightsRaw) &&
      insightsRaw.report
        ? (insightsRaw.report as AiReportOutput)
        : {
            reportType: (r.reportType as AiReportOutput['reportType']) || 'profile_performance',
            username: r.username,
            dataClass: (r.dataClass as DataClass) || 'demo',
            executionMode: 'template_fallback',
            modelName: r.modelUsed,
            promptVersion: 'viewora-ai-v2.0',
            executiveSummary: r.summary,
            keyFindings: [],
            recommendations: [],
            dataLimitations: [],
            sourceLabel: 'Stored Report',
            generatedAt: r.createdAt.toISOString(),
            usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
          };
    return {
      id: r.id,
      report: storedReport,
      savedAt: r.createdAt.toISOString(),
    };
  });

  const exportsList: ExportHistoryRecord[] = exportRows.map((e) => ({
    id: e.id,
    username: e.username,
    format: (e.exportFormat as 'pdf' | 'csv') || 'csv',
    dataClass: (e.dataClass as DataClass) || 'demo',
    createdAt: e.createdAt.toISOString(),
  }));

  const rawSettings =
    userRow?.dashboardSettings && typeof userRow.dashboardSettings === 'object'
      ? (userRow.dashboardSettings as Partial<DashboardSettingsRecord>)
      : {};

  return {
    userId,
    workspaces,
    folders,
    savedProfiles,
    comparisons,
    notifications,
    reports,
    exports: exportsList,
    settings: {
      activeWorkspace: rawSettings.activeWorkspace ?? defWs.name,
      defaultSort: rawSettings.defaultSort ?? 'newest',
      defaultDateRange: rawSettings.defaultDateRange ?? 'all',
      showTableByDefault: Boolean(rawSettings.showTableByDefault ?? false),
      demoPreviewMode: Boolean(rawSettings.demoPreviewMode ?? false),
    },
    updatedAt: (userRow?.updatedAt ?? new Date()).toISOString(),
  };
}

export async function loadDbUserWorkspaceState(
  userId: string,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  return withUserRlsContext(
    { userId, role: 'user' },
    (tx) => loadUserWorkspaceStateTx(tx, userId, defaultWorkspace),
    client
  );
}

/**
 * Persists a saved public profile inside an RLS-scoped transaction.
 * When `maxProfilesLimit` is provided (finite integer), acquires a transaction-local
 * PostgreSQL advisory lock (`pg_advisory_xact_lock`) per user to prevent concurrent
 * quota race conditions.
 */
export async function persistDbSavedProfile(
  userId: string,
  record: SavedProfileRecord,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient(),
  options?: { maxProfilesLimit?: number | null }
): Promise<{ workspace: UserWorkspaceState; savedProfile: SavedProfileRecord }> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      if (typeof options?.maxProfilesLimit === 'number') {
        if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`saved_profile_quota:${userId}`}))`;
        }
        const currentCount = await tx.savedProfile.count({ where: { userId } });
        if (currentCount >= options.maxProfilesLimit) {
          throw new QuotaExceededError(
            `Saved profile limit (${options.maxProfilesLimit}) reached for your current plan.`
          );
        }
      }

      const targetWs = await resolveTargetDbWorkspaceTx(tx, userId, record.workspace, defaultWorkspace);
      await assertWorkspaceMemberTx(tx, userId, targetWs.id);

      const normalizedUsername = record.username.toLowerCase();
      const folderUuid = asUuidOrNull(record.folderId);
      if (folderUuid) {
        const folder = await tx.researchFolder.findFirst({
          where: { id: folderUuid, userId },
          select: { id: true },
        });
        if (!folder) {
          throw new WorkspaceAuthorizationError(
            'Target research folder does not belong to your account.'
          );
        }
      }

      const sp = await tx.savedProfile.create({
        data: {
          workspaceId: targetWs.id,
          userId,
          folderId: folderUuid,
          username: normalizedUsername,
          displayName: record.profile.displayName,
          category: record.profile.category,
          isDemo: record.dataClass === 'demo',
          dataSource: record.providerLabel,
          lastSyncedAt: new Date(record.savedAt),
          notes: record.privateNote,
          tags: record.tags,
        },
        select: { id: true },
      });

      await tx.profileSnapshot.create({
        data: {
          savedProfileId: sp.id,
          username: normalizedUsername,
          dataClass: record.dataClass,
          providerId: record.providerLabel,
          followersCount:
            record.profile.followersCount !== null ? BigInt(record.profile.followersCount) : null,
          followingCount:
            record.profile.followingCount !== null ? BigInt(record.profile.followingCount) : null,
          postsCount: record.profile.postsCount !== null ? BigInt(record.profile.postsCount) : null,
          engagementRate: record.profile.estimatedEngagementRate ?? null,
          bioSnapshot: record.profile.bio,
          rawMetadata: { profile: record.profile } as unknown as Prisma.InputJsonValue,
        },
      });

      if (record.privateNote.trim()) {
        await tx.profileResearchNote.create({
          data: {
            savedProfileId: sp.id,
            workspaceId: targetWs.id,
            authorId: userId,
            noteBody: record.privateNote.trim(),
          },
        });
      }

      const workspace = await loadUserWorkspaceStateTx(tx, userId, defaultWorkspace);
      const savedProfile =
        workspace.savedProfiles.find((p) => p.id === sp.id) ?? {
          ...record,
          id: sp.id,
          username: normalizedUsername,
        };
      return { workspace, savedProfile };
    },
    client
  );
}

export async function persistDbProfileMetaUpdate(
  userId: string,
  patch: { username: string; folderId?: string | null; privateNote?: string; tags?: string[] },
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const existing = await tx.savedProfile.findFirst({
        where: { userId, username: patch.username.toLowerCase() },
        select: { id: true, workspaceId: true },
      });
      if (!existing) {
        throw new WorkspaceAuthorizationError('Saved profile not found in your workspace.');
      }
      await assertWorkspaceMemberTx(tx, userId, existing.workspaceId);

      const folderUuid = patch.folderId !== undefined ? asUuidOrNull(patch.folderId) : undefined;
      if (folderUuid) {
        const folder = await tx.researchFolder.findFirst({
          where: { id: folderUuid, userId },
          select: { id: true },
        });
        if (!folder) {
          throw new WorkspaceAuthorizationError('Target folder does not belong to your account.');
        }
      }

      await tx.savedProfile.update({
        where: { id: existing.id },
        data: {
          ...(folderUuid !== undefined ? { folderId: folderUuid } : {}),
          ...(patch.privateNote !== undefined ? { notes: patch.privateNote } : {}),
          ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        },
      });

      if (patch.privateNote !== undefined) {
        const latestNote = await tx.profileResearchNote.findFirst({
          where: { savedProfileId: existing.id, workspaceId: existing.workspaceId },
          orderBy: { createdAt: 'desc' },
        });
        if (latestNote) {
          await tx.profileResearchNote.update({
            where: { id: latestNote.id },
            data: { noteBody: patch.privateNote },
          });
        } else if (patch.privateNote.trim()) {
          await tx.profileResearchNote.create({
            data: {
              savedProfileId: existing.id,
              workspaceId: existing.workspaceId,
              authorId: userId,
              noteBody: patch.privateNote,
            },
          });
        }
      }

      return loadUserWorkspaceStateTx(tx, userId, defaultWorkspace);
    },
    client
  );
}

export async function persistDbRemoveProfile(
  userId: string,
  username: string,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const target = await tx.savedProfile.findFirst({
        where: { userId, username: username.toLowerCase() },
        select: { id: true, workspaceId: true },
      });
      if (!target) {
        throw new WorkspaceAuthorizationError('Saved profile not found in your workspace.');
      }
      await assertWorkspaceMemberTx(tx, userId, target.workspaceId);
      await tx.savedProfile.delete({ where: { id: target.id } });
      return loadUserWorkspaceStateTx(tx, userId, defaultWorkspace);
    },
    client
  );
}

export async function persistDbCreateFolder(
  userId: string,
  folder: ResearchFolderRecord,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<{ workspace: UserWorkspaceState; folder: ResearchFolderRecord }> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const defWs = await ensureDefaultDbWorkspaceTx(tx, userId, defaultWorkspace);
      const created = await tx.researchFolder.create({
        data: {
          workspaceId: defWs.id,
          userId,
          name: folder.name,
          color: folder.color,
          description: folder.description,
        },
      });
      return {
        workspace: await loadUserWorkspaceStateTx(tx, userId, defaultWorkspace),
        folder: {
          id: created.id,
          name: created.name,
          color: created.color as ResearchFolderRecord['color'],
          description: created.description,
          createdAt: created.createdAt.toISOString(),
        },
      };
    },
    client
  );
}

export async function persistDbDeleteFolder(
  userId: string,
  folderId: string,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const res = await tx.researchFolder.deleteMany({
        where: { id: folderId, userId },
      });
      if (res.count === 0) {
        throw new WorkspaceAuthorizationError('Folder not found in your workspace.');
      }
      return loadUserWorkspaceStateTx(tx, userId, defaultWorkspace);
    },
    client
  );
}

export async function persistDbCreateComparison(
  userId: string,
  project: ComparisonProjectRecord,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<{ workspace: UserWorkspaceState; comparison: ComparisonProjectRecord }> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const defWs = await ensureDefaultDbWorkspaceTx(tx, userId, defaultWorkspace);
      const created = await tx.comparisonProject.create({
        data: {
          workspaceId: defWs.id,
          userId,
          name: project.name,
          description: project.description,
          usernames: project.usernames,
          notes: project.notes,
        },
      });
      return {
        workspace: await loadUserWorkspaceStateTx(tx, userId, defaultWorkspace),
        comparison: {
          id: created.id,
          name: created.name,
          description: created.description,
          usernames: created.usernames,
          notes: created.notes,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      };
    },
    client
  );
}

export async function persistDbUpdateComparison(
  userId: string,
  patch: { id: string; name?: string; notes?: string; usernames?: string[] },
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const existing = await tx.comparisonProject.findFirst({
        where: { id: patch.id, userId },
        select: { id: true, workspaceId: true },
      });
      if (!existing) {
        throw new WorkspaceAuthorizationError('Comparison project not found in your workspace.');
      }
      await assertWorkspaceMemberTx(tx, userId, existing.workspaceId);

      await tx.comparisonProject.update({
        where: { id: existing.id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          ...(patch.usernames !== undefined
            ? { usernames: Array.from(new Set(patch.usernames.map((u) => u.toLowerCase()))) }
            : {}),
        },
      });
      return loadUserWorkspaceStateTx(tx, userId, defaultWorkspace);
    },
    client
  );
}

export async function persistDbDeleteComparison(
  userId: string,
  id: string,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const res = await tx.comparisonProject.deleteMany({
        where: { id, userId },
      });
      if (res.count === 0) {
        throw new WorkspaceAuthorizationError('Comparison project not found in your workspace.');
      }
      return loadUserWorkspaceStateTx(tx, userId, defaultWorkspace);
    },
    client
  );
}

export async function persistDbMarkNotificationRead(
  userId: string,
  id: string,
  read: boolean,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const res = await tx.notification.updateMany({
        where: { id, userId },
        data: { isRead: read, readAt: read ? new Date() : null },
      });
      if (res.count === 0) {
        throw new WorkspaceAuthorizationError('Notification not found for your account.');
      }
      return loadUserWorkspaceStateTx(tx, userId, defaultWorkspace);
    },
    client
  );
}

export async function persistDbMarkAllNotificationsRead(
  userId: string,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      await tx.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return loadUserWorkspaceStateTx(tx, userId, defaultWorkspace);
    },
    client
  );
}

export async function persistDbCreateWorkspace(
  userId: string,
  name: string,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          ownerId: userId,
          name,
          slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}-${Date.now().toString(36)}`,
          isDefault: false,
        },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: ws.id, userId, memberRole: 'owner' },
      });

      const current = await loadUserWorkspaceStateTx(tx, userId, defaultWorkspace);
      const mergedSettings: DashboardSettingsRecord = {
        ...current.settings,
        activeWorkspace: name,
      };
      await tx.user.update({
        where: { id: userId },
        data: { dashboardSettings: mergedSettings as unknown as Prisma.InputJsonValue },
      });
      return { ...current, settings: mergedSettings };
    },
    client
  );
}

export async function persistDbDashboardSettings(
  userId: string,
  patch: Partial<DashboardSettingsRecord>,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const current = await loadUserWorkspaceStateTx(tx, userId, defaultWorkspace);
      const mergedSettings: DashboardSettingsRecord = {
        ...current.settings,
        ...patch,
      };
      await tx.user.update({
        where: { id: userId },
        data: {
          dashboardSettings: mergedSettings as unknown as Prisma.InputJsonValue,
        },
      });
      return { ...current, settings: mergedSettings };
    },
    client
  );
}

export async function persistDbSavedAiReport(
  userId: string,
  report: AiReportOutput,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<SavedAiReportRecord> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const defWs = await ensureDefaultDbWorkspaceTx(tx, userId, defaultWorkspace);
      const created = await tx.aiReport.create({
        data: {
          workspaceId: defWs.id,
          userId,
          username: report.username,
          reportType: report.reportType,
          dataClass: report.dataClass,
          summary: report.executiveSummary,
          insights: { report } as unknown as Prisma.InputJsonValue,
          modelUsed: report.modelName,
        },
      });
      return {
        id: created.id,
        report,
        savedAt: created.createdAt.toISOString(),
      };
    },
    client
  );
}

export async function persistDbExportHistory(
  userId: string,
  item: Omit<ExportHistoryRecord, 'id' | 'createdAt'>,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<ExportHistoryRecord> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const defWs = await ensureDefaultDbWorkspaceTx(tx, userId, defaultWorkspace);
      const created = await tx.reportExport.create({
        data: {
          workspaceId: defWs.id,
          userId,
          username: item.username,
          reportKind: 'profile',
          exportFormat: item.format,
          status: 'ready',
          dataClass: item.dataClass,
        },
      });
      return {
        ...item,
        id: created.id,
        createdAt: created.createdAt.toISOString(),
      };
    },
    client
  );
}

/**
 * Strictly RLS + workspace-scoped reader for private research notes.
 * Rejects any caller who is not an explicit member of the owning workspace
 * (including other customers and platform administrators).
 */
export async function readDbPrivateProfileNotes(
  requesterUserId: string,
  savedProfileId: string,
  client: PrismaClient = getPrismaClient()
): Promise<Array<{ id: string; noteBody: string; updatedAt: string }>> {
  return withUserRlsContext(
    { userId: requesterUserId, role: 'user' },
    async (tx) => {
      const saved = await tx.savedProfile.findUnique({
        where: { id: savedProfileId },
        select: { id: true, workspaceId: true },
      });
      if (!saved) {
        throw new WorkspaceAuthorizationError('Saved profile not found.');
      }
      await assertWorkspaceMemberTx(tx, requesterUserId, saved.workspaceId);

      const notes = await tx.profileResearchNote.findMany({
        where: { savedProfileId: saved.id, workspaceId: saved.workspaceId },
        orderBy: { updatedAt: 'desc' },
      });
      return notes.map((n) => ({
        id: n.id,
        noteBody: n.noteBody,
        updatedAt: n.updatedAt.toISOString(),
      }));
    },
    client
  );
}
