import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
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

// ============================================================================
// Database-Backed Async Admin Persistence (Supabase Postgres + Local Fallback)
// ============================================================================

async function getSupabaseForAdmin() {
  return createSupabaseAdminClient() ?? (await createSupabaseServerClient());
}

export async function loadFeatureFlags(): Promise<FeatureFlagRecord[]> {
  if (!isSupabaseConfigured()) return listFeatureFlags();
  try {
    const supabase = await getSupabaseForAdmin();
    if (!supabase) return listFeatureFlags();
    const { data, error } = await supabase
      .from('feature_flags')
      .select('key, description, enabled, locked, updated_at')
      .order('key', { ascending: true });
    if (error || !data || data.length === 0) return listFeatureFlags();
    return (data as Array<Record<string, unknown>>).map((row) => {
      const key = String(row.key);
      const isPayments = key === 'payments_enabled';
      return {
        key,
        description: String(row.description ?? ''),
        enabled: isPayments ? false : Boolean(row.enabled),
        locked: isPayments ? true : Boolean(row.locked),
        updatedAt: String(row.updated_at ?? new Date().toISOString()),
      };
    });
  } catch {
    return listFeatureFlags();
  }
}

export async function loadIsFeatureFlagEnabled(key: string): Promise<boolean> {
  if (key === 'payments_enabled') return false;
  const flags = await loadFeatureFlags();
  const found = flags.find((f) => f.key === key);
  return found ? found.enabled : true;
}

export async function persistFeatureFlagToggle(
  key: string,
  enabled: boolean,
  updatedBy?: string
): Promise<{ ok: true; flag: FeatureFlagRecord } | { ok: false; error: string }> {
  if (key === 'payments_enabled') {
    return {
      ok: false,
      error: `Feature flag "${key}" is locked and cannot be toggled without explicit authorization.`,
    };
  }
  if (!isSupabaseConfigured()) {
    return toggleFeatureFlag(key, enabled);
  }
  const supabase = await getSupabaseForAdmin();
  if (!supabase) return toggleFeatureFlag(key, enabled);

  const { data: existing, error: fetchErr } = await supabase
    .from('feature_flags')
    .select('key, description, enabled, locked, updated_at')
    .eq('key', key)
    .maybeSingle();

  if (fetchErr || !existing) {
    return { ok: false, error: `Unknown feature flag: ${key}` };
  }
  if (existing.locked) {
    return {
      ok: false,
      error: `Feature flag "${key}" is locked and cannot be toggled without explicit authorization.`,
    };
  }

  const updatePayload: Record<string, unknown> = { enabled };
  if (updatedBy) updatePayload.updated_by = updatedBy;

  const { data: updated, error: updateErr } = await supabase
    .from('feature_flags')
    .update(updatePayload)
    .eq('key', key)
    .select('key, description, enabled, locked, updated_at')
    .single();

  if (updateErr || !updated) {
    return { ok: false, error: updateErr?.message ?? 'Failed to persist feature flag.' };
  }

  return {
    ok: true,
    flag: {
      key: String(updated.key),
      description: String(updated.description ?? ''),
      enabled: Boolean(updated.enabled),
      locked: Boolean(updated.locked),
      updatedAt: String(updated.updated_at ?? new Date().toISOString()),
    },
  };
}

export async function loadCmsContent(): Promise<CmsContentRecord[]> {
  if (!isSupabaseConfigured()) return listCmsContent();
  try {
    const supabase = await getSupabaseForAdmin();
    if (!supabase) return listCmsContent();
    const { data, error } = await supabase
      .from('cms_content')
      .select('id, slug, locale, content_type, title, body, is_published, updated_at')
      .order('updated_at', { ascending: false });
    if (error || !data || data.length === 0) return listCmsContent();
    return (data as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      locale: row.locale as CmsContentRecord['locale'],
      contentType: row.content_type as CmsContentRecord['contentType'],
      title: String(row.title),
      body: String(row.body),
      isPublished: Boolean(row.is_published),
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    }));
  } catch {
    return listCmsContent();
  }
}

