import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteAccountProfilePrefs,
  getAccountProfilePrefs,
  profilePatchSchema,
  saveAccountProfilePrefs,
} from '@/lib/auth/profile-prefs';
import {
  deleteUserWorkspaceState,
  getUserWorkspaceState,
  getWorkspaceUsageStats,
  recordExportHistory,
  recordSavedAiReport,
  updateUserWorkspaceState,
} from '@/lib/dashboard/store';
import {
  getConfiguredPlans,
  resetConfiguredPlansToDefaults,
  updateConfiguredPlan,
} from '@/lib/entitlements/service';
import {
  createBroadcastNotification,
  createSupportTicket,
  getPublishedCmsBySlug,
  getSearchAnalyticsMetrics,
  isFeatureFlagEnabled,
  listActiveBroadcastNotifications,
  listCmsContent,
  listSupportTickets,
  recordSearchMetric,
  toggleFeatureFlag,
  updateCmsContent,
  updateSupportTicket,
} from '@/lib/admin/store';
import { getFunnelSummary, recordFunnelEvent } from '@/lib/analytics/funnel';
import { hasAdminCapability } from '@/lib/admin/rbac';
import { deriveLocalUserId, sanitizeRedirectPath } from '@/lib/auth/session';

describe('Durable Persistence, Personal HQ, Workspace, Plans & Admin RBAC', () => {
  let tempDir: string;
  const prevDir = process.env.VIEWORA_DATA_DIR;
  const prevDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewora-test-data-'));
    process.env.VIEWORA_DATA_DIR = tempDir;
    // Isolate local file-store unit tests from ambient PostgreSQL DATABASE_URL (PostgreSQL is tested in test:db)
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (prevDir === undefined) {
      delete process.env.VIEWORA_DATA_DIR;
    } else {
      process.env.VIEWORA_DATA_DIR = prevDir;
    }
    if (prevDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = prevDatabaseUrl;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('persists Personal Digital HQ preferences durably and isolates users', async () => {
    const saveRes = await saveAccountProfilePrefs('user-alpha', {
      fullName: 'Elena Vance',
      professionalTitle: 'Head of Brand Intelligence',
      organization: 'Northstar Labs',
      avatarPreset: 'custom-emoji',
      avatarEmoji: 'EV',
      coverPreset: 'sunset',
      preferredLocale: 'de',
      dashboardDensity: 'compact',
      sidebarDefaultCollapsed: true,
      workspaceName: 'Northstar HQ',
      personalShortcuts: [{ id: 's1', label: 'Analytics', href: '/dashboard/analytics' }],
    });
    expect(saveRes.ok).toBe(true);

    const loadedAlpha = await getAccountProfilePrefs('user-alpha');
    expect(loadedAlpha.professionalTitle).toBe('Head of Brand Intelligence');
    expect(loadedAlpha.coverPreset).toBe('sunset');
    expect(loadedAlpha.preferredLocale).toBe('de');
    expect(loadedAlpha.dashboardDensity).toBe('compact');
    expect(loadedAlpha.personalShortcuts).toHaveLength(1);

    // Separate user sees clean defaults, never user-alpha's private fields
    const loadedBeta = await getAccountProfilePrefs('user-beta');
    expect(loadedBeta.workspaceName).toBe('Primary Workspace');
    expect(loadedBeta.coverPreset).toBe('aurora');
  });

  it('rejects unsafe external redirect paths in shortcuts and login redirects', () => {
    const badShortcut = profilePatchSchema.safeParse({
      personalShortcuts: [{ id: 'x', label: 'Evil', href: 'https://evil.example' }],
    });
    expect(badShortcut.success).toBe(false);

    expect(sanitizeRedirectPath('//evil.com/phish')).toBe('/en/dashboard');
    expect(sanitizeRedirectPath('https://evil.com')).toBe('/en/dashboard');
    expect(sanitizeRedirectPath('/de/dashboard/analytics')).toBe('/de/dashboard/analytics');
  });

  it('initializes real user workspaces cleanly with zero forced demo profiles and persists folders, notes, reports & exports', () => {
    const initial = getUserWorkspaceState('real-customer-1');
    expect(initial.savedProfiles).toHaveLength(0);
    expect(initial.settings.demoPreviewMode).toBe(false);

    updateUserWorkspaceState('real-customer-1', (ws) => ({
      ...ws,
      folders: [
        ...ws.folders,
        {
          id: 'fld-comp',
          name: 'Q4 Competitors',
          color: 'cyan',
          description: 'Primary peers',
          createdAt: new Date().toISOString(),
        },
      ],
      notifications: ws.notifications.map((n) => ({ ...n, read: true })),
    }));

    recordSavedAiReport('real-customer-1', {
      reportType: 'profile_performance',
      username: 'viewora.studio',
      dataClass: 'demo',
      executionMode: 'template_fallback',
      modelName: 'deterministic-template-v1',
      promptVersion: 'v1',
      sourceLabel: 'Viewora Demo Fixtures',
      executiveSummary: 'Summary text',
      keyFindings: ['Finding 1'],
      recommendations: ['Rec 1'],
      dataLimitations: ['Demo fixture'],
      generatedAt: new Date().toISOString(),
      usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    });

    recordExportHistory('real-customer-1', {
      username: 'viewora.studio',
      format: 'pdf',
      dataClass: 'demo',
    });

    const reloaded = getUserWorkspaceState('real-customer-1');
    expect(reloaded.folders.some((f) => f.name === 'Q4 Competitors')).toBe(true);
    expect(reloaded.notifications.every((n) => n.read)).toBe(true);
    expect(reloaded.reports).toHaveLength(1);
    expect(reloaded.exports).toHaveLength(1);

    const stats = getWorkspaceUsageStats('real-customer-1');
    expect(stats.foldersCount).toBe(2);
    expect(stats.reportsCount).toBe(1);
    expect(stats.exportsCount).toBe(1);
    expect(stats.unreadNotificationsCount).toBe(0);
  });

  it('persists synchronized 5-tier plan updates cleanly and restores defaults', () => {
    const updated = updateConfiguredPlan('premium', { annualDiscount: 35 });
    expect(updated).not.toBeNull();
    const plans = getConfiguredPlans();
    const premium = plans.find((p) => p.code === 'premium');
    const annual = premium?.billingOptions.find((o) => o.interval === 'annual');
    expect(annual?.discountPercent).toBe(35);

    resetConfiguredPlansToDefaults();
    const resetPremium = getConfiguredPlans().find((p) => p.code === 'premium');
    expect(resetPremium?.billingOptions.find((o) => o.interval === 'annual')?.discountPercent).toBe(
      30
    );
  });

  it('persists admin CMS edits, support tickets, broadcasts, search metrics, and enforces least-privilege RBAC', () => {
    // Least-privilege capability matrix
    expect(hasAdminCapability('analyst', 'manage_plans')).toBe(false);
    expect(hasAdminCapability('support_agent', 'manage_support')).toBe(true);
    expect(hasAdminCapability('support_agent', 'manage_roles')).toBe(false);
    expect(hasAdminCapability('content_manager', 'manage_cms')).toBe(true);
    expect(hasAdminCapability('content_manager', 'manage_flags')).toBe(false);
    expect(hasAdminCapability('super_admin', 'manage_roles')).toBe(true);

    // Payments flag remains strictly locked
    expect(toggleFeatureFlag('payments_enabled', true).ok).toBe(false);
    expect(toggleFeatureFlag('ab_testing_enabled', false).ok).toBe(true);

    // CMS edit persists
    const cms = listCmsContent()[0]!;
    updateCmsContent(cms.id, { title: 'Updated Data Transparency Standard' });
    expect(listCmsContent().find((c) => c.id === cms.id)?.title).toBe(
      'Updated Data Transparency Standard'
    );

    // Support ticket creation + admin note persists
    const tkt = createSupportTicket({
      email: 'alice@example.com',
      subject: 'Need help with CSV export',
      message: 'Please explain which tier unlocks CSV exports.',
      priority: 'normal',
    });
    updateSupportTicket(tkt.id, { status: 'resolved', adminNotes: 'Explained Pro+ entitlement.' });
    const reloadedTicket = listSupportTickets().find((t) => t.id === tkt.id);
    expect(reloadedTicket?.status).toBe('resolved');
    expect(reloadedTicket?.adminNotes).toBe('Explained Pro+ entitlement.');

    // Broadcast notification targeting
    createBroadcastNotification({
      title: 'Agency Workspace Update',
      body: 'Multi-client workspace switcher is now live.',
      category: 'system',
      targetSegment: 'agency',
      isActive: true,
    });
    expect(listActiveBroadcastNotifications('agency').some((b) => b.title === 'Agency Workspace Update')).toBe(true);
    expect(listActiveBroadcastNotifications('personal').some((b) => b.title === 'Agency Workspace Update')).toBe(false);

    // Recorded runtime metrics replace sample baseline
    recordSearchMetric({
      normalizedUsername: 'viewora.studio',
      availability: 'available',
      dataClass: 'demo',
      providerId: 'demo_fixture',
      latencyMs: 4,
    });
    const metrics = getSearchAnalyticsMetrics();
    expect(metrics[0]?.isSample).toBe(false);
    expect(metrics[0]?.normalizedUsername).toBe('viewora.studio');
  });

  it('derives collision-free local user IDs for emails sharing a prefix and purges deleted account data', async () => {
    const idA = deriveLocalUserId('founder@alpha.example');
    const idB = deriveLocalUserId('founder@beta.example');
    expect(idA).not.toBe(idB);
    expect(deriveLocalUserId('FOUNDER@alpha.example')).toBe(idA);

    await saveAccountProfilePrefs(idA, {
      professionalTitle: 'Temporary Title',
      workspaceName: 'Temp Space',
    });
    updateUserWorkspaceState(idA, (ws) => ({
      ...ws,
      folders: [
        ...ws.folders,
        {
          id: 'fld-temp',
          name: 'Private Folder',
          color: 'amber',
          description: '',
          createdAt: new Date().toISOString(),
        },
      ],
    }));

    deleteAccountProfilePrefs(idA);
    deleteUserWorkspaceState(idA);

    const purgedPrefs = await getAccountProfilePrefs(idA);
    expect(purgedPrefs.workspaceName).toBe('Primary Workspace');
    const purgedWs = getUserWorkspaceState(idA);
    expect(purgedWs.folders.some((f) => f.id === 'fld-temp')).toBe(false);
  });

  it('enforces feature flags, resolves published CMS content by slug, and persists funnel events durably', () => {
    expect(isFeatureFlagEnabled('payments_enabled')).toBe(false);
    expect(toggleFeatureFlag('ai_insights_enabled', false).ok).toBe(true);
    expect(isFeatureFlagEnabled('ai_insights_enabled')).toBe(false);
    expect(toggleFeatureFlag('ai_insights_enabled', true).ok).toBe(true);
    expect(isFeatureFlagEnabled('ai_insights_enabled')).toBe(true);

    const published = getPublishedCmsBySlug('data-transparency', 'pt-BR');
    expect(published?.locale).toBe('pt-BR');

    const baselineFunnel = getFunnelSummary();
    expect(baselineFunnel.isSample).toBe(true);
    recordFunnelEvent({
      eventName: 'signup_completed',
      locale: 'en',
      sessionId: 'sess-test',
      userId: 'u-1',
    });
    const recordedFunnel = getFunnelSummary();
    expect(recordedFunnel.isSample).toBe(false);
    expect(recordedFunnel.counts.signup_completed).toBe(1);
  });
});
