/**
 * Stage 74 — Zero-Dependency Internal Production Observability & Telemetry
 *
 * Tracks process-scoped operational metrics (API response latency percentiles,
 * database health latency, authentication failures/rate-limits/CSRF blocks,
 * application errors, and security events) with strict secret redaction.
 *
 * Designed to pair with external uptime monitoring and optional Sentry/PostHog
 * integrations once authorized by the owner. Never exposes credentials or PII.
 */

export type ObservabilityEventCategory =
  | 'api_request'
  | 'db_health'
  | 'auth_success'
  | 'auth_failure'
  | 'auth_rate_limited'
  | 'csrf_blocked'
  | 'registration_closed_block'
  | 'app_error'
  | 'security_event';

export interface ObservabilityEventRecord {
  timestamp: string;
  category: ObservabilityEventCategory;
  route: string;
  statusCode?: number;
  latencyMs?: number;
  correlationId?: string;
  detail?: string;
}

export interface InternalMetricsSnapshot {
  scope: 'process_local_not_globally_aggregated';
  processStartedAt: string;
  processUptimeSeconds: number;
  counters: {
    healthChecksTotal: number;
    healthChecksDegraded: number;
    authSuccessTotal: number;
    authFailureTotal: number;
    authRateLimitedTotal: number;
    csrfBlockedTotal: number;
    registrationClosedBlocksTotal: number;
    appErrorsTotal: number;
    securityEventsTotal: number;
  };
  latency: {
    dbSamples: number;
    dbAvgMs: number | null;
    dbP95Ms: number | null;
    apiSamples: number;
    apiAvgMs: number | null;
    apiP95Ms: number | null;
  };
  recentEventsCount: number;
}

const MAX_LATENCY_SAMPLES = 200;
const MAX_RECENT_EVENTS = 100;

interface MetricsState {
  startedAtMs: number;
  startedAtIso: string;
  counters: InternalMetricsSnapshot['counters'];
  dbLatenciesMs: number[];
  apiLatenciesMs: number[];
  recentEvents: ObservabilityEventRecord[];
}

declare global {
  var __vieworaObservabilityState: MetricsState | undefined;
}

function getState(): MetricsState {
  if (!globalThis.__vieworaObservabilityState) {
    const now = Date.now();
    globalThis.__vieworaObservabilityState = {
      startedAtMs: now,
      startedAtIso: new Date(now).toISOString(),
      counters: {
        healthChecksTotal: 0,
        healthChecksDegraded: 0,
        authSuccessTotal: 0,
        authFailureTotal: 0,
        authRateLimitedTotal: 0,
        csrfBlockedTotal: 0,
        registrationClosedBlocksTotal: 0,
        appErrorsTotal: 0,
        securityEventsTotal: 0,
      },
      dbLatenciesMs: [],
      apiLatenciesMs: [],
      recentEvents: [],
    };
  }
  return globalThis.__vieworaObservabilityState;
}

function pushBounded(arr: number[], value: number, maxLen: number): void {
  if (!Number.isFinite(value) || value < 0) return;
  arr.push(Math.round(value));
  if (arr.length > maxLen) {
    arr.shift();
  }
}

function computeAvg(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const total = samples.reduce((acc, n) => acc + n, 0);
  return Math.round(total / samples.length);
}

function computeP95(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  return sorted[idx] ?? null;
}

/**
 * Redacts accidental secret-like patterns from diagnostic detail strings
 * before recording or emitting structured JSON logs.
 */
