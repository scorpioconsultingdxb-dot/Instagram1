import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db/prisma';
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuidOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return UUID_REGEX.test(value) ? value : null;
}

export async function assertWorkspaceMember(
  userId: string,
  workspaceId: string,
  client: PrismaClient = getPrismaClient()
): Promise<void> {
  const membership = await client.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { workspaceId: true },
  });
  if (!membership) {
    throw new WorkspaceAuthorizationError();
  }
}

async function ensureDefaultDbWorkspace(
  userId: string,
  defaultName: string,
  client: PrismaClient
): Promise<{ id: string; name: string }> {
  const workspaces = await client.workspace.findMany({
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

  const created = await client.$transaction(async (tx) => {
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
  });

  return created;
}

async function resolveTargetDbWorkspace(
  userId: string,
  targetName: string | undefined,
  defaultName: string,
  client: PrismaClient
): Promise<{ id: string; name: string }> {
  if (targetName) {
    const match = await client.workspace.findFirst({
      where: {
        name: targetName,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true, name: true },
    });
    if (match) return match;
  }
  return ensureDefaultDbWorkspace(userId, defaultName, client);
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

export async function loadDbUserWorkspaceState(
  userId: string,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  const defWs = await ensureDefaultDbWorkspace(userId, defaultWorkspace, client);

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
    client.workspace.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    }),
    client.researchFolder.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
    client.savedProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
        },
      },
    }),
    client.comparisonProject.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    client.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    client.aiReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    client.reportExport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    client.user.findUnique({
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
      insightsRaw && typeof insightsRaw === 'object' && !Array.isArray(insightsRaw) && insightsRaw.report
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

export async function persistDbSavedProfile(
  userId: string,
  record: SavedProfileRecord,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<{ workspace: UserWorkspaceState; savedProfile: SavedProfileRecord }> {
  const targetWs = await resolveTargetDbWorkspace(userId, record.workspace, defaultWorkspace, client);
  await assertWorkspaceMember(userId, targetWs.id, client);

  const normalizedUsername = record.username.toLowerCase();
  const folderUuid = asUuidOrNull(record.folderId);
  if (folderUuid) {
    const folder = await client.researchFolder.findFirst({
      where: { id: folderUuid, userId },
      select: { id: true },
    });
    if (!folder) {
      throw new WorkspaceAuthorizationError('Target research folder does not belong to your account.');
    }
  }

  const inserted = await client.$transaction(async (tx) => {
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

    return sp;
  });

  const workspace = await loadDbUserWorkspaceState(userId, defaultWorkspace, client);
  const savedProfile =
    workspace.savedProfiles.find((p) => p.id === inserted.id) ?? {
      ...record,
      id: inserted.id,
      username: normalizedUsername,
    };
  return { workspace, savedProfile };
}

export async function persistDbProfileMetaUpdate(
  userId: string,
  patch: { username: string; folderId?: string | null; privateNote?: string; tags?: string[] },
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  const existing = await client.savedProfile.findFirst({
    where: { userId, username: patch.username.toLowerCase() },
    select: { id: true, workspaceId: true },
  });
  if (!existing) {
    throw new WorkspaceAuthorizationError('Saved profile not found in your workspace.');
  }
  await assertWorkspaceMember(userId, existing.workspaceId, client);

  const folderUuid = patch.folderId !== undefined ? asUuidOrNull(patch.folderId) : undefined;
  if (folderUuid) {
    const folder = await client.researchFolder.findFirst({
      where: { id: folderUuid, userId },
      select: { id: true },
    });
    if (!folder) {
      throw new WorkspaceAuthorizationError('Target folder does not belong to your account.');
    }
  }

  await client.$transaction(async (tx) => {
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
  });

  return loadDbUserWorkspaceState(userId, defaultWorkspace, client);
}

export async function persistDbRemoveProfile(
  userId: string,
  username: string,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  const target = await client.savedProfile.findFirst({
    where: { userId, username: username.toLowerCase() },
    select: { id: true, workspaceId: true },
  });
  if (!target) {
    throw new WorkspaceAuthorizationError('Saved profile not found in your workspace.');
  }
  await assertWorkspaceMember(userId, target.workspaceId, client);
  await client.savedProfile.delete({ where: { id: target.id } });
  return loadDbUserWorkspaceState(userId, defaultWorkspace, client);
}

export async function persistDbCreateFolder(
  userId: string,
  folder: ResearchFolderRecord,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<{ workspace: UserWorkspaceState; folder: ResearchFolderRecord }> {
  const defWs = await ensureDefaultDbWorkspace(userId, defaultWorkspace, client);
  const created = await client.researchFolder.create({
    data: {
      workspaceId: defWs.id,
      userId,
      name: folder.name,
      color: folder.color,
      description: folder.description,
    },
  });
  return {
    workspace: await loadDbUserWorkspaceState(userId, defaultWorkspace, client),
    folder: {
      id: created.id,
      name: created.name,
      color: created.color as ResearchFolderRecord['color'],
      description: created.description,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

export async function persistDbDeleteFolder(
  userId: string,
  folderId: string,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  const res = await client.researchFolder.deleteMany({
    where: { id: folderId, userId },
  });
  if (res.count === 0) {
    throw new WorkspaceAuthorizationError('Folder not found in your workspace.');
  }
  return loadDbUserWorkspaceState(userId, defaultWorkspace, client);
}

export async function persistDbCreateComparison(
  userId: string,
  project: ComparisonProjectRecord,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<{ workspace: UserWorkspaceState; comparison: ComparisonProjectRecord }> {
  const defWs = await ensureDefaultDbWorkspace(userId, defaultWorkspace, client);
  const created = await client.comparisonProject.create({
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
    workspace: await loadDbUserWorkspaceState(userId, defaultWorkspace, client),
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
}

export async function persistDbUpdateComparison(
  userId: string,
  patch: { id: string; name?: string; notes?: string; usernames?: string[] },
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  const existing = await client.comparisonProject.findFirst({
    where: { id: patch.id, userId },
    select: { id: true, workspaceId: true },
  });
  if (!existing) {
    throw new WorkspaceAuthorizationError('Comparison project not found in your workspace.');
  }
  await assertWorkspaceMember(userId, existing.workspaceId, client);

  await client.comparisonProject.update({
    where: { id: existing.id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.usernames !== undefined
        ? { usernames: Array.from(new Set(patch.usernames.map((u) => u.toLowerCase()))) }
        : {}),
    },
  });
  return loadDbUserWorkspaceState(userId, defaultWorkspace, client);
}

export async function persistDbDeleteComparison(
  userId: string,
  id: string,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  const res = await client.comparisonProject.deleteMany({
    where: { id, userId },
  });
  if (res.count === 0) {
    throw new WorkspaceAuthorizationError('Comparison project not found in your workspace.');
  }
  return loadDbUserWorkspaceState(userId, defaultWorkspace, client);
}

export async function persistDbMarkNotificationRead(
  userId: string,
  id: string,
  read: boolean,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  const res = await client.notification.updateMany({
    where: { id, userId },
    data: { isRead: read, readAt: read ? new Date() : null },
  });
  if (res.count === 0) {
    throw new WorkspaceAuthorizationError('Notification not found for your account.');
  }
  return loadDbUserWorkspaceState(userId, defaultWorkspace, client);
}

export async function persistDbMarkAllNotificationsRead(
  userId: string,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  await client.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return loadDbUserWorkspaceState(userId, defaultWorkspace, client);
}

export async function persistDbCreateWorkspace(
  userId: string,
  name: string,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  await client.$transaction(async (tx) => {
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
  });

  return persistDbDashboardSettings(userId, { activeWorkspace: name }, defaultWorkspace, client);
}

export async function persistDbDashboardSettings(
  userId: string,
  patch: Partial<DashboardSettingsRecord>,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<UserWorkspaceState> {
  const current = await loadDbUserWorkspaceState(userId, defaultWorkspace, client);
  const mergedSettings: DashboardSettingsRecord = {
    ...current.settings,
    ...patch,
  };
  await client.user.update({
    where: { id: userId },
    data: {
      dashboardSettings: mergedSettings as unknown as Prisma.InputJsonValue,
    },
  });
  return { ...current, settings: mergedSettings };
}

export async function persistDbSavedAiReport(
  userId: string,
  report: AiReportOutput,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<SavedAiReportRecord> {
  const defWs = await ensureDefaultDbWorkspace(userId, defaultWorkspace, client);
  const created = await client.aiReport.create({
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
}

export async function persistDbExportHistory(
  userId: string,
  item: Omit<ExportHistoryRecord, 'id' | 'createdAt'>,
  defaultWorkspace = 'Personal Workspace',
  client: PrismaClient = getPrismaClient()
): Promise<ExportHistoryRecord> {
  const defWs = await ensureDefaultDbWorkspace(userId, defaultWorkspace, client);
  const created = await client.reportExport.create({
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
}

/**
 * Strictly workspace-scoped reader for private research notes.
 * Rejects any caller who is not an explicit member of the owning workspace
 * (including other customers and platform administrators).
 */
export async function readDbPrivateProfileNotes(
  requesterUserId: string,
  savedProfileId: string,
  client: PrismaClient = getPrismaClient()
): Promise<Array<{ id: string; noteBody: string; updatedAt: string }>> {
  const saved = await client.savedProfile.findUnique({
    where: { id: savedProfileId },
    select: { id: true, workspaceId: true },
  });
  if (!saved) {
    throw new WorkspaceAuthorizationError('Saved profile not found.');
  }
  await assertWorkspaceMember(requesterUserId, saved.workspaceId, client);

  const notes = await client.profileResearchNote.findMany({
    where: { savedProfileId: saved.id, workspaceId: saved.workspaceId },
    orderBy: { updatedAt: 'desc' },
  });
  return notes.map((n) => ({
    id: n.id,
    noteBody: n.noteBody,
    updatedAt: n.updatedAt.toISOString(),
  }));
}
