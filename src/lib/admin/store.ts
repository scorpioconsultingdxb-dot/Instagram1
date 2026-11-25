import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';

export interface FeatureFlagRecord {
  key: string;
  description: string;
  enabled: boolean;
  locked: boolean;
  updatedAt: string;
}

export interface CmsContentRecord {
  id: string;
  slug: string;
  locale: 'en' | 'pt-BR' | 'es' | 'de' | 'fr';
  contentType: 'announcement' | 'faq' | 'tool_guide' | 'disclosure';
  title: string;
  body: string;
  isPublished: boolean;
  updatedAt: string;
}

export interface SupportTicketRecord {
  id: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high';
  adminNotes: string;
  createdAt: string;
  isSample?: boolean;
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  diff: Record<string, unknown>;
  createdAt: string;
}

export interface ApiUsageMetric {
  providerId: string;
  requests24h: number;
  errorRatePercent: number;
  avgLatencyMs: number;
  isSample?: boolean;
}

export interface SearchAnalyticsMetric {
  normalizedUsername: string;
  searches24h: number;
  lastAvailability: 'available' | 'unavailable' | 'private_account';
  dataClass: 'live' | 'cached' | 'demo';
  isSample?: boolean;
}

export interface BroadcastNotificationRecord {
  id: string;
  title: string;
  body: string;
  category: 'system' | 'tracking' | 'report' | 'billing' | 'security';
  targetSegment: 'all' | 'personal' | 'business' | 'agency';
  isActive: boolean;
  createdAt: string;
}

interface PersistedAdminState {
  featureFlags: FeatureFlagRecord[];
  cmsItems: CmsContentRecord[];
  supportTickets: SupportTicketRecord[];
  broadcastNotifications: BroadcastNotificationRecord[];
  auditLogs: AuditLogRecord[];
  recordedSearchCounts: Record<string, SearchAnalyticsMetric>;
  recordedProviderCalls: Record<string, { requests: number; errors: number; totalLatencyMs: number }>;
}

const ADMIN_STORE = 'admin-store.json';

