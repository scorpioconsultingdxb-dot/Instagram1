import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  supabaseConfigured: false,
  touchedTables: [] as string[],
  failNextTable: null as string | null,
}));

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    isSupabaseConfigured: () => mockState.supabaseConfigured,
  };
});

function buildMockSupabase() {
  const makeBuilder = (table: string) => {
    mockState.touchedTables.push(table);
    const shouldFail = mockState.failNextTable === table;
    if (shouldFail) mockState.failNextTable = null;

    const okRow: Record<string, unknown> = (() => {
      switch (table) {
        case 'workspaces':
          return { id: 'ws-uuid-1', name: 'DB Workspace', is_default: true };
        case 'plans':
          return {
            id: 'plan-uuid-1',
            code: 'premium',
            name: 'Premium',
            description: 'DB Premium',
            monthly_price_cents: 2499,
            currency: 'USD',
            target_segment: 'business',
            display_order: 3,
            is_active: true,
            is_demo_pricing: true,
          };
        case 'plan_billing_options':
          return {
            plan_id: 'plan-uuid-1',
            billing_interval: 'annual',
            discount_percent: 35,
            is_active: true,
          };
        case 'plan_entitlements':
          return {
            plan_id: 'plan-uuid-1',
            feature_key: 'tracked_profiles',
            enabled: true,
            numeric_limit: 9,
          };
        case 'feature_flags':
          return {
            key: 'ai_insights_enabled',
            description: 'AI reports flag',
            enabled: false,
            locked: false,
            updated_at: '2026-11-25T00:00:00.000Z',
          };
        case 'cms_content':
          return {
            id: 'cms-uuid-1',
            slug: 'data-transparency',
            locale: 'en',
            content_type: 'disclosure',
            title: 'DB Disclosure',
            body: 'DB body',
            is_published: true,
            updated_at: '2026-11-25T00:00:00.000Z',
          };
        case 'support_tickets':
          return {
            id: 'tkt-uuid-1',
            email: 'user@viewora.demo',
            subject: 'DB Ticket',
            message: 'DB ticket body',
            status: 'resolved',
            priority: 'high',
            admin_notes: 'Handled in DB',
            created_at: '2026-11-25T00:00:00.000Z',
          };
        case 'audit_logs':
          return {
            id: 'aud-uuid-1',
            actor_id: '00000000-0000-0000-0000-000000000001',
            action: 'admin.test',
            target_type: 'plan',
            target_id: 'premium',
            diff: { _actorEmail: 'admin@viewora.demo' },
            created_at: '2026-11-25T00:00:00.000Z',
          };
        case 'funnel_events':
          return {
            id: 'evt-uuid-1',
            event_name: 'pricing_viewed',
            locale: 'de',
            session_id: 'sess-db-1',
            user_id: null,
            properties: { tier: 'premium' },
            created_at: '2026-11-25T00:00:00.000Z',
          };
        case 'saved_profiles':
          return {
            id: 'sp-uuid-1',
            workspace_id: 'ws-uuid-1',
            username: 'viewora.studio',
            display_name: 'Viewora Studio',
            category: 'SaaS',
            is_demo: true,
            data_source: 'demo_fixture',
            notes: 'DB note',
            tags: ['db'],
            folder_id: null,
            created_at: '2026-11-25T00:00:00.000Z',
            updated_at: '2026-11-25T00:00:00.000Z',
          };
        case 'competitor_sets':
          return {
            id: 'cmp-uuid-1',
            name: 'DB Competitor Set',
            usernames: ['viewora.studio', 'aurora.coffee'],
            created_at: '2026-11-25T00:00:00.000Z',
            updated_at: '2026-11-25T00:00:00.000Z',
          };
        case 'notifications':
          return {
            id: 'notif-uuid-1',
            title: 'DB Notification',
            body: 'Hello from Postgres',
            category: 'system',
            is_read: true,
            action_url: '/dashboard',
            created_at: '2026-11-25T00:00:00.000Z',
          };
        default:
          return { id: 'row-uuid-1' };
      }
    })();

    const listResult = shouldFail
      ? { data: null, error: { message: `Simulated ${table} failure` } }
      : { data: [okRow], error: null };
    const singleResult = shouldFail
      ? { data: null, error: { message: `Simulated ${table} failure` } }
      : { data: okRow, error: null };

    const builder: Record<string, unknown> = {
      select: () => builder,
      insert: () => builder,
      update: () => builder,
      upsert: () => builder,
      delete: () => builder,
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      single: () => Promise.resolve(singleResult),
      maybeSingle: () => Promise.resolve(singleResult),
      then: (
        onFulfilled: (value: typeof listResult) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(listResult).then(onFulfilled, onRejected),
    };
    return builder;
  };

  return {
    from: (table: string) => makeBuilder(table),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => buildMockSupabase(),
  createSupabaseAdminClient: () => buildMockSupabase(),
}));

