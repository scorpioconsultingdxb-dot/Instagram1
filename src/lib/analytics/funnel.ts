import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';

export type FunnelEventName =
  | 'search_performed'
  | 'results_viewed'
  | 'premium_preview_viewed'
  | 'signup_started'
  | 'signup_completed'
  | 'pricing_viewed'
  | 'upgrade_intent';

export interface FunnelEventRecord {
  id: string;
  eventName: FunnelEventName;
  locale: string;
  sessionId: string;
  userId: string | null;
  properties: Record<string, string | number | boolean>;
  createdAt: string;
  isSample?: boolean;
}

const FUNNEL_STORE = 'funnel-events.json';

const SAMPLE_BASELINE_EVENTS: FunnelEventRecord[] = [
  {
    id: 'evt-seed-1',
    eventName: 'search_performed',
    locale: 'en',
    sessionId: 'sess-demo-1',
    userId: null,
    properties: { handle: 'viewora.studio', demo: true },
    createdAt: '2026-11-23T10:00:00.000Z',
    isSample: true,
  },
  {
    id: 'evt-seed-2',
    eventName: 'results_viewed',
    locale: 'en',
    sessionId: 'sess-demo-1',
    userId: null,
    properties: { handle: 'viewora.studio', dataClass: 'demo' },
    createdAt: '2026-11-23T10:00:05.000Z',
    isSample: true,
  },
  {
    id: 'evt-seed-3',
    eventName: 'premium_preview_viewed',
    locale: 'en',
    sessionId: 'sess-demo-1',
    userId: null,
    properties: { handle: 'viewora.studio' },
    createdAt: '2026-11-23T10:00:20.000Z',
    isSample: true,
  },
  {
    id: 'evt-seed-4',
    eventName: 'signup_completed',
    locale: 'en',
    sessionId: 'sess-demo-1',
    userId: 'demo-user-business',
    properties: { segment: 'business' },
    createdAt: '2026-11-23T10:02:10.000Z',
    isSample: true,
  },
  {
    id: 'evt-seed-5',
    eventName: 'upgrade_intent',
    locale: 'en',
    sessionId: 'sess-demo-1',
    userId: 'demo-user-business',
    properties: { planCode: 'premium', interval: 'annual' },
    createdAt: '2026-11-23T10:05:00.000Z',
    isSample: true,
  },
];

function loadRecordedFunnelEvents(): FunnelEventRecord[] {
  return readJsonStore<FunnelEventRecord[]>(FUNNEL_STORE, () => []);
}

export function recordFunnelEvent(input: {
  eventName: FunnelEventName;
  locale: string;
  sessionId: string;
  userId?: string | null;
  properties?: Record<string, string | number | boolean>;
}): FunnelEventRecord {
  const record: FunnelEventRecord = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    eventName: input.eventName,
    locale: input.locale,
    sessionId: input.sessionId,
    userId: input.userId ?? null,
    properties: input.properties ?? {},
    createdAt: new Date().toISOString(),
    isSample: false,
  };
  updateJsonStore<FunnelEventRecord[]>(
    FUNNEL_STORE,
    () => [],
    (current) => [record, ...current].slice(0, 500)
  );
  return record;
}

export function getFunnelSummary(): {
  counts: Record<FunnelEventName, number>;
  searchToSignupRate: number;
  signupToUpgradeIntentRate: number;
  recent: FunnelEventRecord[];
  isSample: boolean;
} {
  const recorded = loadRecordedFunnelEvents();
  const isSample = recorded.length === 0;
  const source = isSample ? SAMPLE_BASELINE_EVENTS : recorded;

  const counts: Record<FunnelEventName, number> = {
    search_performed: 0,
    results_viewed: 0,
    premium_preview_viewed: 0,
    signup_started: 0,
    signup_completed: 0,
    pricing_viewed: 0,
    upgrade_intent: 0,
  };

  for (const evt of source) {
    if (evt.eventName in counts) {
      counts[evt.eventName] += 1;
    }
  }

  const searchToSignupRate =
    counts.search_performed > 0
      ? Number(((counts.signup_completed / counts.search_performed) * 100).toFixed(1))
      : 0;

  const signupToUpgradeIntentRate =
    counts.signup_completed > 0
      ? Number(((counts.upgrade_intent / counts.signup_completed) * 100).toFixed(1))
      : 0;

  return {
    counts,
    searchToSignupRate,
    signupToUpgradeIntentRate,
    recent: source.slice(0, 20),
    isSample,
  };
}

