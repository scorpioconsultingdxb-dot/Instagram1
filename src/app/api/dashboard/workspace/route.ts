import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { hasEntitlement, resolveEntitlements } from '@/lib/entitlements/service';
import { normalizeInstagramInput } from '@/lib/instagram/normalize';
import { defaultProviderRegistry } from '@/lib/providers';
import {
  getUserWorkspaceState,
  updateUserWorkspaceState,
  type SavedProfileRecord,
} from '@/lib/dashboard/store';

const workspaceActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('save_profile'),
    input: z.string().trim().min(1).max(160),
    folderId: z.string().nullable().optional(),
    workspace: z.string().trim().min(1).max(80).optional(),
    allowDemoFallback: z.boolean().default(true),
  }),
  z.object({
    type: z.literal('update_profile_meta'),
    username: z.string().trim().min(1).max(60),
    folderId: z.string().nullable().optional(),
    privateNote: z.string().max(2000).optional(),
    tags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
  }),
  z.object({
    type: z.literal('remove_profile'),
    username: z.string().trim().min(1).max(60),
  }),
  z.object({
    type: z.literal('create_folder'),
    name: z.string().trim().min(2).max(60),
    color: z.enum(['violet', 'cyan', 'emerald', 'amber', 'slate']).default('violet'),
    description: z.string().trim().max(240).default(''),
  }),
  z.object({
    type: z.literal('delete_folder'),
    folderId: z.string().min(1),
  }),
  z.object({
    type: z.literal('create_comparison'),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(240).default(''),
    usernames: z.array(z.string().trim().min(1).max(60)).min(2).max(10),
    notes: z.string().trim().max(1500).default(''),
  }),
  z.object({
    type: z.literal('update_comparison'),
    id: z.string().min(1),
    name: z.string().trim().min(2).max(80).optional(),
    notes: z.string().trim().max(1500).optional(),
    usernames: z.array(z.string().trim().min(1).max(60)).min(2).max(10).optional(),
  }),
  z.object({
    type: z.literal('delete_comparison'),
    id: z.string().min(1),
  }),
  z.object({
    type: z.literal('mark_notification_read'),
    id: z.string().min(1),
    read: z.boolean().default(true),
  }),
  z.object({
    type: z.literal('mark_all_notifications_read'),
  }),
  z.object({
    type: z.literal('update_settings'),
    activeWorkspace: z.string().trim().min(1).max(80).optional(),
    defaultSort: z.enum(['newest', 'followers_desc', 'er_desc', 'alpha']).optional(),
    defaultDateRange: z.enum(['30d', '90d', 'all']).optional(),
    showTableByDefault: z.boolean().optional(),
    demoPreviewMode: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('create_workspace'),
    name: z.string().trim().min(2).max(80),
  }),
]);

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  const defaultWs = user.segment === 'agency' ? 'Primary Agency HQ' : 'Personal Workspace';
  const workspace = getUserWorkspaceState(user.id, defaultWs);
  return NextResponse.json({ ok: true, workspace });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = workspaceActionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid workspace request payload.',
        issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      },
      { status: 400 }
    );
  }

  const action = parsed.data;
  const defaultWs = user.segment === 'agency' ? 'Primary Agency HQ' : 'Personal Workspace';
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
  });

  if (action.type === 'save_profile') {
    const current = getUserWorkspaceState(user.id, defaultWs);
    const normalized = normalizeInstagramInput(action.input);
    if (!normalized.ok) {
      return NextResponse.json({ ok: false, error: normalized.message }, { status: 400 });
    }

    const exists = current.savedProfiles.some(
      (p) => p.username.toLowerCase() === normalized.username.toLowerCase()
    );
    if (exists) {
      return NextResponse.json(
        { ok: false, error: `@${normalized.username} is already saved in your workspace.` },
        { status: 409 }
      );
    }

    if (!hasEntitlement(entitlements, 'tracked_profiles', current.savedProfiles.length)) {
      const limit = entitlements.rules.tracked_profiles.numericLimit ?? 1;
      return NextResponse.json(
        {
          ok: false,
          error: `Your ${entitlements.planName} plan includes up to ${limit} saved eligible profile${limit === 1 ? '' : 's'}. Remove an existing profile or compare upgraded tiers.`,
        },
        { status: 403 }
      );
    }

    const lookup = await defaultProviderRegistry.lookupPublicProfile(normalized.username, {
      allowDemoFallback: action.allowDemoFallback,
    });

    if (!lookup.data) {
      return NextResponse.json(
        { ok: false, error: lookup.meta.notice || 'Profile is unavailable or private.' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const record: SavedProfileRecord = {
      id: `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      username: lookup.data.username,
      profile: lookup.data,
      dataClass: lookup.meta.dataClass,
      providerLabel: lookup.meta.providerLabel,
      workspace: action.workspace || current.settings.activeWorkspace || defaultWs,
      folderId: action.folderId ?? current.folders[0]?.id ?? null,
      tags: [],
      privateNote: '',
      savedAt: now,
      updatedAt: now,
    };

    const next = updateUserWorkspaceState(
      user.id,
      (ws) => ({
        ...ws,
        savedProfiles: [record, ...ws.savedProfiles],
      }),
      defaultWs
    );
    return NextResponse.json({ ok: true, workspace: next, savedProfile: record }, { status: 201 });
  }

  if (action.type === 'update_profile_meta') {
    const current = getUserWorkspaceState(user.id, defaultWs);
    const target = current.savedProfiles.find(
      (p) => p.username.toLowerCase() === action.username.toLowerCase()
    );
    if (!target) {
      return NextResponse.json({ ok: false, error: 'Saved profile not found.' }, { status: 404 });
    }
    const next = updateUserWorkspaceState(
      user.id,
      (ws) => ({
        ...ws,
        savedProfiles: ws.savedProfiles.map((p) =>
          p.username.toLowerCase() === action.username.toLowerCase()
            ? {
                ...p,
                folderId: action.folderId !== undefined ? action.folderId : p.folderId,
                privateNote:
                  action.privateNote !== undefined ? action.privateNote : p.privateNote,
                tags: action.tags !== undefined ? action.tags : p.tags,
                updatedAt: new Date().toISOString(),
              }
            : p
        ),
      }),
      defaultWs
    );
    return NextResponse.json({ ok: true, workspace: next });
  }

  if (action.type === 'remove_profile') {
    const next = updateUserWorkspaceState(
      user.id,
      (ws) => ({
        ...ws,
        savedProfiles: ws.savedProfiles.filter(
          (p) => p.username.toLowerCase() !== action.username.toLowerCase()
        ),
      }),
      defaultWs
    );
    return NextResponse.json({ ok: true, workspace: next });
  }

  if (action.type === 'create_folder') {
    const current = getUserWorkspaceState(user.id, defaultWs);
    if (
      current.folders.some((f) => f.name.toLowerCase() === action.name.toLowerCase())
    ) {
      return NextResponse.json(
        { ok: false, error: `A research folder named "${action.name}" already exists.` },
        { status: 409 }
      );
    }
    const folder = {
      id: `fld-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: action.name,
      color: action.color,
      description: action.description,
      createdAt: new Date().toISOString(),
    };
    const next = updateUserWorkspaceState(
      user.id,
      (ws) => ({ ...ws, folders: [...ws.folders, folder] }),
      defaultWs
    );
    return NextResponse.json({ ok: true, workspace: next, folder }, { status: 201 });
  }

  if (action.type === 'delete_folder') {
    const next = updateUserWorkspaceState(
      user.id,
      (ws) => ({
        ...ws,
        folders: ws.folders.filter((f) => f.id !== action.folderId),
        savedProfiles: ws.savedProfiles.map((p) =>
          p.folderId === action.folderId ? { ...p, folderId: null } : p
        ),
      }),
      defaultWs
    );
    return NextResponse.json({ ok: true, workspace: next });
  }

  if (action.type === 'create_comparison') {
    const current = getUserWorkspaceState(user.id, defaultWs);
    if (!hasEntitlement(entitlements, 'competitor_monitoring', current.comparisons.length)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Competitor comparison projects require a Premium+ plan or you have reached your plan limit.',
        },
        { status: 403 }
      );
    }
    const now = new Date().toISOString();
    const project = {
      id: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: action.name,
      description: action.description,
      usernames: Array.from(new Set(action.usernames.map((u) => u.toLowerCase()))),
      notes: action.notes,
      createdAt: now,
      updatedAt: now,
    };
    const next = updateUserWorkspaceState(
      user.id,
      (ws) => ({ ...ws, comparisons: [project, ...ws.comparisons] }),
      defaultWs
    );
    return NextResponse.json({ ok: true, workspace: next, comparison: project }, { status: 201 });
  }

  if (action.type === 'update_comparison') {
    const next = updateUserWorkspaceState(
      user.id,
      (ws) => ({
        ...ws,
        comparisons: ws.comparisons.map((c) =>
          c.id === action.id
            ? {
                ...c,
                name: action.name ?? c.name,
                notes: action.notes ?? c.notes,
                usernames: action.usernames
                  ? Array.from(new Set(action.usernames.map((u) => u.toLowerCase())))
                  : c.usernames,
                updatedAt: new Date().toISOString(),
              }
            : c
        ),
      }),
      defaultWs
    );
    return NextResponse.json({ ok: true, workspace: next });
  }

  if (action.type === 'delete_comparison') {
    const next = updateUserWorkspaceState(
      user.id,
      (ws) => ({
        ...ws,
        comparisons: ws.comparisons.filter((c) => c.id !== action.id),
      }),
      defaultWs
    );
    return NextResponse.json({ ok: true, workspace: next });
  }

  if (action.type === 'mark_notification_read') {
    const next = updateUserWorkspaceState(
      user.id,
      (ws) => ({
        ...ws,
        notifications: ws.notifications.map((n) =>
          n.id === action.id ? { ...n, read: action.read } : n
        ),
      }),
      defaultWs
    );
    return NextResponse.json({ ok: true, workspace: next });
  }

  if (action.type === 'mark_all_notifications_read') {
    const next = updateUserWorkspaceState(
      user.id,
      (ws) => ({
        ...ws,
        notifications: ws.notifications.map((n) => ({ ...n, read: true })),
      }),
      defaultWs
    );
    return NextResponse.json({ ok: true, workspace: next });
  }

  if (action.type === 'create_workspace') {
    const current = getUserWorkspaceState(user.id, defaultWs);
    if (!hasEntitlement(entitlements, 'workspaces', current.workspaces.length)) {
      return NextResponse.json(
        { ok: false, error: 'Your current plan has reached its workspace limit.' },
        { status: 403 }
      );
    }
    if (current.workspaces.some((w) => w.toLowerCase() === action.name.toLowerCase())) {
      return NextResponse.json(
        { ok: false, error: `Workspace "${action.name}" already exists.` },
        { status: 409 }
      );
    }
    const next = updateUserWorkspaceState(
      user.id,
      (ws) => ({
        ...ws,
        workspaces: [...ws.workspaces, action.name],
        settings: { ...ws.settings, activeWorkspace: action.name },
      }),
      defaultWs
    );
    return NextResponse.json({ ok: true, workspace: next }, { status: 201 });
  }

  // update_settings
  const next = updateUserWorkspaceState(
    user.id,
    (ws) => ({
      ...ws,
      settings: {
        ...ws.settings,
        ...(action.activeWorkspace !== undefined ? { activeWorkspace: action.activeWorkspace } : {}),
        ...(action.defaultSort !== undefined ? { defaultSort: action.defaultSort } : {}),
        ...(action.defaultDateRange !== undefined ? { defaultDateRange: action.defaultDateRange } : {}),
        ...(action.showTableByDefault !== undefined
          ? { showTableByDefault: action.showTableByDefault }
          : {}),
        ...(action.demoPreviewMode !== undefined ? { demoPreviewMode: action.demoPreviewMode } : {}),
      },
    }),
    defaultWs
  );
  return NextResponse.json({ ok: true, workspace: next });
}