import {
  loadConfiguredPlans,
  persistConfiguredPlan,
  persistPlanEntitlement,
  resetConfiguredPlansToDefaults,
} from '@/lib/entitlements/service';
import {
  loadAuditLogs,
  loadCmsContent,
  loadFeatureFlags,
  loadSupportTickets,
  persistAuditLog,
  persistCmsContentUpdate,
  persistFeatureFlagToggle,
  persistSupportTicketCreate,
  persistSupportTicketUpdate,
} from '@/lib/admin/store';
import { loadFunnelSummary, persistFunnelEvent } from '@/lib/analytics/funnel';
import {
  loadUserWorkspaceState,
  persistCreateComparison,
  persistMarkNotificationRead,
  persistSavedProfile,
  type SavedProfileRecord,
} from '@/lib/dashboard/store';

describe('Database-backed persistence alignment (Supabase Postgres + local JSON fallback)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viewora-db-align-'));
    process.env.VIEWORA_DATA_DIR = tmpDir;
  });

  beforeEach(() => {
    mockState.supabaseConfigured = false;
    mockState.touchedTables = [];
    mockState.failNextTable = null;
  });

  afterAll(() => {
    delete process.env.VIEWORA_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('supports numeric & unlimited entitlement limit updates across all 13 feature keys in local mode', async () => {
    resetConfiguredPlansToDefaults();
    expect(await persistPlanEntitlement('starter', 'tracked_profiles', true, 7)).toBe(true);
    expect(await persistPlanEntitlement('starter', 'follower_trends', true, 60)).toBe(true);
    expect(await persistPlanEntitlement('starter', 'influencer_research', true, null)).toBe(true);
    expect(await persistPlanEntitlement('starter', 'email_notifications', false, 0)).toBe(true);

    const plans = await loadConfiguredPlans();
    const starter = plans.find((p) => p.code === 'starter')!;
    expect(starter.entitlements.tracked_profiles).toEqual({ enabled: true, numericLimit: 7 });
    expect(starter.entitlements.follower_trends).toEqual({ enabled: true, numericLimit: 60 });
    expect(starter.entitlements.influencer_research).toEqual({ enabled: true, numericLimit: null });
    expect(starter.entitlements.email_notifications).toEqual({ enabled: false, numericLimit: 0 });
    resetConfiguredPlansToDefaults();
  });

  it('routes plan & entitlement persistence through plans, plan_billing_options, and plan_entitlements when Supabase is configured', async () => {
    mockState.supabaseConfigured = true;
    const plans = await loadConfiguredPlans();
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0]!.entitlements.tracked_profiles.numericLimit).toBe(9);
    expect(mockState.touchedTables).toEqual(
      expect.arrayContaining(['plans', 'plan_billing_options', 'plan_entitlements'])
    );

    mockState.touchedTables = [];
    const updatedPlan = await persistConfiguredPlan('premium', {
      monthlyPriceCents: 2499,
      annualDiscount: 35,
    });
    expect(updatedPlan?.monthlyPriceCents).toBe(2499);
    expect(mockState.touchedTables).toEqual(
      expect.arrayContaining(['plans', 'plan_billing_options'])
    );

    mockState.touchedTables = [];
    const ok = await persistPlanEntitlement('premium', 'tracked_profiles', true, 12);
    expect(ok).toBe(true);
    expect(mockState.touchedTables).toContain('plan_entitlements');
  });

  it('routes admin & funnel persistence through feature_flags, cms_content, support_tickets, audit_logs, and funnel_events when Supabase is configured', async () => {
    mockState.supabaseConfigured = true;

    // Locked payments_enabled must still be refused even when Supabase is configured
    const lockedRes = await persistFeatureFlagToggle('payments_enabled', true);
    expect(lockedRes.ok).toBe(false);

    const flags = await loadFeatureFlags();
    expect(flags[0]!.key).toBe('ai_insights_enabled');
    const toggleRes = await persistFeatureFlagToggle('ai_insights_enabled', true);
    expect(toggleRes.ok).toBe(true);

    const cms = await loadCmsContent();
    expect(cms[0]!.title).toBe('DB Disclosure');
    const cmsUpd = await persistCmsContentUpdate('cms-uuid-1', { title: 'Updated' });
    expect(cmsUpd?.id).toBe('cms-uuid-1');

    const createdTkt = await persistSupportTicketCreate({
      email: 'user@viewora.demo',
      subject: 'Need help',
      message: 'Details here',
      priority: 'high',
    });
    expect(createdTkt.id).toBe('tkt-uuid-1');
    const tickets = await loadSupportTickets();
    expect(tickets[0]!.id).toBe('tkt-uuid-1');
    const updTkt = await persistSupportTicketUpdate('tkt-uuid-1', { status: 'resolved' });
    expect(updTkt?.status).toBe('resolved');

    const audit = await persistAuditLog({
      actorId: '00000000-0000-0000-0000-000000000001',
      actorEmail: 'admin@viewora.demo',
      action: 'admin.test',
      targetType: 'plan',
      targetId: 'premium',
      diff: {},
    });
    expect(audit.id).toBe('aud-uuid-1');
    const logs = await loadAuditLogs();
    expect(logs[0]!.id).toBe('aud-uuid-1');

    const evt = await persistFunnelEvent({
      eventName: 'pricing_viewed',
      locale: 'de',
      sessionId: 'sess-db-1',
    });
    expect(evt.id).toBe('evt-uuid-1');
    const summary = await loadFunnelSummary();
    expect(summary.counts.pricing_viewed).toBe(1);

    expect(mockState.touchedTables).toEqual(
      expect.arrayContaining([
        'feature_flags',
        'cms_content',
        'support_tickets',
        'audit_logs',
        'funnel_events',
      ])
    );
  });

  it('routes dashboard persistence through saved_profiles, competitor_sets, and notifications and propagates DB write errors honestly', async () => {
    mockState.supabaseConfigured = true;

    const ws = await loadUserWorkspaceState('user-uuid-1');
    expect(ws.savedProfiles[0]?.username).toBe('viewora.studio');
    expect(ws.comparisons[0]?.name).toBe('DB Competitor Set');
    expect(ws.notifications[0]?.read).toBe(true);

    const sampleRecord: SavedProfileRecord = {
      id: 'sp-local',
      username: 'viewora.studio',
      profile: ws.savedProfiles[0]!.profile,
      dataClass: 'demo',
      providerLabel: 'demo_fixture',
      workspace: 'DB Workspace',
      folderId: null,
      tags: ['benchmark'],
      privateNote: 'Saved',
      savedAt: '2026-11-25T00:00:00.000Z',
      updatedAt: '2026-11-25T00:00:00.000Z',
    };

    const saveRes = await persistSavedProfile('user-uuid-1', sampleRecord);
    expect(saveRes.ok).toBe(true);

    const cmpRes = await persistCreateComparison('user-uuid-1', {
      id: 'cmp-local',
      name: 'DB Competitor Set',
      description: '',
      usernames: ['viewora.studio', 'aurora.coffee'],
      notes: '',
      createdAt: '2026-11-25T00:00:00.000Z',
      updatedAt: '2026-11-25T00:00:00.000Z',
    });
    expect(cmpRes.ok).toBe(true);

    const notifRes = await persistMarkNotificationRead('user-uuid-1', 'notif-uuid-1', true);
    expect(notifRes.ok).toBe(true);

    expect(mockState.touchedTables).toEqual(
      expect.arrayContaining(['saved_profiles', 'competitor_sets', 'notifications'])
    );

    // Verify DB write error does NOT falsely report ok: true
    mockState.failNextTable = 'notifications';
    const failRes = await persistMarkNotificationRead('user-uuid-1', 'notif-uuid-1', false);
    expect(failRes.ok).toBe(false);
  });
});
