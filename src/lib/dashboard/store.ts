import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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

// ============================================================================
// Database-Backed Async Workspace Persistence (Supabase Postgres + Local Fallback)
// Uses existing migration tables: workspaces, research_folders, saved_profiles,
// profile_snapshots, competitor_sets, notifications, ai_reports, report_exports,
// and profiles.dashboard_settings.
// ============================================================================

async function ensureDefaultDbWorkspace(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userId: string,
  defaultName: string
): Promise<{ id: string; name: string } | null> {
  const { data: existing } = await supabase
    .from('workspaces')
    .select('id, name, is_default')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });

  if (existing && existing.length > 0) {
    const def = existing.find((w) => w.is_default) ?? existing[0]!;
    return { id: String(def.id), name: String(def.name) };
  }

  const slug = `ws-${userId.slice(0, 8)}-${Date.now().toString(36)}`;
  const { data: created, error } = await supabase
    .from('workspaces')
    .insert({
      owner_id: userId,
      name: defaultName,
      slug,
      is_default: true,
    })
    .select('id, name')
    .single();

  if (error || !created) return null;
  return { id: String(created.id), name: String(created.name) };
}

function fallbackPublicProfileFromRow(row: Record<string, unknown>): PublicProfileData {
  const username = String(row.username ?? '');
  const displayName = String(row.display_name ?? username);
  const avatarInitials = displayName
    .split(/\s+/)
    .map((s) => s[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'IG';
  return {
    username,
    displayName,
    bio: '',
    category: String(row.category ?? 'Public Creator'),
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

export async function loadUserWorkspaceState(
  userId: string,
  defaultWorkspace = 'Personal Workspace'
): Promise<UserWorkspaceState> {
  if (!isSupabaseConfigured()) {
    return getUserWorkspaceState(userId, defaultWorkspace);
  }

  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return getUserWorkspaceState(userId, defaultWorkspace);

    const defWs = await ensureDefaultDbWorkspace(supabase, userId, defaultWorkspace);
    if (!defWs) return getUserWorkspaceState(userId, defaultWorkspace);

    const [
      wsRes,
      foldersRes,
      savedRes,
      compRes,
      notifRes,
      reportsRes,
      exportsRes,
      profileRes,
    ] = await Promise.all([
      supabase
        .from('workspaces')
        .select('id, name')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('research_folders')
        .select('id, name, color, description, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('saved_profiles')
        .select(
          'id, workspace_id, username, display_name, category, is_demo, data_source, last_synced_at, notes, tags, folder_id, created_at, updated_at'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('competitor_sets')
        .select('id, name, usernames, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('notifications')
        .select('id, title, body, category, is_read, action_url, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('ai_reports')
        .select('id, username, report_type, data_class, summary, insights, model_used, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('report_exports')
        .select('id, username, export_format, data_class, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('profiles')
        .select('dashboard_settings, updated_at')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    const wsRows = (wsRes.data as Array<Record<string, unknown>> | null) ?? [];
    const wsNameById = new Map(wsRows.map((w) => [String(w.id), String(w.name)]));
    const workspaces = wsRows.length > 0 ? wsRows.map((w) => String(w.name)) : [defWs.name];

    const folders: ResearchFolderRecord[] = (
      (foldersRes.data as Array<Record<string, unknown>> | null) ?? []
    ).map((f) => ({
      id: String(f.id),
      name: String(f.name),
      color: (f.color as ResearchFolderRecord['color']) ?? 'violet',
      description: String(f.description ?? ''),
      createdAt: String(f.created_at ?? new Date().toISOString()),
    }));

    const savedRows = (savedRes.data as Array<Record<string, unknown>> | null) ?? [];
    const snapshotMap = new Map<string, PublicProfileData>();
    if (savedRows.length > 0) {
      const ids = savedRows.map((r) => String(r.id));
      const { data: snaps } = await supabase
        .from('profile_snapshots')
        .select('saved_profile_id, raw_metadata, captured_at')
        .in('saved_profile_id', ids)
        .order('captured_at', { ascending: false });
      for (const s of (snaps as Array<Record<string, unknown>> | null) ?? []) {
        const spId = String(s.saved_profile_id);
        if (!snapshotMap.has(spId) && s.raw_metadata && typeof s.raw_metadata === 'object') {
          const meta = s.raw_metadata as Record<string, unknown>;
          if (meta.profile && typeof meta.profile === 'object') {
            snapshotMap.set(spId, meta.profile as PublicProfileData);
          }
        }
      }
    }

    const savedProfiles: SavedProfileRecord[] = savedRows.map((r) => {
      const id = String(r.id);
      const isDemo = Boolean(r.is_demo);
      return {
        id,
        username: String(r.username),
        profile: snapshotMap.get(id) ?? fallbackPublicProfileFromRow(r),
        dataClass: (isDemo ? 'demo' : 'live') as DataClass,
        providerLabel: String(r.data_source ?? 'demo_fixture'),
        workspace: wsNameById.get(String(r.workspace_id)) ?? defWs.name,
        folderId: (r.folder_id as string | null) ?? null,
        tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
        privateNote: String(r.notes ?? ''),
        savedAt: String(r.created_at ?? new Date().toISOString()),
        updatedAt: String(r.updated_at ?? new Date().toISOString()),
      };
    });

    const comparisons: ComparisonProjectRecord[] = (
      (compRes.data as Array<Record<string, unknown>> | null) ?? []
    ).map((c) => ({
      id: String(c.id),
      name: String(c.name),
      description: '',
      usernames: Array.isArray(c.usernames) ? (c.usernames as string[]) : [],
      notes: '',
      createdAt: String(c.created_at ?? new Date().toISOString()),
      updatedAt: String(c.updated_at ?? new Date().toISOString()),
    }));

    const notifications: WorkspaceNotificationRecord[] = (
      (notifRes.data as Array<Record<string, unknown>> | null) ?? []
    ).map((n) => ({
      id: String(n.id),
      title: String(n.title),
      body: String(n.body),
      category: (n.category as WorkspaceNotificationRecord['category']) ?? 'system',
      read: Boolean(n.is_read),
      createdAt: String(n.created_at ?? new Date().toISOString()),
      actionUrl: (n.action_url as string | undefined) ?? undefined,
    }));

    const reports: SavedAiReportRecord[] = (
      (reportsRes.data as Array<Record<string, unknown>> | null) ?? []
    ).map((r) => {
      const insightsRaw = r.insights as Record<string, unknown> | null;
      const storedReport: AiReportOutput =
        insightsRaw && typeof insightsRaw === 'object' && !Array.isArray(insightsRaw) && insightsRaw.report
          ? (insightsRaw.report as AiReportOutput)
          : {
              reportType: (r.report_type as AiReportOutput['reportType']) ?? 'profile_performance',
              username: String(r.username),
              dataClass: (r.data_class as DataClass) ?? 'demo',
              executionMode: 'template_fallback',
              modelName: String(r.model_used ?? 'deterministic_template'),
              promptVersion: 'viewora-ai-v2.0',
              executiveSummary: String(r.summary ?? ''),
              keyFindings: [],
              recommendations: [],
              dataLimitations: [],
              sourceLabel: 'Stored Report',
              generatedAt: String(r.created_at ?? new Date().toISOString()),
              usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
            };
      return {
        id: String(r.id),
        report: storedReport,
        savedAt: String(r.created_at ?? new Date().toISOString()),
      };
    });

    const exportsList: ExportHistoryRecord[] = (
      (exportsRes.data as Array<Record<string, unknown>> | null) ?? []
    ).map((e) => ({
      id: String(e.id),
      username: String(e.username),
      format: (e.export_format as 'pdf' | 'csv') ?? 'csv',
      dataClass: (e.data_class as DataClass) ?? 'demo',
      createdAt: String(e.created_at ?? new Date().toISOString()),
    }));

    const rawSettings =
      (profileRes.data?.dashboard_settings as Partial<DashboardSettingsRecord> | null) ?? {};

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
      updatedAt: String(profileRes.data?.updated_at ?? new Date().toISOString()),
    };
  } catch {
    return getUserWorkspaceState(userId, defaultWorkspace);
  }
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
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState; savedProfile: SavedProfileRecord } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    const next = updateUserWorkspaceState(
      userId,
      (ws) => ({ ...ws, savedProfiles: [record, ...ws.savedProfiles] }),
      defaultWorkspace
    );
    return { ok: true, workspace: next, savedProfile: record };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'Database client unavailable.' };
  const defWs = await ensureDefaultDbWorkspace(supabase, userId, defaultWorkspace);
  if (!defWs) return { ok: false, error: 'Unable to resolve workspace in database.' };

  const { data: inserted, error } = await supabase
    .from('saved_profiles')
    .insert({
      workspace_id: defWs.id,
      user_id: userId,
      username: record.username,
      display_name: record.profile.displayName,
      category: record.profile.category,
      is_demo: record.dataClass === 'demo',
      data_source: record.providerLabel,
      last_synced_at: record.savedAt,
      notes: record.privateNote,
      tags: record.tags,
      folder_id: record.folderId,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? 'Failed to save profile to database.' };
  }

  await supabase.from('profile_snapshots').insert({
    saved_profile_id: String(inserted.id),
    username: record.username,
    data_class: record.dataClass,
    provider_id: record.providerLabel,
    followers_count: record.profile.followersCount ?? null,
    following_count: record.profile.followingCount ?? null,
    posts_count: record.profile.postsCount ?? null,
    engagement_rate: record.profile.estimatedEngagementRate ?? null,
    bio_snapshot: record.profile.bio,
    raw_metadata: { profile: record.profile },
  });

  const workspace = await loadUserWorkspaceState(userId, defaultWorkspace);
  const savedProfile =
    workspace.savedProfiles.find((p) => p.username.toLowerCase() === record.username.toLowerCase()) ??
    { ...record, id: String(inserted.id) };
  return { ok: true, workspace, savedProfile };
}

export async function persistProfileMetaUpdate(
  userId: string,
  patch: { username: string; folderId?: string | null; privateNote?: string; tags?: string[] },
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
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

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'Database client unavailable.' };

  const dbPatch: Record<string, unknown> = {};
  if (patch.folderId !== undefined) dbPatch.folder_id = patch.folderId;
  if (patch.privateNote !== undefined) dbPatch.notes = patch.privateNote;
  if (patch.tags !== undefined) dbPatch.tags = patch.tags;

  const { error } = await supabase
    .from('saved_profiles')
    .update(dbPatch)
    .eq('user_id', userId)
    .eq('username', patch.username);

  if (error) return { ok: false, error: error.message };
  return { ok: true, workspace: await loadUserWorkspaceState(userId, defaultWorkspace) };
}

export async function persistRemoveProfile(
  userId: string,
  username: string,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
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

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'Database client unavailable.' };
  const { error } = await supabase
    .from('saved_profiles')
    .delete()
    .eq('user_id', userId)
    .eq('username', username);
  if (error) return { ok: false, error: error.message };
  return { ok: true, workspace: await loadUserWorkspaceState(userId, defaultWorkspace) };
}

export async function persistCreateFolder(
  userId: string,
  folder: ResearchFolderRecord,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState; folder: ResearchFolderRecord } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    const next = updateUserWorkspaceState(
      userId,
      (ws) => ({ ...ws, folders: [...ws.folders, folder] }),
      defaultWorkspace
    );
    return { ok: true, workspace: next, folder };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'Database client unavailable.' };
  const defWs = await ensureDefaultDbWorkspace(supabase, userId, defaultWorkspace);
  if (!defWs) return { ok: false, error: 'Unable to resolve workspace in database.' };

  const { data, error } = await supabase
    .from('research_folders')
    .insert({
      workspace_id: defWs.id,
      user_id: userId,
      name: folder.name,
      color: folder.color,
      description: folder.description,
    })
    .select('id, name, color, description, created_at')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to create folder.' };
  const createdFolder: ResearchFolderRecord = {
    id: String(data.id),
    name: String(data.name),
    color: data.color as ResearchFolderRecord['color'],
    description: String(data.description ?? ''),
    createdAt: String(data.created_at ?? folder.createdAt),
  };
  return {
    ok: true,
    workspace: await loadUserWorkspaceState(userId, defaultWorkspace),
    folder: createdFolder,
  };
}

export async function persistDeleteFolder(
  userId: string,
  folderId: string,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
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

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'Database client unavailable.' };
  const { error } = await supabase
    .from('research_folders')
    .delete()
    .eq('user_id', userId)
    .eq('id', folderId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, workspace: await loadUserWorkspaceState(userId, defaultWorkspace) };
}

export async function persistCreateComparison(
  userId: string,
  project: ComparisonProjectRecord,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState; comparison: ComparisonProjectRecord } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    const next = updateUserWorkspaceState(
      userId,
      (ws) => ({ ...ws, comparisons: [project, ...ws.comparisons] }),
      defaultWorkspace
    );
    return { ok: true, workspace: next, comparison: project };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'Database client unavailable.' };
  const defWs = await ensureDefaultDbWorkspace(supabase, userId, defaultWorkspace);
  if (!defWs) return { ok: false, error: 'Unable to resolve workspace in database.' };

  const { data, error } = await supabase
    .from('competitor_sets')
    .insert({
      workspace_id: defWs.id,
      user_id: userId,
      name: project.name,
      usernames: project.usernames,
    })
    .select('id, name, usernames, created_at, updated_at')
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? 'Failed to save comparison.' };
  const created: ComparisonProjectRecord = {
    ...project,
    id: String(data.id),
    createdAt: String(data.created_at ?? project.createdAt),
    updatedAt: String(data.updated_at ?? project.updatedAt),
  };
  return {
    ok: true,
    workspace: await loadUserWorkspaceState(userId, defaultWorkspace),
    comparison: created,
  };
}