function createDefaultAdminState(): PersistedAdminState {
  return {
    featureFlags: [
      {
        key: 'payments_enabled',
        description:
          'Master switch for live Stripe billing. Locked false until explicit authorization.',
        enabled: false,
        locked: true,
        updatedAt: '2026-11-24T00:00:00.000Z',
      },
      {
        key: 'demo_provider_enabled',
        description: 'Serves clearly labeled demo fixtures when live providers are not configured.',
        enabled: true,
        locked: false,
        updatedAt: '2026-11-24T00:00:00.000Z',
      },
      {
        key: 'ai_insights_enabled',
        description: 'Enables structured AI profile reports in customer dashboard.',
        enabled: true,
        locked: false,
        updatedAt: '2026-11-24T00:00:00.000Z',
      },
      {
        key: 'ab_testing_enabled',
        description: 'Enables deterministic A/B conversion experiments.',
        enabled: true,
        locked: false,
        updatedAt: '2026-11-24T00:00:00.000Z',
      },
    ],
    cmsItems: [
      {
        id: 'cms-1',
        slug: 'data-transparency',
        locale: 'en',
        contentType: 'disclosure',
        title: 'Data Transparency Notice',
        body: 'Viewora only displays legitimately available public Instagram information or clearly labeled estimates and demo fixtures. Private accounts are never accessed.',
        isPublished: true,
        updatedAt: '2026-11-24T00:00:00.000Z',
      },
      {
        id: 'cms-2',
        slug: 'data-transparency',
        locale: 'pt-BR',
        contentType: 'disclosure',
        title: 'Aviso de Transparência de Dados',
        body: 'O Viewora exibe apenas informações públicas legitimamente disponíveis ou dados de demonstração rotulados. Contas privadas nunca são acessadas.',
        isPublished: true,
        updatedAt: '2026-11-24T00:00:00.000Z',
      },
      {
        id: 'cms-3',
        slug: 'story-limitations',
        locale: 'en',
        contentType: 'tool_guide',
        title: 'Story Viewer Availability Notice',
        body: 'Official Meta APIs limit Story access strictly to authorized account owners.',
        isPublished: true,
        updatedAt: '2026-11-24T00:00:00.000Z',
      },
    ],
    supportTickets: [
      {
        id: 'tkt-1001',
        email: 'business@viewora.demo',
        subject: 'Connecting official Meta Business Discovery credentials',
        message:
          'Could you share the required Meta Graph API permissions for Business Discovery?',
        status: 'open',
        priority: 'normal',
        adminNotes: '',
        createdAt: '2026-11-23T14:20:00.000Z',
        isSample: true,
      },
      {
        id: 'tkt-1002',
        email: 'agency@viewora.demo',
        subject: 'Adding additional client workspaces',
        message: 'We would like to configure 5 client workspaces under our Agency workspace.',
        status: 'in_progress',
        priority: 'high',
        adminNotes: 'Verified Agency entitlement allows up to 25 workspaces.',
        createdAt: '2026-11-23T18:05:00.000Z',
        isSample: true,
      },
    ],
    broadcastNotifications: [
      {
        id: 'bcast-1',
        title: 'Transparent Data Provenance Standard Active',
        body: 'All metrics, charts, and exports display LIVE, CACHED, ESTIMATED, DEMO, or UNAVAILABLE badges. Payments remain disabled.',
        category: 'system',
        targetSegment: 'all',
        isActive: true,
        createdAt: '2026-11-24T00:00:00.000Z',
      },
    ],
    auditLogs: [
      {
        id: 'aud-seed-1',
        actorId: 'system',
        actorEmail: 'system@viewora.local',
        action: 'system.seed_initialized',
        targetType: 'feature_flag',
        targetId: 'payments_enabled',
        diff: { enabled: false, locked: true },
        createdAt: '2026-11-24T00:00:00.000Z',
      },
    ],
    recordedSearchCounts: {},
    recordedProviderCalls: {},
  };
}

function loadAdminState(): PersistedAdminState {
  const state = readJsonStore<PersistedAdminState>(ADMIN_STORE, createDefaultAdminState);
  // Enforce invariant: payments_enabled is ALWAYS locked false
  const payFlag = state.featureFlags.find((f) => f.key === 'payments_enabled');
  if (payFlag) {
    payFlag.enabled = false;
    payFlag.locked = true;
  }
  return state;
}

const SAMPLE_API_USAGE: ApiUsageMetric[] = [
  { providerId: 'demo_fixture', requests24h: 142, errorRatePercent: 0, avgLatencyMs: 2, isSample: true },
  { providerId: 'meta_official', requests24h: 0, errorRatePercent: 0, avgLatencyMs: 0, isSample: true },
  { providerId: 'authorized_insights', requests24h: 0, errorRatePercent: 0, avgLatencyMs: 0, isSample: true },
  { providerId: 'licensed_third_party', requests24h: 0, errorRatePercent: 0, avgLatencyMs: 0, isSample: true },
  { providerId: 'permitted_public_dataset', requests24h: 0, errorRatePercent: 0, avgLatencyMs: 0, isSample: true },
];

const SAMPLE_SEARCH_ANALYTICS: SearchAnalyticsMetric[] = [
  { normalizedUsername: 'viewora.studio', searches24h: 64, lastAvailability: 'available', dataClass: 'demo', isSample: true },
  { normalizedUsername: 'aurora.coffee', searches24h: 38, lastAvailability: 'available', dataClass: 'demo', isSample: true },
  { normalizedUsername: 'nordic.design', searches24h: 24, lastAvailability: 'available', dataClass: 'demo', isSample: true },
  { normalizedUsername: 'private.sample', searches24h: 16, lastAvailability: 'private_account', dataClass: 'demo', isSample: true },
];

export function listFeatureFlags(): FeatureFlagRecord[] {
  return loadAdminState().featureFlags;
}