export async function persistCmsContentUpdate(
  id: string,
  patch: Partial<Pick<CmsContentRecord, 'title' | 'body' | 'isPublished'>>,
  updatedBy?: string
): Promise<CmsContentRecord | null> {
  if (!isSupabaseConfigured()) {
    return updateCmsContent(id, patch);
  }
  const supabase = await getSupabaseForAdmin();
  if (!supabase) return updateCmsContent(id, patch);

  const dbPatch: Record<string, unknown> = {};
  if (typeof patch.title === 'string') dbPatch.title = patch.title;
  if (typeof patch.body === 'string') dbPatch.body = patch.body;
  if (typeof patch.isPublished === 'boolean') dbPatch.is_published = patch.isPublished;
  if (updatedBy) dbPatch.updated_by = updatedBy;

  const { data, error } = await supabase
    .from('cms_content')
    .update(dbPatch)
    .eq('id', id)
    .select('id, slug, locale, content_type, title, body, is_published, updated_at')
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: String(data.id),
    slug: String(data.slug),
    locale: data.locale as CmsContentRecord['locale'],
    contentType: data.content_type as CmsContentRecord['contentType'],
    title: String(data.title),
    body: String(data.body),
    isPublished: Boolean(data.is_published),
    updatedAt: String(data.updated_at ?? new Date().toISOString()),
  };
}

export async function loadSupportTickets(): Promise<SupportTicketRecord[]> {
  if (!isSupabaseConfigured()) return listSupportTickets();
  try {
    const supabase = await getSupabaseForAdmin();
    if (!supabase) return listSupportTickets();
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, email, subject, message, status, priority, admin_notes, created_at')
      .order('created_at', { ascending: false });
    if (error || !data) return listSupportTickets();
    return (data as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      email: String(row.email),
      subject: String(row.subject),
      message: String(row.message),
      status: row.status as SupportTicketRecord['status'],
      priority: row.priority as SupportTicketRecord['priority'],
      adminNotes: String(row.admin_notes ?? ''),
      createdAt: String(row.created_at ?? new Date().toISOString()),
      isSample: false,
    }));
  } catch {
    return listSupportTickets();
  }
}

export async function persistSupportTicketCreate(
  ticket: Omit<SupportTicketRecord, 'id' | 'createdAt' | 'status' | 'adminNotes'> & {
    userId?: string | null;
  }
): Promise<SupportTicketRecord> {
  if (!isSupabaseConfigured()) {
    return createSupportTicket(ticket);
  }
  const supabase = await getSupabaseForAdmin();
  if (!supabase) return createSupportTicket(ticket);

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: ticket.userId ?? null,
      email: ticket.email,
      subject: ticket.subject,
      message: ticket.message,
      priority: ticket.priority,
      status: 'open',
      admin_notes: '',
    })
    .select('id, email, subject, message, status, priority, admin_notes, created_at')
    .single();

  if (error || !data) {
    return createSupportTicket(ticket);
  }
  return {
    id: String(data.id),
    email: String(data.email),
    subject: String(data.subject),
    message: String(data.message),
    status: data.status as SupportTicketRecord['status'],
    priority: data.priority as SupportTicketRecord['priority'],
    adminNotes: String(data.admin_notes ?? ''),
    createdAt: String(data.created_at ?? new Date().toISOString()),
    isSample: false,
  };
}

export async function persistSupportTicketUpdate(
  id: string,
  patch: Partial<Pick<SupportTicketRecord, 'status' | 'priority' | 'adminNotes'>>
): Promise<SupportTicketRecord | null> {
  if (!isSupabaseConfigured()) {
    return updateSupportTicket(id, patch);
  }
  const supabase = await getSupabaseForAdmin();
  if (!supabase) return updateSupportTicket(id, patch);

  const dbPatch: Record<string, unknown> = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.priority !== undefined) dbPatch.priority = patch.priority;
  if (typeof patch.adminNotes === 'string') dbPatch.admin_notes = patch.adminNotes;

  const { data, error } = await supabase
    .from('support_tickets')
    .update(dbPatch)
    .eq('id', id)
    .select('id, email, subject, message, status, priority, admin_notes, created_at')
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: String(data.id),
    email: String(data.email),
    subject: String(data.subject),
    message: String(data.message),
    status: data.status as SupportTicketRecord['status'],
    priority: data.priority as SupportTicketRecord['priority'],
    adminNotes: String(data.admin_notes ?? ''),
    createdAt: String(data.created_at ?? new Date().toISOString()),
    isSample: false,
  };
}

export async function loadBroadcastNotifications(): Promise<BroadcastNotificationRecord[]> {
  if (!isSupabaseConfigured()) return listBroadcastNotifications();
  try {
    const supabase = await getSupabaseForAdmin();
    if (!supabase) return listBroadcastNotifications();
    const { data, error } = await supabase
      .from('broadcast_notifications')
      .select('id, title, body, category, target_segment, is_active, created_at')
      .order('created_at', { ascending: false });
    if (error || !data) return listBroadcastNotifications();
    return (data as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      body: String(row.body),
      category: row.category as BroadcastNotificationRecord['category'],
      targetSegment: row.target_segment as BroadcastNotificationRecord['targetSegment'],
      isActive: Boolean(row.is_active),
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }));
  } catch {
    return listBroadcastNotifications();
  }
}

