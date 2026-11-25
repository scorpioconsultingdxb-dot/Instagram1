import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';
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

function createInitialUserWorkspace(userId: string, defaultWorkspace = 'Personal Workspace'): UserWorkspaceState {
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
  if (existing) {
    return existing;
  }
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