export function isFeatureFlagEnabled(key: string): boolean {
  if (key === 'payments_enabled') return false;
  const flag = listFeatureFlags().find((f) => f.key === key);
  return flag ? flag.enabled : true;
}

export function toggleFeatureFlag(
  key: string,
  enabled: boolean
): { ok: true; flag: FeatureFlagRecord } | { ok: false; error: string } {
  const current = loadAdminState();
  const target = current.featureFlags.find((f) => f.key === key);
  if (!target) return { ok: false, error: `Unknown feature flag: ${key}` };
  if (target.locked || key === 'payments_enabled') {
    return {
      ok: false,
      error: `Feature flag "${key}" is locked and cannot be toggled without explicit authorization.`,
    };
  }

  let updatedFlag!: FeatureFlagRecord;
  updateJsonStore(ADMIN_STORE, createDefaultAdminState, (state) => ({
    ...state,
    featureFlags: state.featureFlags.map((f) => {
      if (f.key === key) {
        updatedFlag = { ...f, enabled, updatedAt: new Date().toISOString() };
        return updatedFlag;
      }
      return f;
    }),
  }));
  return { ok: true, flag: updatedFlag };
}

export function listCmsContent(): CmsContentRecord[] {
  return loadAdminState().cmsItems;
}

export function getPublishedCmsBySlug(slug: string, locale: string): CmsContentRecord | null {
  const items = listCmsContent().filter((c) => c.slug === slug && c.isPublished);
  return items.find((c) => c.locale === locale) ?? items.find((c) => c.locale === 'en') ?? null;
}

export function updateCmsContent(
  id: string,
  patch: Partial<Pick<CmsContentRecord, 'title' | 'body' | 'isPublished'>>
): CmsContentRecord | null {
  let updated: CmsContentRecord | null = null;
  updateJsonStore(ADMIN_STORE, createDefaultAdminState, (state) => ({
    ...state,
    cmsItems: state.cmsItems.map((c) => {
      if (c.id === id) {
        updated = {
          ...c,
          title: typeof patch.title === 'string' ? patch.title : c.title,
          body: typeof patch.body === 'string' ? patch.body : c.body,
          isPublished: typeof patch.isPublished === 'boolean' ? patch.isPublished : c.isPublished,
          updatedAt: new Date().toISOString(),
        };
        return updated;
      }
      return c;
    }),
  }));
  return updated;
}

export function listSupportTickets(): SupportTicketRecord[] {
  return loadAdminState().supportTickets;
}

export function createSupportTicket(
  ticket: Omit<SupportTicketRecord, 'id' | 'createdAt' | 'status' | 'adminNotes'>
): SupportTicketRecord {
  const created: SupportTicketRecord = {
    ...ticket,
    id: `tkt-${Date.now().toString().slice(-6)}`,
    status: 'open',
    adminNotes: '',
    createdAt: new Date().toISOString(),
    isSample: false,
  };
  updateJsonStore(ADMIN_STORE, createDefaultAdminState, (state) => ({
    ...state,
    supportTickets: [created, ...state.supportTickets],
  }));
  return created;
}

export function updateSupportTicket(
  id: string,
  patch: Partial<Pick<SupportTicketRecord, 'status' | 'priority' | 'adminNotes'>>
): SupportTicketRecord | null {
  let updated: SupportTicketRecord | null = null;
  updateJsonStore(ADMIN_STORE, createDefaultAdminState, (state) => ({
    ...state,
    supportTickets: state.supportTickets.map((t) => {
      if (t.id === id) {
        updated = {
          ...t,
          status: patch.status ?? t.status,
          priority: patch.priority ?? t.priority,
          adminNotes: typeof patch.adminNotes === 'string' ? patch.adminNotes : t.adminNotes,
        };
        return updated;
      }
      return t;
    }),
  }));
  return updated;
}

export function listBroadcastNotifications(): BroadcastNotificationRecord[] {
  return loadAdminState().broadcastNotifications ?? [];
}