function summarizeFunnelRecords(recorded: FunnelEventRecord[]): {
  counts: Record<FunnelEventName, number>;
  searchToSignupRate: number;
  signupToUpgradeIntentRate: number;
  recent: FunnelEventRecord[];
  isSample: boolean;
} {
  const isSample = recorded.length === 0;
  const source = isSample ? SAMPLE_BASELINE_EVENTS : recorded;

  const counts: Record<FunnelEventName, number> = {
    search_performed: 0,
    results_viewed: 0,
    premium_preview_viewed: 0,
    signup_started: 0,
    signup_completed: 0,
    pricing_viewed: 0,
    upgrade_intent: 0,
  };

  for (const evt of source) {
    if (evt.eventName in counts) {
      counts[evt.eventName] += 1;
    }
  }

  const searchToSignupRate =
    counts.search_performed > 0
      ? Number(((counts.signup_completed / counts.search_performed) * 100).toFixed(1))
      : 0;

  const signupToUpgradeIntentRate =
    counts.signup_completed > 0
      ? Number(((counts.upgrade_intent / counts.signup_completed) * 100).toFixed(1))
      : 0;

  return {
    counts,
    searchToSignupRate,
    signupToUpgradeIntentRate,
    recent: source.slice(0, 20),
    isSample,
  };
}

export async function persistFunnelEvent(input: {
  eventName: FunnelEventName;
  locale: string;
  sessionId: string;
  userId?: string | null;
  properties?: Record<string, string | number | boolean>;
}): Promise<FunnelEventRecord> {
  if (!isSupabaseConfigured()) {
    return recordFunnelEvent(input);
  }
  try {
    const supabase = createSupabaseAdminClient() ?? (await createSupabaseServerClient());
    if (!supabase) return recordFunnelEvent(input);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const { data, error } = await supabase
      .from('funnel_events')
      .insert({
        user_id: input.userId && uuidRegex.test(input.userId) ? input.userId : null,
        session_id: input.sessionId,
        event_name: input.eventName,
        locale: input.locale,
        properties: input.properties ?? {},
      })
      .select('id, event_name, locale, session_id, user_id, properties, created_at')
      .single();

    if (error || !data) return recordFunnelEvent(input);
    return {
      id: String(data.id),
      eventName: data.event_name as FunnelEventName,
      locale: String(data.locale),
      sessionId: String(data.session_id),
      userId: (data.user_id as string | null) ?? null,
      properties: (data.properties as Record<string, string | number | boolean> | null) ?? {},
      createdAt: String(data.created_at ?? new Date().toISOString()),
      isSample: false,
    };
  } catch {
    return recordFunnelEvent(input);
  }
}

export async function loadFunnelSummary(): Promise<{
  counts: Record<FunnelEventName, number>;
  searchToSignupRate: number;
  signupToUpgradeIntentRate: number;
  recent: FunnelEventRecord[];
  isSample: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return getFunnelSummary();
  }
  try {
    const supabase = createSupabaseAdminClient() ?? (await createSupabaseServerClient());
    if (!supabase) return getFunnelSummary();
    const { data, error } = await supabase
      .from('funnel_events')
      .select('id, event_name, locale, session_id, user_id, properties, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error || !data) return getFunnelSummary();
    const records: FunnelEventRecord[] = (data as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      eventName: row.event_name as FunnelEventName,
      locale: String(row.locale),
      sessionId: String(row.session_id),
      userId: (row.user_id as string | null) ?? null,
      properties: (row.properties as Record<string, string | number | boolean> | null) ?? {},
      createdAt: String(row.created_at ?? new Date().toISOString()),
      isSample: false,
    }));
    return summarizeFunnelRecords(records);
  } catch {
    return getFunnelSummary();
  }
}
