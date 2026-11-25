import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';
import {
  loadDbUserWorkspaceState,
  persistDbCreateComparison,
  persistDbCreateFolder,
  persistDbCreateWorkspace,
  persistDbDashboardSettings,
  persistDbDeleteComparison,
  persistDbDeleteFolder,
  persistDbExportHistory,
  persistDbMarkAllNotificationsRead,
  persistDbMarkNotificationRead,
  persistDbProfileMetaUpdate,
  persistDbRemoveProfile,
  persistDbSavedAiReport,
  persistDbSavedProfile,
  persistDbUpdateComparison,
} from '@/lib/db/repositories/workspace.repo';
import type { DataClass, PublicProfileData } from '@/lib/providers/types';
import type { AiReportOutput } from '@/lib/ai/gemini';

export interface ResearchFolderRecord {
  id: string;
  name: string;
  color: 'violet' | 'cyan' | 'emerald' | 'amber' | 'slate';
  description: string;
  createdAt: string;
}

export interface SavedProfileRecord {
  id: string;
  username: string;
  profile: PublicProfileData;
  dataClass: DataClass;
  providerLabel: string;
  workspace: string;
  folderId: string | null;
  tags: string[];
  privateNote: string;
  savedAt: string;
  updatedAt: string;
}

export interface ComparisonProjectRecord {
  id: string;
  name: string;
  description: string;
  usernames: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceNotificationRecord {
  id: string;
  title: string;
  body: string;
  category: 'system' | 'tracking' | 'report' | 'billing' | 'security';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface SavedAiReportRecord {
  id: string;
  report: AiReportOutput;
  savedAt: string;
}

export interface ExportHistoryRecord {
  id: string;
  username: string;
  format: 'pdf' | 'csv';
  dataClass: DataClass;
  createdAt: string;
}

export interface DashboardSettingsRecord {
  activeWorkspace: string;
  defaultSort: 'newest' | 'followers_desc' | 'er_desc' | 'alpha';
  defaultDateRange: '30d' | '90d' | 'all';
  showTableByDefault: boolean;
  demoPreviewMode: boolean;
}

export interface UserWorkspaceState {
  userId: string;
  workspaces: string[];
  folders: ResearchFolderRecord[];
  savedProfiles: SavedProfileRecord[];
  comparisons: ComparisonProjectRecord[];
  notifications: WorkspaceNotificationRecord[];
  reports: SavedAiReportRecord[];
  exports: ExportHistoryRecord[];
  settings: DashboardSettingsRecord;
  updatedAt: string;
}

export interface WorkspaceUsageStats {
  savedProfilesCount: number;
  foldersCount: number;
  notesCount: number;
  comparisonsCount: number;
  reportsCount: number;
  exportsCount: number;
  unreadNotificationsCount: number;
}

const WORKSPACE_STORE = 'user-workspaces.json';

function createInitialUserWorkspace(
  userId: string,
  defaultWorkspace = 'Personal Workspace'
): UserWorkspaceState {
  const now = new Date().toISOString();
  return {
    userId,
    workspaces: [defaultWorkspace],
    folders: [
      {
        id: 'fld-general',
        name: 'General Research',
        color: 'violet',
        description: 'Default research folder for saved eligible profiles.',
        createdAt: now,
      },
    ],
    // IMPORTANT: Never unconditionally seed demo profiles for real customers!
    savedProfiles: [],
    comparisons: [],
    notifications: [
      {
        id: 'notif-welcome',
        title: 'Your private Viewora workspace is ready',
        body: 'Save an eligible public profile, create a research folder, or toggle Demo Preview Mode to explore sample charts.',
        category: 'system',
        read: false,
        createdAt: now,
        actionUrl: '/dashboard/profiles',
      },
      {
        id: 'notif-hq',
        title: 'Customize your Personal Digital Headquarters',
        body: 'Set your avatar, cover banner, preferred language, accent palette, and workspace shortcuts in My Profile HQ.',
        category: 'system',
        read: false,
        createdAt: now,
        actionUrl: '/dashboard/profile',
      },
    ],
    reports: [],
    exports: [],
    settings: {
      activeWorkspace: defaultWorkspace,
      defaultSort: 'newest',
      defaultDateRange: 'all',
      showTableByDefault: false,
      demoPreviewMode: false,
    },
    updatedAt: now,
  };
}

export function getUserWorkspaceState(
  userId: string,
  defaultWorkspace = 'Personal Workspace'
): UserWorkspaceState {
  const all = readJsonStore<Record<string, UserWorkspaceState>>(WORKSPACE_STORE, () => ({}));
  const existing = all[userId];
  if (existing) return existing;
  return createInitialUserWorkspace(userId, defaultWorkspace);
}

export function updateUserWorkspaceState(
  userId: string,
  updater: (current: UserWorkspaceState) => UserWorkspaceState,
  defaultWorkspace = 'Personal Workspace'
): UserWorkspaceState {
  let nextState!: UserWorkspaceState;
  updateJsonStore<Record<string, UserWorkspaceState>>(
    WORKSPACE_STORE,
    () => ({}),
    (all) => {
      const current = all[userId] ?? createInitialUserWorkspace(userId, defaultWorkspace);
      const updated = updater(current);
      nextState = {
        ...updated,
        userId,
        updatedAt: new Date().toISOString(),
      };
      return {
        ...all,
        [userId]: nextState,
      };
    }
  );
  return nextState;
}

export function deleteUserWorkspaceState(userId: string): void {
  updateJsonStore<Record<string, UserWorkspaceState>>(
    WORKSPACE_STORE,
    () => ({}),
    (all) => {
      if (!(userId in all)) return all;
      const next = { ...all };
      delete next[userId];
      return next;
    }
  );
}

export function getWorkspaceUsageStats(userId: string): WorkspaceUsageStats {
  const ws = getUserWorkspaceState(userId);
  return {
    savedProfilesCount: ws.savedProfiles.length,
    foldersCount: ws.folders.length,
    notesCount: ws.savedProfiles.filter((p) => p.privateNote.trim().length > 0).length,
    comparisonsCount: ws.comparisons.length,
    reportsCount: ws.reports.length,
    exportsCount: ws.exports.length,
    unreadNotificationsCount: ws.notifications.filter((n) => !n.read).length,
  };
}

export function recordSavedAiReport(userId: string, report: AiReportOutput): SavedAiReportRecord {
  const entry: SavedAiReportRecord = {
    id: `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    report,
    savedAt: new Date().toISOString(),
  };
  updateUserWorkspaceState(userId, (ws) => ({
    ...ws,
    reports: [entry, ...ws.reports].slice(0, 50),
  }));
  return entry;
}

export function recordExportHistory(
  userId: string,
  item: Omit<ExportHistoryRecord, 'id' | 'createdAt'>
): ExportHistoryRecord {
  const entry: ExportHistoryRecord = {
    ...item,
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  updateUserWorkspaceState(userId, (ws) => ({
    ...ws,
    exports: [entry, ...ws.exports].slice(0, 100),
  }));
  return entry;
}

// ============================================================================
// Independent PostgreSQL (Prisma) Workspace Operations
// ============================================================================

export async function loadUserWorkspaceState(
  userId: string,
  defaultWorkspace = 'Personal Workspace'
): Promise<UserWorkspaceState> {
  if (isDatabaseConfigured()) {
    return loadDbUserWorkspaceState(userId, defaultWorkspace);
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  return getUserWorkspaceState(userId, defaultWorkspace);
}

export async function loadWorkspaceUsageStats(userId: string): Promise<WorkspaceUsageStats> {
  const ws = await loadUserWorkspaceState(userId);
  return {
    savedProfilesCount: ws.savedProfiles.length,
    foldersCount: ws.folders.length,
    notesCount: ws.savedProfiles.filter((p) => p.privateNote.trim().length > 0).length,
    comparisonsCount: ws.comparisons.length,
    reportsCount: ws.reports.length,
    exportsCount: ws.exports.length,
    unreadNotificationsCount: ws.notifications.filter((n) => !n.read).length,
  };
}

export async function persistSavedProfile(
  userId: string,
  record: SavedProfileRecord,
  defaultWorkspace = 'Personal Workspace',
  options?: { maxProfilesLimit?: number | null }
): Promise<
  | { ok: true; workspace: UserWorkspaceState; savedProfile: SavedProfileRecord }
  | { ok: false; error: string; statusCode?: number }
> {
  if (isDatabaseConfigured()) {
    try {
      const res = await persistDbSavedProfile(userId, record, defaultWorkspace, undefined, options);
      return { ok: true, ...res };
    } catch (err) {
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err && typeof err.statusCode === 'number'
          ? err.statusCode
          : 503;
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to save profile.',
        statusCode,
      };
    }
  }
  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.', statusCode: 503 };
  }
  const next = updateUserWorkspaceState(
    userId,
    (ws) => ({ ...ws, savedProfiles: [record, ...ws.savedProfiles] }),
    defaultWorkspace
  );
  return { ok: true, workspace: next, savedProfile: record };
}

export async function persistProfileMetaUpdate(
  userId: string,
  patch: { username: string; folderId?: string | null; privateNote?: string; tags?: string[] },
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (isDatabaseConfigured()) {
    try {
      const workspace = await persistDbProfileMetaUpdate(userId, patch, defaultWorkspace);
      return { ok: true, workspace };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to update profile.' };
    }
  }
  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.' };
  }
  const next = updateUserWorkspaceState(
    userId,
    (ws) => ({
      ...ws,
      savedProfiles: ws.savedProfiles.map((p) =>
        p.username.toLowerCase() === patch.username.toLowerCase()
          ? {
              ...p,
              folderId: patch.folderId !== undefined ? patch.folderId : p.folderId,
              privateNote: patch.privateNote !== undefined ? patch.privateNote : p.privateNote,
              tags: patch.tags !== undefined ? patch.tags : p.tags,
              updatedAt: new Date().toISOString(),
            }
          : p
      ),
    }),
    defaultWorkspace
  );
  return { ok: true, workspace: next };
}

export async function persistRemoveProfile(
  userId: string,
  username: string,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (isDatabaseConfigured()) {
    try {
      const workspace = await persistDbRemoveProfile(userId, username, defaultWorkspace);
      return { ok: true, workspace };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to remove profile.' };
    }
  }
  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.' };
  }
  const next = updateUserWorkspaceState(
    userId,
    (ws) => ({
      ...ws,
      savedProfiles: ws.savedProfiles.filter(
        (p) => p.username.toLowerCase() !== username.toLowerCase()
      ),
    }),
    defaultWorkspace
  );
  return { ok: true, workspace: next };
}

export async function persistCreateFolder(
  userId: string,
  folder: ResearchFolderRecord,
  defaultWorkspace = 'Personal Workspace'
): Promise<
  { ok: true; workspace: UserWorkspaceState; folder: ResearchFolderRecord } | { ok: false; error: string }
> {
  if (isDatabaseConfigured()) {
    try {
      const res = await persistDbCreateFolder(userId, folder, defaultWorkspace);
      return { ok: true, ...res };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to create folder.' };
    }
  }
  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.' };
  }
  const next = updateUserWorkspaceState(
    userId,
    (ws) => ({ ...ws, folders: [...ws.folders, folder] }),
    defaultWorkspace
  );
  return { ok: true, workspace: next, folder };
}

export async function persistDeleteFolder(
  userId: string,
  folderId: string,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (isDatabaseConfigured()) {
    try {
      const workspace = await persistDbDeleteFolder(userId, folderId, defaultWorkspace);
      return { ok: true, workspace };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete folder.' };
    }
  }
  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.' };
  }
  const next = updateUserWorkspaceState(
    userId,
    (ws) => ({
      ...ws,
      folders: ws.folders.filter((f) => f.id !== folderId),
      savedProfiles: ws.savedProfiles.map((p) =>
        p.folderId === folderId ? { ...p, folderId: null } : p
      ),
    }),
    defaultWorkspace
  );
  return { ok: true, workspace: next };
}

export async function persistCreateComparison(
  userId: string,
  project: ComparisonProjectRecord,
  defaultWorkspace = 'Personal Workspace'
): Promise<
  | { ok: true; workspace: UserWorkspaceState; comparison: ComparisonProjectRecord }
  | { ok: false; error: string }
> {
  if (isDatabaseConfigured()) {
    try {
      const res = await persistDbCreateComparison(userId, project, defaultWorkspace);
      return { ok: true, ...res };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to create comparison.' };
    }
  }
  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.' };
  }
  const next = updateUserWorkspaceState(
    userId,
    (ws) => ({ ...ws, comparisons: [project, ...ws.comparisons] }),
    defaultWorkspace
  );
  return { ok: true, workspace: next, comparison: project };
}

export async function persistUpdateComparison(
  userId: string,
  patch: { id: string; name?: string; notes?: string; usernames?: string[] },
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (isDatabaseConfigured()) {
    try {
      const workspace = await persistDbUpdateComparison(userId, patch, defaultWorkspace);
      return { ok: true, workspace };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to update comparison.' };
    }
  }
  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.' };
  }
  const next = updateUserWorkspaceState(
    userId,
    (ws) => ({
      ...ws,
      comparisons: ws.comparisons.map((c) =>
        c.id === patch.id
          ? {
              ...c,
              name: patch.name ?? c.name,
              notes: patch.notes ?? c.notes,
              usernames: patch.usernames
                ? Array.from(new Set(patch.usernames.map((u) => u.toLowerCase())))
                : c.usernames,
              updatedAt: new Date().toISOString(),
            }
          : c
      ),
    }),
    defaultWorkspace
  );
  return { ok: true, workspace: next };
}

export async function persistDeleteComparison(
  userId: string,
  id: string,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (isDatabaseConfigured()) {
    try {
      const workspace = await persistDbDeleteComparison(userId, id, defaultWorkspace);
      return { ok: true, workspace };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete comparison.' };
    }
  }
  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.' };
  }
  const next = updateUserWorkspaceState(
    userId,
    (ws) => ({ ...ws, comparisons: ws.comparisons.filter((c) => c.id !== id) }),
    defaultWorkspace
  );
  return { ok: true, workspace: next };
}

export async function persistMarkNotificationRead(
  userId: string,
  id: string,
  read: boolean,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (isDatabaseConfigured()) {
    try {
      const workspace = await persistDbMarkNotificationRead(userId, id, read, defaultWorkspace);
      return { ok: true, workspace };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to update notification.' };
    }
  }
  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.' };
  }
  const next = updateUserWorkspaceState(
    userId,
    (ws) => ({
      ...ws,
      notifications: ws.notifications.map((n) => (n.id === id ? { ...n, read } : n)),
    }),
    defaultWorkspace
  );
  return { ok: true, workspace: next };
}

export async function persistMarkAllNotificationsRead(
  userId: string,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (isDatabaseConfigured()) {
    try {
      const workspace = await persistDbMarkAllNotificationsRead(userId, defaultWorkspace);
      return { ok: true, workspace };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to mark notifications.' };
    }
  }
  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.' };
  }
  const next = updateUserWorkspaceState(
    userId,
    (ws) => ({
      ...ws,
      notifications: ws.notifications.map((n) => ({ ...n, read: true })),
    }),
    defaultWorkspace
  );
  return { ok: true, workspace: next };
}

export async function persistCreateWorkspace(
  userId: string,
  name: string,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (isDatabaseConfigured()) {
    try {
      const workspace = await persistDbCreateWorkspace(userId, name, defaultWorkspace);
      return { ok: true, workspace };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to create workspace.' };
    }
  }
  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.' };
  }
  const next = updateUserWorkspaceState(
    userId,
    (ws) => ({
      ...ws,
      workspaces: [...ws.workspaces, name],
      settings: { ...ws.settings, activeWorkspace: name },
    }),
    defaultWorkspace
  );
  return { ok: true, workspace: next };
}

export async function persistDashboardSettings(
  userId: string,
  patch: Partial<DashboardSettingsRecord>,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (isDatabaseConfigured()) {
    try {
      const workspace = await persistDbDashboardSettings(userId, patch, defaultWorkspace);
      return { ok: true, workspace };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to save settings.' };
    }
  }
  if (!isLocalDevFallbackAllowed()) {
    return { ok: false, error: 'PostgreSQL DATABASE_URL is not configured.' };
  }
  const next = updateUserWorkspaceState(
    userId,
    (ws) => ({
      ...ws,
      settings: { ...ws.settings, ...patch },
    }),
    defaultWorkspace
  );
  return { ok: true, workspace: next };
}

export async function persistSavedAiReport(
  userId: string,
  report: AiReportOutput,
  defaultWorkspace = 'Personal Workspace'
): Promise<SavedAiReportRecord> {
  if (isDatabaseConfigured()) {
    return persistDbSavedAiReport(userId, report, defaultWorkspace);
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  return recordSavedAiReport(userId, report);
}

export async function persistExportHistory(
  userId: string,
  item: Omit<ExportHistoryRecord, 'id' | 'createdAt'>,
  defaultWorkspace = 'Personal Workspace'
): Promise<ExportHistoryRecord> {
  if (isDatabaseConfigured()) {
    return persistDbExportHistory(userId, item, defaultWorkspace);
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  return recordExportHistory(userId, item);
}