export async function persistUpdateComparison(
  userId: string,
  patch: { id: string; name?: string; notes?: string; usernames?: string[] },
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
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

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'Database client unavailable.' };
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.usernames !== undefined) {
    dbPatch.usernames = Array.from(new Set(patch.usernames.map((u) => u.toLowerCase())));
  }
  const { error } = await supabase
    .from('competitor_sets')
    .update(dbPatch)
    .eq('user_id', userId)
    .eq('id', patch.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, workspace: await loadUserWorkspaceState(userId, defaultWorkspace) };
}

export async function persistDeleteComparison(
  userId: string,
  id: string,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    const next = updateUserWorkspaceState(
      userId,
      (ws) => ({ ...ws, comparisons: ws.comparisons.filter((c) => c.id !== id) }),
      defaultWorkspace
    );
    return { ok: true, workspace: next };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'Database client unavailable.' };
  const { error } = await supabase
    .from('competitor_sets')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, workspace: await loadUserWorkspaceState(userId, defaultWorkspace) };
}

export async function persistMarkNotificationRead(
  userId: string,
  id: string,
  read: boolean,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
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

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'Database client unavailable.' };
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: read })
    .eq('user_id', userId)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, workspace: await loadUserWorkspaceState(userId, defaultWorkspace) };
}