export async function loadActiveBroadcastNotifications(
  segment: 'personal' | 'business' | 'agency'
): Promise<BroadcastNotificationRecord[]> {
  const all = await loadBroadcastNotifications();
  return all.filter((b) => b.isActive && (b.targetSegment === 'all' || b.targetSegment === segment));
}

export async function persistBroadcastCreate(
  input: Omit<BroadcastNotificationRecord, 'id' | 'createdAt'> & { createdBy?: string }
): Promise<BroadcastNotificationRecord> {
  if (!isSupabaseConfigured()) {
    return createBroadcastNotification(input);
  }
  const supabase = await getSupabaseForAdmin();
  if (!supabase) return createBroadcastNotification(input);

  const { data, error } = await supabase
    .from('broadcast_notifications')
    .insert({
      title: input.title,
      body: input.body,
      category: input.category,
      target_segment: input.targetSegment,
      is_active: input.isActive,
      created_by: input.createdBy ?? null,
    })
    .select('id, title, body, category, target_segment, is_active, created_at')
    .single();

  if (error || !data) return createBroadcastNotification(input);
  return {
    id: String(data.id),
    title: String(data.title),
    body: String(data.body),
    category: data.category as BroadcastNotificationRecord['category'],
    targetSegment: data.target_segment as BroadcastNotificationRecord['targetSegment'],
    isActive: Boolean(data.is_active),
    createdAt: String(data.created_at ?? new Date().toISOString()),
  };
}

export async function persistBroadcastToggle(
  id: string,
  isActive: boolean
): Promise<BroadcastNotificationRecord | null> {
  if (!isSupabaseConfigured()) {
    return toggleBroadcastNotification(id, isActive);
  }
  const supabase = await getSupabaseForAdmin();
  if (!supabase) return toggleBroadcastNotification(id, isActive);

  const { data, error } = await supabase
    .from('broadcast_notifications')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id, title, body, category, target_segment, is_active, created_at')
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: String(data.id),
    title: String(data.title),
    body: String(data.body),
    category: data.category as BroadcastNotificationRecord['category'],
    targetSegment: data.target_segment as BroadcastNotificationRecord['targetSegment'],
    isActive: Boolean(data.is_active),
    createdAt: String(data.created_at ?? new Date().toISOString()),
  };
}

export async function loadAuditLogs(): Promise<AuditLogRecord[]> {
  if (!isSupabaseConfigured()) return listAuditLogs();
  try {
    const supabase = await getSupabaseForAdmin();
    if (!supabase) return listAuditLogs();
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, actor_id, action, target_type, target_id, diff, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error || !data) return listAuditLogs();
    return (data as Array<Record<string, unknown>>).map((row) => {
      const diff = (row.diff as Record<string, unknown> | null) ?? {};
      const actorEmail =
        typeof diff._actorEmail === 'string'
          ? diff._actorEmail
          : String(row.actor_id ?? 'system@viewora.local');
      return {
        id: String(row.id),
        actorId: String(row.actor_id ?? 'system'),
        actorEmail,
        action: String(row.action),
        targetType: String(row.target_type),
        targetId: String(row.target_id ?? ''),
        diff,
        createdAt: String(row.created_at ?? new Date().toISOString()),
      };
    });
  } catch {
    return listAuditLogs();
  }
}

export async function persistAuditLog(
  entry: Omit<AuditLogRecord, 'id' | 'createdAt'>
): Promise<AuditLogRecord> {
  if (!isSupabaseConfigured()) {
    return recordAuditLog(entry);
  }
  const supabase = await getSupabaseForAdmin();
  if (!supabase) return recordAuditLog(entry);

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      actor_id: uuidRegex.test(entry.actorId) ? entry.actorId : null,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      diff: { ...entry.diff, _actorEmail: entry.actorEmail },
    })
    .select('id, actor_id, action, target_type, target_id, diff, created_at')
    .single();

  if (error || !data) {
    return recordAuditLog(entry);
  }

  return {
    id: String(data.id),
    actorId: String(data.actor_id ?? entry.actorId),
    actorEmail: entry.actorEmail,
    action: String(data.action),
    targetType: String(data.target_type),
    targetId: String(data.target_id ?? ''),
    diff: (data.diff as Record<string, unknown> | null) ?? entry.diff,
    createdAt: String(data.created_at ?? new Date().toISOString()),
  };
}
