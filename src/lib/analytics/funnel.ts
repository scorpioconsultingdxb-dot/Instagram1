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
}

const seedEvents: FunnelEventRecord[] = [
  {
    id: 'evt-seed-1',
    eventName: 'search_performed',
    locale: 'en',
    sessionId: 'sess-demo-1',
    userId: null,
    properties: { handle: 'viewora.studio', demo: true },
    createdAt: '2026-11-23T10:00:00.000Z',
  },
  {
    id: 'evt-seed-2',
    eventName: 'results_viewed',
    locale: 'en',
    sessionId: 'sess-demo-1',
    userId: null,
    properties: { handle: 'viewora.studio', dataClass: 'demo' },
    createdAt: '2026-11-23T10:00:05.000Z',
  },
  {
    id: 'evt-seed-3',
    eventName: 'premium_preview_viewed',
    locale: 'en',
    sessionId: 'sess-demo-1',
    userId: null,
    properties: { handle: 'viewora.studio' },
    createdAt: '2026-11-23T10:00:20.000Z',
  },
  {
    id: 'evt-seed-4',
    eventName: 'signup_completed',
    locale: 'en',
    sessionId: 'sess-demo-1',
    userId: 'demo-user-business',
    properties: { segment: 'business' },
    createdAt: '2026-11-23T10:02:10.000Z',
  },
  {
    id: 'evt-seed-5',
    eventName: 'upgrade_intent',
    locale: 'en',
    sessionId: 'sess-demo-1',
    userId: 'demo-user-business',
    properties: { planCode: 'premium', interval: 'annual' },
    createdAt: '2026-11-23T10:05:00.000Z',
  },
];

const funnelLog: FunnelEventRecord[] = [...seedEvents];

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
  };
  funnelLog.unshift(record);
  if (funnelLog.length > 500) {
    funnelLog.pop();
  }
  return record;
}

export function getFunnelSummary(): {
  counts: Record<FunnelEventName, number>;
  searchToSignupRate: number;
  signupToUpgradeIntentRate: number;
  recent: FunnelEventRecord[];
} {
  const counts: Record<FunnelEventName, number> = {
    search_performed: 0,
    results_viewed: 0,
    premium_preview_viewed: 0,
    signup_started: 0,
    signup_completed: 0,
    pricing_viewed: 0,
    upgrade_intent: 0,
  };

  for (const evt of funnelLog) {
    counts[evt.eventName] += 1;
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
    recent: funnelLog.slice(0, 20),
  };
}