export async function persistMarkAllNotificationsRead(
  userId: string,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
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

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'Database client unavailable.' };
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) return { ok: false, error: error.message };
  return { ok: true, workspace: await loadUserWorkspaceState(userId, defaultWorkspace) };
}

export async function persistCreateWorkspace(
  userId: string,
  name: string,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
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

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'Database client unavailable.' };
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}-${Date.now().toString(36)}`;
  const { error } = await supabase.from('workspaces').insert({
    owner_id: userId,
    name,
    slug,
    is_default: false,
  });
  if (error) return { ok: false, error: error.message };
  await persistDashboardSettings(userId, { activeWorkspace: name }, defaultWorkspace);
  return { ok: true, workspace: await loadUserWorkspaceState(userId, defaultWorkspace) };
}

export async function persistDashboardSettings(
  userId: string,
  patch: Partial<DashboardSettingsRecord>,
  defaultWorkspace = 'Personal Workspace'
): Promise<{ ok: true; workspace: UserWorkspaceState } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
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

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: 'Database client unavailable.' };
  const current = await loadUserWorkspaceState(userId, defaultWorkspace);
  const mergedSettings: DashboardSettingsRecord = {
    ...current.settings,
    ...patch,
  };
  const { error } = await supabase
    .from('profiles')
    .update({ dashboard_settings: mergedSettings })
    .eq('id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, workspace: { ...current, settings: mergedSettings } };
}

export async function persistSavedAiReport(
  userId: string,
  report: AiReportOutput,
  defaultWorkspace = 'Personal Workspace'
): Promise<SavedAiReportRecord> {
  if (!isSupabaseConfigured()) {
    return recordSavedAiReport(userId, report);
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return recordSavedAiReport(userId, report);
  const defWs = await ensureDefaultDbWorkspace(supabase, userId, defaultWorkspace);
  if (!defWs) return recordSavedAiReport(userId, report);

  const { data, error } = await supabase
    .from('ai_reports')
    .insert({
      workspace_id: defWs.id,
      user_id: userId,
      username: report.username,
      report_type: report.reportType,
      data_class: report.dataClass,
      summary: report.executiveSummary,
      insights: { report },
      model_used: report.modelName,
    })
    .select('id, created_at')
    .single();

  if (error || !data) return recordSavedAiReport(userId, report);
  return {
    id: String(data.id),
    report,
    savedAt: String(data.created_at ?? new Date().toISOString()),
  };
}

export async function persistExportHistory(
  userId: string,
  item: Omit<ExportHistoryRecord, 'id' | 'createdAt'>,
  defaultWorkspace = 'Personal Workspace'
): Promise<ExportHistoryRecord> {
  if (!isSupabaseConfigured()) {
    return recordExportHistory(userId, item);
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return recordExportHistory(userId, item);
  const defWs = await ensureDefaultDbWorkspace(supabase, userId, defaultWorkspace);
  if (!defWs) return recordExportHistory(userId, item);

  const { data, error } = await supabase
    .from('report_exports')
    .insert({
      workspace_id: defWs.id,
      user_id: userId,
      username: item.username,
      report_kind: 'profile',
      export_format: item.format,
      status: 'ready',
      data_class: item.dataClass,
    })
    .select('id, created_at')
    .single();

  if (error || !data) return recordExportHistory(userId, item);
  return {
    ...item,
    id: String(data.id),
    createdAt: String(data.created_at ?? new Date().toISOString()),
  };
}
