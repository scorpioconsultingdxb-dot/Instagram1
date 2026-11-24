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
}

export interface SearchAnalyticsMetric {
  normalizedUsername: string;
  searches24h: number;
  lastAvailability: 'available' | 'unavailable' | 'private_account';
  dataClass: 'live' | 'cached' | 'demo';
}

const featureFlags: FeatureFlagRecord[] = [
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
];

const cmsItems: CmsContentRecord[] = [
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
];

const supportTickets: SupportTicketRecord[] = [
  {
    id: 'tkt-1001',
    email: 'business@viewora.demo',
    subject: 'Connecting official Meta Business Discovery credentials',
    message: 'Could you share the required Meta Graph API permissions for Business Discovery?',
    status: 'open',
    priority: 'normal',
    adminNotes: '',
    createdAt: '2026-11-23T14:20:00.000Z',
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
  },
];

const auditLogs: AuditLogRecord[] = [
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
];

const apiUsageSnapshot: ApiUsageMetric[] = [
  { providerId: 'demo_fixture', requests24h: 142, errorRatePercent: 0, avgLatencyMs: 2 },
  { providerId: 'meta_official', requests24h: 0, errorRatePercent: 0, avgLatencyMs: 0 },
  { providerId: 'authorized_insights', requests24h: 0, errorRatePercent: 0, avgLatencyMs: 0 },
  { providerId: 'licensed_third_party', requests24h: 0, errorRatePercent: 0, avgLatencyMs: 0 },
  { providerId: 'permitted_public_dataset', requests24h: 0, errorRatePercent: 0, avgLatencyMs: 0 },
];

const searchAnalyticsSnapshot: SearchAnalyticsMetric[] = [
  { normalizedUsername: 'viewora.studio', searches24h: 64, lastAvailability: 'available', dataClass: 'demo' },
  { normalizedUsername: 'aurora.coffee', searches24h: 38, lastAvailability: 'available', dataClass: 'demo' },
  { normalizedUsername: 'nordic.design', searches24h: 24, lastAvailability: 'available', dataClass: 'demo' },
  { normalizedUsername: 'private.sample', searches24h: 16, lastAvailability: 'private_account', dataClass: 'demo' },
];

export function listFeatureFlags(): FeatureFlagRecord[] {
  return featureFlags;
}

export function toggleFeatureFlag(
  key: string,
  enabled: boolean
): { ok: true; flag: FeatureFlagRecord } | { ok: false; error: string } {
  const flag = featureFlags.find((f) => f.key === key);
  if (!flag) return { ok: false, error: `Unknown feature flag: ${key}` };
  if (flag.locked) {
    return {
      ok: false,
      error: `Feature flag "${key}" is locked and cannot be toggled without explicit authorization.`,
    };
  }
  flag.enabled = enabled;
  flag.updatedAt = new Date().toISOString();
  return { ok: true, flag };
}

export function listCmsContent(): CmsContentRecord[] {
  return cmsItems;
}

export function updateCmsContent(
  id: string,
  patch: Partial<Pick<CmsContentRecord, 'title' | 'body' | 'isPublished'>>
): CmsContentRecord | null {
  const item = cmsItems.find((c) => c.id === id);
  if (!item) return null;
  if (typeof patch.title === 'string') item.title = patch.title;
  if (typeof patch.body === 'string') item.body = patch.body;
  if (typeof patch.isPublished === 'boolean') item.isPublished = patch.isPublished;
  item.updatedAt = new Date().toISOString();
  return item;
}

export function listSupportTickets(): SupportTicketRecord[] {
  return supportTickets;
}

export function updateSupportTicket(
  id: string,
  patch: Partial<Pick<SupportTicketRecord, 'status' | 'priority' | 'adminNotes'>>
): SupportTicketRecord | null {
  const ticket = supportTickets.find((t) => t.id === id);
  if (!ticket) return null;
  if (patch.status) ticket.status = patch.status;
  if (patch.priority) ticket.priority = patch.priority;
  if (typeof patch.adminNotes === 'string') ticket.adminNotes = patch.adminNotes;
  return ticket;
}

export function recordAuditLog(entry: Omit<AuditLogRecord, 'id' | 'createdAt'>): AuditLogRecord {
  const record: AuditLogRecord = {
    ...entry,
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  auditLogs.unshift(record);
  if (auditLogs.length > 500) auditLogs.pop();
  return record;
}

export function listAuditLogs(): AuditLogRecord[] {
  return auditLogs;
}

export function getApiUsageMetrics(): ApiUsageMetric[] {
  return apiUsageSnapshot;
}

export function getSearchAnalyticsMetrics(): SearchAnalyticsMetric[] {
  return searchAnalyticsSnapshot;
}
