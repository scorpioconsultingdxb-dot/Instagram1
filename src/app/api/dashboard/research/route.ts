import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import {
  loadConfiguredPlans,
  loadUserEntitlementOverrides,
  resolveEntitlements,
} from '@/lib/entitlements/service';
import {
  loadUserWorkspaceState,
  persistProfileMetaUpdate,
  persistSavedProfile,
  type SavedProfileRecord,
} from '@/lib/dashboard/store';
import {
  buildUserProvidedProfileData,
  getUserResearchProState,
  parseResearchCsvImport,
  pushHistory,
  updateUserResearchProState,
  type ResearchProjectRecord,
} from '@/lib/research/workspace-pro';

const researchActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_project'),
    title: z.string().trim().min(2).max(80),
    objective: z.string().trim().max(300).default(''),
    parentProjectId: z.string().nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(28)).max(8).default([]),
    profileUsernames: z.array(z.string().trim().min(2).max(40)).max(30).default([]),
  }),
  z.object({
    type: z.literal('update_project'),
    id: z.string().min(1),
    title: z.string().trim().min(2).max(80).optional(),
    objective: z.string().trim().max(300).optional(),
    status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
    pinned: z.boolean().optional(),
    favorite: z.boolean().optional(),
    tags: z.array(z.string().trim().min(1).max(28)).max(8).optional(),
    profileUsernames: z.array(z.string().trim().min(2).max(40)).max(30).optional(),
  }),
  z.object({
    type: z.literal('delete_project'),
    id: z.string().min(1),
  }),
  z.object({
    type: z.literal('save_filter'),
    name: z.string().trim().min(2).max(60),
    query: z.string().trim().max(80).default(''),
    tag: z.string().trim().max(28).default(''),
    status: z.enum(['all', 'active', 'paused', 'completed', 'archived']).default('all'),
    minFollowers: z.number().int().min(0).nullable().optional(),
  }),
  z.object({
    type: z.literal('delete_filter'),
    id: z.string().min(1),
  }),
  z.object({
    type: z.literal('bulk_tag_profiles'),
    usernames: z.array(z.string().trim().min(2).max(40)).min(1).max(30),
    tag: z.string().trim().min(1).max(28),
  }),
  z.object({
    type: z.literal('preview_csv'),
    csvText: z.string().min(1),
  }),
  z.object({
    type: z.literal('commit_csv'),
    csvText: z.string().min(1),
    projectId: z.string().nullable().optional(),
    folderId: z.string().nullable().optional(),
  }),
]);

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  if (!isDatabaseConfigured() && !isLocalDevFallbackAllowed()) {
    return NextResponse.json({ ok: false, error: 'Storage is unavailable.' }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    research: getUserResearchProState(user.id),
  });
}

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  if (!isDatabaseConfigured() && !isLocalDevFallbackAllowed()) {
    return NextResponse.json({ ok: false, error: 'Storage is unavailable.' }, { status: 503 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = researchActionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid research workspace action.' }, { status: 400 });
  }

  const action = parsed.data;

  if (action.type === 'create_project') {
    const now = new Date().toISOString();
    const project: ResearchProjectRecord = {
      id: `prj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: action.title,
      objective: action.objective,
      status: 'active',
      parentProjectId: action.parentProjectId ?? null,
      pinned: false,
      favorite: false,
      tags: Array.from(new Set(action.tags.map((t) => t.toLowerCase()))),
      profileUsernames: Array.from(new Set(action.profileUsernames.map((u) => u.toLowerCase()))),
      createdAt: now,
      updatedAt: now,
    };

    const research = updateUserResearchProState(user.id, (state) => ({
      ...state,
      projects: [project, ...state.projects],
      history: pushHistory(state.history, 'project_created', `Created project "${project.title}"`),
    }));
    return NextResponse.json({ ok: true, project, research }, { status: 201 });
  }

  if (action.type === 'update_project') {
    let found = false;
    const research = updateUserResearchProState(user.id, (state) => {
      const nextProjects = state.projects.map((p) => {
        if (p.id !== action.id) return p;
        found = true;
        return {
          ...p,
          title: action.title ?? p.title,
          objective: action.objective ?? p.objective,
          status: action.status ?? p.status,
          pinned: action.pinned !== undefined ? action.pinned : p.pinned,
          favorite: action.favorite !== undefined ? action.favorite : p.favorite,
          tags: action.tags ? Array.from(new Set(action.tags.map((t) => t.toLowerCase()))) : p.tags,
          profileUsernames: action.profileUsernames
            ? Array.from(new Set(action.profileUsernames.map((u) => u.toLowerCase())))
            : p.profileUsernames,
          updatedAt: new Date().toISOString(),
        };
      });
      const histAction =
        action.status === 'archived'
          ? 'project_archived'
          : action.status === 'active'
            ? 'project_restored'
            : 'project_updated';
      return {
        ...state,
        projects: nextProjects,
        history: found
          ? pushHistory(state.history, histAction, `Updated project ${action.title ?? action.id}`)
          : state.history,
      };
    });
    if (!found) {
      return NextResponse.json({ ok: false, error: 'Research project not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, research });
  }

  if (action.type === 'delete_project') {
    const research = updateUserResearchProState(user.id, (state) => ({
      ...state,
      projects: state.projects
        .filter((p) => p.id !== action.id)
        .map((p) => (p.parentProjectId === action.id ? { ...p, parentProjectId: null } : p)),
    }));
    return NextResponse.json({ ok: true, research });
  }

  if (action.type === 'save_filter') {
    const research = updateUserResearchProState(user.id, (state) => ({
      ...state,
      savedFilters: [
        {
          id: `flt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: action.name,
          query: action.query,
          tag: action.tag,
          status: action.status,
          minFollowers: action.minFollowers ?? null,
          createdAt: new Date().toISOString(),
        },
        ...state.savedFilters,
      ].slice(0, 20),
      history: pushHistory(state.history, 'filter_saved', `Saved filter "${action.name}"`),
    }));
    return NextResponse.json({ ok: true, research }, { status: 201 });
  }

  if (action.type === 'delete_filter') {
    const research = updateUserResearchProState(user.id, (state) => ({
      ...state,
      savedFilters: state.savedFilters.filter((f) => f.id !== action.id),
    }));
    return NextResponse.json({ ok: true, research });
  }

  if (action.type === 'bulk_tag_profiles') {
    const ws = await loadUserWorkspaceState(user.id);
    const normalizedTag = action.tag.toLowerCase();
    let updatedCount = 0;

    for (const handle of action.usernames) {
      const target = ws.savedProfiles.find(
        (p) => p.username.toLowerCase() === handle.toLowerCase()
      );
      if (!target) continue;
      const mergedTags = Array.from(new Set([...target.tags, normalizedTag])).slice(0, 8);
      const res = await persistProfileMetaUpdate(user.id, {
        username: target.username,
        tags: mergedTags,
      });
      if (res.ok) updatedCount += 1;
    }

    const research = updateUserResearchProState(user.id, (state) => ({
      ...state,
      history: pushHistory(
        state.history,
        'bulk_tagged',
        `Applied tag "#${normalizedTag}" to ${updatedCount} profile(s)`
      ),
    }));
    const latestWorkspace = await loadUserWorkspaceState(user.id);
    return NextResponse.json({ ok: true, updatedCount, research, workspace: latestWorkspace });
  }

  // preview_csv or commit_csv
  const ws = await loadUserWorkspaceState(user.id);
  const existingUsernames = ws.savedProfiles.map((p) => p.username);
  const preview = parseResearchCsvImport(action.csvText, existingUsernames);

  if (action.type === 'preview_csv') {
    return NextResponse.json({ ok: preview.ok, preview });
  }

  if (!preview.ok) {
    return NextResponse.json({ ok: false, error: preview.error, preview }, { status: 400 });
  }

  const [plans, overrides] = await Promise.all([
    loadConfiguredPlans(),
    loadUserEntitlementOverrides(user.id),
  ]);
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
    plans,
    overrides,
  });

  const maxLimit = entitlements.rules.tracked_profiles.numericLimit;
  const remainingSlots =
    maxLimit === null ? preview.validRows.length : Math.max(0, maxLimit - ws.savedProfiles.length);

  if (remainingSlots <= 0 && preview.validRows.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `Saved profile limit reached (${ws.savedProfiles.length}/${maxLimit}) for your ${user.planCode} plan.`,
      },
      { status: 403 }
    );
  }

  const rowsToCommit = preview.validRows.slice(0, remainingSlots);
  const skippedByQuota = preview.validRows.length - rowsToCommit.length;
  const importedUsernames: string[] = [];
  const now = new Date().toISOString();

  for (const row of rowsToCommit) {
    const record: SavedProfileRecord = {
      id: `sp-csv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      username: row.username,
      profile: buildUserProvidedProfileData(row),
      // Strict provenance: user-provided CSV entries are NEVER labeled 'live'
      dataClass: 'estimate',
      providerLabel: 'User-Provided CSV Import',
      workspace: ws.settings.activeWorkspace,
      folderId: action.folderId ?? null,
      tags: Array.from(new Set([...row.tags, 'csv-import'])).slice(0, 8),
      privateNote: row.notes,
      savedAt: now,
      updatedAt: now,
    };
    const saved = await persistSavedProfile(user.id, record, ws.settings.activeWorkspace, {
      maxProfilesLimit: maxLimit,
    });
    if (saved.ok) {
      importedUsernames.push(row.username);
    }
  }

  const research = updateUserResearchProState(user.id, (state) => ({
    ...state,
    projects: action.projectId
      ? state.projects.map((p) =>
          p.id === action.projectId
            ? {
                ...p,
                profileUsernames: Array.from(new Set([...p.profileUsernames, ...importedUsernames])),
                updatedAt: now,
              }
            : p
        )
      : state.projects,
    history: pushHistory(
      state.history,
      'csv_imported',
      `Imported ${importedUsernames.length} user-provided profile(s) via CSV`
    ),
  }));

  const latestWorkspace = await loadUserWorkspaceState(user.id);
  return NextResponse.json({
    ok: true,
    importedCount: importedUsernames.length,
    duplicatesSkipped: preview.duplicateRows.length,
    skippedByQuota,
    issues: preview.issues,
    research,
    workspace: latestWorkspace,
  });
}