export function sanitizeTelemetryDetail(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw
    .replace(/postgres(ql)?:\/\/[^\s"']+/gi, '[REDACTED_DB_URI]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/(password|secret|token|apikey|api_key)=[^&\s]+/gi, '$1=[REDACTED]')
    .slice(0, 240);
}

export function recordObservabilityEvent(event: Omit<ObservabilityEventRecord, 'timestamp'>): void {
  const state = getState();
  const safeEvent: ObservabilityEventRecord = {
    timestamp: new Date().toISOString(),
    category: event.category,
    route: event.route,
    statusCode: event.statusCode,
    latencyMs: typeof event.latencyMs === 'number' ? Math.round(event.latencyMs) : undefined,
    correlationId: event.correlationId,
    detail: sanitizeTelemetryDetail(event.detail),
  };

  switch (event.category) {
    case 'db_health':
      state.counters.healthChecksTotal += 1;
      if (event.statusCode && event.statusCode >= 500) {
        state.counters.healthChecksDegraded += 1;
      }
      if (typeof event.latencyMs === 'number') {
        pushBounded(state.dbLatenciesMs, event.latencyMs, MAX_LATENCY_SAMPLES);
      }
      break;
    case 'api_request':
      if (typeof event.latencyMs === 'number') {
        pushBounded(state.apiLatenciesMs, event.latencyMs, MAX_LATENCY_SAMPLES);
      }
      break;
    case 'auth_success':
      state.counters.authSuccessTotal += 1;
      break;
    case 'auth_failure':
      state.counters.authFailureTotal += 1;
      break;
    case 'auth_rate_limited':
      state.counters.authRateLimitedTotal += 1;
      state.counters.securityEventsTotal += 1;
      break;
    case 'csrf_blocked':
      state.counters.csrfBlockedTotal += 1;
      state.counters.securityEventsTotal += 1;
      break;
    case 'registration_closed_block':
      state.counters.registrationClosedBlocksTotal += 1;
      break;
    case 'app_error':
      state.counters.appErrorsTotal += 1;
      break;
    case 'security_event':
      state.counters.securityEventsTotal += 1;
      break;
  }

  state.recentEvents.push(safeEvent);
  if (state.recentEvents.length > MAX_RECENT_EVENTS) {
    state.recentEvents.shift();
  }
}

export function getInternalMetricsSnapshot(): InternalMetricsSnapshot {
  const state = getState();
  return {
    scope: 'process_local_not_globally_aggregated',
    processStartedAt: state.startedAtIso,
    processUptimeSeconds: Math.max(0, Math.floor((Date.now() - state.startedAtMs) / 1000)),
    counters: { ...state.counters },
    latency: {
      dbSamples: state.dbLatenciesMs.length,
      dbAvgMs: computeAvg(state.dbLatenciesMs),
      dbP95Ms: computeP95(state.dbLatenciesMs),
      apiSamples: state.apiLatenciesMs.length,
      apiAvgMs: computeAvg(state.apiLatenciesMs),
      apiP95Ms: computeP95(state.apiLatenciesMs),
    },
    recentEventsCount: state.recentEvents.length,
  };
}

export function getRecentObservabilityEvents(limit = 25): ObservabilityEventRecord[] {
  const state = getState();
  const safeLimit = Math.max(1, Math.min(limit, MAX_RECENT_EVENTS));
  return state.recentEvents.slice(-safeLimit).reverse();
}

export function resetInternalMetricsForTests(): void {
  globalThis.__vieworaObservabilityState = undefined;
}

/**
 * Emits a structured single-line JSON log entry to stdout/stderr for Vercel Log Drains
 * and server-side observability pipelines. Never logs credentials or raw tokens.
 */
export function emitStructuredLog(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, string | number | boolean | null | undefined> = {}
): void {
  const sanitizedFields: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (typeof v === 'string') {
      sanitizedFields[k] = sanitizeTelemetryDetail(v) ?? '';
    } else {
      sanitizedFields[k] = v;
    }
  }
  const payload = JSON.stringify({
    ts: new Date().toISOString(),
    service: 'viewora-web',
    level,
    event,
    ...sanitizedFields,
  });
  if (level === 'error') {
    console.error(payload);
  } else if (level === 'warn') {
    console.warn(payload);
  } else if (process.env.NODE_ENV !== 'test') {
    console.info(payload);
  }
}
