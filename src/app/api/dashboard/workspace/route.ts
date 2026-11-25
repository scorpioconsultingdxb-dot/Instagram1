import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser } from '@/lib/auth/session';
import {
  hasEntitlement,
  loadConfiguredPlans,
  loadUserEntitlementOverrides,
  resolveEntitlements,
} from '@/lib/entitlements/service';
import { normalizeInstagramInput } from '@/lib/instagram/normalize';
import { defaultProviderRegistry } from '@/lib/providers';
import {
  loadUserWorkspaceState,
  persistCreateComparison,
  persistCreateFolder,
  persistCreateWorkspace,
  persistDashboardSettings,
  persistDeleteComparison,
  persistDeleteFolder,
  persistMarkAllNotificationsRead,
  persistMarkNotificationRead,
  persistProfileMetaUpdate,
  persistRemoveProfile,
  persistSavedProfile,
  persistUpdateComparison,
  type SavedProfileRecord,
} from '@/lib/dashboard/store';
import { loadIsFeatureFlagEnabled } from '@/lib/admin/store';

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
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }
    const defaultWs = user.segment === 'agency' ? 'Primary Agency HQ' : 'Personal Workspace';
    const workspace = await loadUserWorkspaceState(user.id, defaultWs);
    return NextResponse.json({ ok: true, workspace });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Database service is temporarily unavailable.' },
      { status: 503 }
    );
  }
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

  if (action.type === 'save_profile') {
    const current = await loadUserWorkspaceState(user.id, defaultWs);
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
      const rule = entitlements.rules.tracked_profiles;
      const limit = rule.enabled ? (rule.numericLimit ?? 0) : 0;
      return NextResponse.json(
        {
          ok: false,
          error: `Your ${entitlements.planName} plan includes up to ${limit} saved eligible profile${limit === 1 ? '' : 's'}. Remove an existing profile or compare upgraded tiers.`,
        },
        { status: 403 }
      );
    }

    const demoAllowed = await loadIsFeatureFlagEnabled('demo_provider_enabled');
    const lookup = await defaultProviderRegistry.lookupPublicProfile(normalized.username, {
      allowDemoFallback: action.allowDemoFallback && demoAllowed,
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

    const trackedRule = entitlements.rules.tracked_profiles;
    const maxProfilesLimit = trackedRule.enabled ? trackedRule.numericLimit : 0;
    const result = await persistSavedProfile(user.id, record, defaultWs, { maxProfilesLimit });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.statusCode ?? 500 }
      );
    }
    return NextResponse.json(
      { ok: true, workspace: result.workspace, savedProfile: result.savedProfile },
      { status: 201 }
    );
  }

  if (action.type === 'update_profile_meta') {
    const current = await loadUserWorkspaceState(user.id, defaultWs);
    const target = current.savedProfiles.find(
      (p) => p.username.toLowerCase() === action.username.toLowerCase()
    );
    if (!target) {
      return NextResponse.json({ ok: false, error: 'Saved profile not found.' }, { status: 404 });
    }
    if (
      action.folderId !== undefined &&
      action.folderId !== null &&
      !current.folders.some((f) => f.id === action.folderId)
    ) {
      return NextResponse.json(
        { ok: false, error: 'Target research folder does not exist in your workspace.' },
        { status: 400 }
      );
    }
    const result = await persistProfileMetaUpdate(
      user.id,
      {
        username: target.username,
        folderId: action.folderId,
        privateNote: action.privateNote,
        tags: action.tags,
      },
      defaultWs
    );
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, workspace: result.workspace });
  }

  if (action.type === 'remove_profile') {
    const current = await loadUserWorkspaceState(user.id, defaultWs);
    const target = current.savedProfiles.find(
      (p) => p.username.toLowerCase() === action.username.toLowerCase()
    );
    if (!target) {
      return NextResponse.json({ ok: false, error: 'Saved profile not found.' }, { status: 404 });
    }
    const result = await persistRemoveProfile(user.id, target.username, defaultWs);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, workspace: result.workspace });
  }

  if (action.type === 'create_folder') {
    const current = await loadUserWorkspaceState(user.id, defaultWs);
    if (current.folders.some((f) => f.name.toLowerCase() === action.name.toLowerCase())) {
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
    const result = await persistCreateFolder(user.id, folder, defaultWs);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json(
      { ok: true, workspace: result.workspace, folder: result.folder },
      { status: 201 }
    );
  }

  if (action.type === 'delete_folder') {
    const current = await loadUserWorkspaceState(user.id, defaultWs);
    if (!current.folders.some((f) => f.id === action.folderId)) {
      return NextResponse.json({ ok: false, error: 'Research folder not found.' }, { status: 404 });
    }
    const result = await persistDeleteFolder(user.id, action.folderId, defaultWs);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, workspace: result.workspace });
  }

  if (action.type === 'create_comparison') {
    const current = await loadUserWorkspaceState(user.id, defaultWs);
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
    const result = await persistCreateComparison(user.id, project, defaultWs);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json(
      { ok: true, workspace: result.workspace, comparison: result.comparison },
      { status: 201 }
    );
  }

  if (action.type === 'update_comparison') {
    const current = await loadUserWorkspaceState(user.id, defaultWs);
    if (!current.comparisons.some((c) => c.id === action.id)) {
      return NextResponse.json({ ok: false, error: 'Comparison project not found.' }, { status: 404 });
    }
    const result = await persistUpdateComparison(
      user.id,
      {
        id: action.id,
        name: action.name,
        notes: action.notes,
        usernames: action.usernames,
      },
      defaultWs
    );
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, workspace: result.workspace });
  }

  if (action.type === 'delete_comparison') {
    const current = await loadUserWorkspaceState(user.id, defaultWs);
    if (!current.comparisons.some((c) => c.id === action.id)) {
      return NextResponse.json({ ok: false, error: 'Comparison project not found.' }, { status: 404 });
    }
    const result = await persistDeleteComparison(user.id, action.id, defaultWs);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, workspace: result.workspace });
  }

  if (action.type === 'mark_notification_read') {
    const result = await persistMarkNotificationRead(user.id, action.id, action.read, defaultWs);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, workspace: result.workspace });
  }

  if (action.type === 'mark_all_notifications_read') {
    const result = await persistMarkAllNotificationsRead(user.id, defaultWs);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, workspace: result.workspace });
  }

  if (action.type === 'create_workspace') {
    const current = await loadUserWorkspaceState(user.id, defaultWs);
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
    const result = await persistCreateWorkspace(user.id, action.name, defaultWs);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, workspace: result.workspace }, { status: 201 });
  }

  // update_settings
  const currentForSettings = await loadUserWorkspaceState(user.id, defaultWs);
  if (
    action.activeWorkspace !== undefined &&
    !currentForSettings.workspaces.includes(action.activeWorkspace)
  ) {
    return NextResponse.json(
      { ok: false, error: `Workspace "${action.activeWorkspace}" does not exist.` },
      { status: 400 }
    );
  }
  const settingsPatch: Record<string, unknown> = {};
  if (action.activeWorkspace !== undefined) settingsPatch.activeWorkspace = action.activeWorkspace;
  if (action.defaultSort !== undefined) settingsPatch.defaultSort = action.defaultSort;
  if (action.defaultDateRange !== undefined) settingsPatch.defaultDateRange = action.defaultDateRange;
  if (action.showTableByDefault !== undefined) settingsPatch.showTableByDefault = action.showTableByDefault;
  if (action.demoPreviewMode !== undefined) settingsPatch.demoPreviewMode = action.demoPreviewMode;

  const result = await persistDashboardSettings(user.id, settingsPatch, defaultWs);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, workspace: result.workspace });
}