export function listActiveBroadcastNotifications(
  segment: 'personal' | 'business' | 'agency'
): BroadcastNotificationRecord[] {
  return listBroadcastNotifications().filter(
    (b) => b.isActive && (b.targetSegment === 'all' || b.targetSegment === segment)
  );
}

export function createBroadcastNotification(
  input: Omit<BroadcastNotificationRecord, 'id' | 'createdAt'>
): BroadcastNotificationRecord {
  const record: BroadcastNotificationRecord = {
    ...input,
    id: `bcast-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
  };
  updateJsonStore(ADMIN_STORE, createDefaultAdminState, (state) => ({
    ...state,
    broadcastNotifications: [record, ...(state.broadcastNotifications ?? [])],
  }));
  return record;
}

export function toggleBroadcastNotification(
  id: string,
  isActive: boolean
): BroadcastNotificationRecord | null {
  let updated: BroadcastNotificationRecord | null = null;
  updateJsonStore(ADMIN_STORE, createDefaultAdminState, (state) => ({
    ...state,
    broadcastNotifications: (state.broadcastNotifications ?? []).map((b) => {
      if (b.id === id) {
        updated = { ...b, isActive };
        return updated;
      }
      return b;
    }),
  }));
  return updated;
}

export function recordAuditLog(entry: Omit<AuditLogRecord, 'id' | 'createdAt'>): AuditLogRecord {
  const record: AuditLogRecord = {
    ...entry,
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  updateJsonStore(ADMIN_STORE, createDefaultAdminState, (state) => ({
    ...state,
    auditLogs: [record, ...state.auditLogs].slice(0, 500),
  }));
  return record;
}

export function listAuditLogs(): AuditLogRecord[] {
  return loadAdminState().auditLogs;
}

export function recordSearchMetric(params: {
  normalizedUsername: string;
  availability: 'available' | 'unavailable' | 'private_account';
  dataClass: 'live' | 'cached' | 'demo';
  providerId: string;
  latencyMs: number;
}): void {
  updateJsonStore(ADMIN_STORE, createDefaultAdminState, (state) => {
    const key = params.normalizedUsername.toLowerCase();
    const prevSearch = state.recordedSearchCounts?.[key];
    const prevProv = state.recordedProviderCalls?.[params.providerId] ?? {
      requests: 0,
      errors: 0,
      totalLatencyMs: 0,
    };

    return {
      ...state,
      recordedSearchCounts: {
        ...(state.recordedSearchCounts ?? {}),
        [key]: {
          normalizedUsername: key,
          searches24h: (prevSearch?.searches24h ?? 0) + 1,
          lastAvailability: params.availability,
          dataClass: params.dataClass,
          isSample: false,
        },
      },
      recordedProviderCalls: {
        ...(state.recordedProviderCalls ?? {}),
        [params.providerId]: {
          requests: prevProv.requests + 1,
          errors: prevProv.errors + (params.availability === 'unavailable' ? 1 : 0),
          totalLatencyMs: prevProv.totalLatencyMs + Math.max(0, params.latencyMs),
        },
      },
    };
  });
}

export function getApiUsageMetrics(): ApiUsageMetric[] {
  const recorded = loadAdminState().recordedProviderCalls ?? {};
  const entries = Object.entries(recorded);
  if (entries.length === 0) {
    return SAMPLE_API_USAGE;
  }
  return entries.map(([providerId, stat]) => ({
    providerId,
    requests24h: stat.requests,
    errorRatePercent:
      stat.requests > 0 ? Number(((stat.errors / stat.requests) * 100).toFixed(1)) : 0,
    avgLatencyMs: stat.requests > 0 ? Math.round(stat.totalLatencyMs / stat.requests) : 0,
    isSample: false,
  }));
}

export function getSearchAnalyticsMetrics(): SearchAnalyticsMetric[] {
  const recorded = Object.values(loadAdminState().recordedSearchCounts ?? {});
  if (recorded.length === 0) {
    return SAMPLE_SEARCH_ANALYTICS;
  }
  return recorded.sort((a, b) => b.searches24h - a.searches24h);
}
