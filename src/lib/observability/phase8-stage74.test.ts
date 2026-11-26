import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import * as prismaModule from '@/lib/db/prisma';
import { GET as healthGet } from '@/app/api/health/route';
import {
  getInternalMetricsSnapshot,
  getRecentObservabilityEvents,
  recordObservabilityEvent,
  resetInternalMetricsForTests,
  sanitizeTelemetryDetail,
} from '@/lib/observability/metrics';

describe('Stage 74 — Hardened Health Endpoint & Internal Observability', () => {
  const originalToken = process.env.HEALTH_DIAGNOSTICS_TOKEN;

  beforeEach(() => {
    resetInternalMetricsForTests();
    delete process.env.HEALTH_DIAGNOSTICS_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalToken === undefined) {
      delete process.env.HEALTH_DIAGNOSTICS_TOKEN;
    } else {
      process.env.HEALTH_DIAGNOSTICS_TOKEN = originalToken;
    }
  });

  it('exposes only non-sensitive operational fields on unauthenticated public /api/health', async () => {
    const req = new NextRequest('https://instagram1-beta.vercel.app/api/health');
    const res = await healthGet(req);
    const body = await res.json();

    expect([200, 503]).toContain(res.status);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(res.headers.get('x-response-time-ms')).toBeTruthy();

    // Required minimal public fields
    expect(typeof body.ok).toBe('boolean');
    expect(['healthy', 'degraded']).toContain(body.status);
    expect(body.services.database).toHaveProperty('status');
    expect(body.services.database).toHaveProperty('reachable');
    expect(body.services.database).toHaveProperty('latencyMs');

    // Sensitive internal details MUST be absent from public responses
    expect(body.services.database.connectedRole).toBeUndefined();
    expect(body.services.database.security).toBeUndefined();
    expect(body.services.aiEngine).toBeUndefined();
    expect(body.services.providers).toBeUndefined();
    expect(body.observability).toBeUndefined();
    expect(body.diagnosticsScope).toBeUndefined();
  });

  it('returns HTTP 503 and degraded status on isolated database outage without leaking internals', async () => {
    vi.spyOn(prismaModule, 'checkDatabaseHealth').mockResolvedValueOnce({
      configured: true,
      reachable: false,
      status: 'unreachable',
      latencyMs: 185,
      engine: 'postgresql',
      connectedRole: null,
      error: 'Simulated isolated database outage',
    });

    const req = new NextRequest('https://instagram1-beta.vercel.app/api/health');
    const res = await healthGet(req);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(body.ok).toBe(false);
    expect(body.status).toBe('degraded');
    expect(body.services.database).toEqual({
      status: 'unreachable',
      reachable: false,
      latencyMs: 185,
    });
    expect(body.services.database.error).toBeUndefined();
    expect(body.services.database.connectedRole).toBeUndefined();
    expect(body.services.database.security).toBeUndefined();
  });

  it('rejects forged tokens and query-string secrets on /api/health?detail=full', async () => {
    const validToken = 'diag-token-9f8e7d6c5b4a3210fedcba9876543210';
    process.env.HEALTH_DIAGNOSTICS_TOKEN = validToken;

    const forgedReq = new NextRequest('https://instagram1-beta.vercel.app/api/health?detail=full', {
      headers: { authorization: 'Bearer wrong-token-value-1234567890abcdef' },
    });
    const forgedRes = await healthGet(forgedReq);
    const forgedBody = await forgedRes.json();
    expect(forgedBody.services.database.connectedRole).toBeUndefined();
    expect(forgedBody.services.database.security).toBeUndefined();
    expect(forgedBody.observability).toBeUndefined();

    // Query-string secret MUST be rejected even if Authorization header is also supplied
    const queryLeakReq = new NextRequest(
      `https://instagram1-beta.vercel.app/api/health?detail=full&token=${validToken}`,
      { headers: { authorization: `Bearer ${validToken}` } }
    );
    const queryLeakRes = await healthGet(queryLeakReq);
    const queryLeakBody = await queryLeakRes.json();
    expect(queryLeakBody.services.database.security).toBeUndefined();
    expect(queryLeakBody.observability).toBeUndefined();
  });

  it('returns full diagnostic telemetry when authorized via Authorization: Bearer header', async () => {
    const validToken = 'diag-token-9f8e7d6c5b4a3210fedcba9876543210';
    process.env.HEALTH_DIAGNOSTICS_TOKEN = validToken;

    const authReq = new NextRequest('https://instagram1-beta.vercel.app/api/health?detail=full', {
      headers: { authorization: `Bearer ${validToken}` },
    });
    const res = await healthGet(authReq);
    const body = await res.json();

    expect(body.diagnosticsScope).toBe('authorized_full');
    expect(body.services.database).toHaveProperty('security');
    expect(body.services.aiEngine).toBeDefined();
    expect(Array.isArray(body.services.providers)).toBe(true);
    expect(body.observability).toBeDefined();
    expect(body.observability.scope).toBe('process_local_not_globally_aggregated');
    expect(body.observability.counters.healthChecksTotal).toBeGreaterThanOrEqual(1);
  });

  it('records latency percentiles, auth/security counters, and redacts credential patterns', () => {
    recordObservabilityEvent({ category: 'db_health', route: '/api/health', statusCode: 200, latencyMs: 120 });
    recordObservabilityEvent({ category: 'db_health', route: '/api/health', statusCode: 200, latencyMs: 280 });
    recordObservabilityEvent({ category: 'db_health', route: '/api/health', statusCode: 503, latencyMs: 950 });
    recordObservabilityEvent({ category: 'auth_failure', route: '/api/auth/login', statusCode: 401 });
    recordObservabilityEvent({ category: 'csrf_blocked', route: '/api/auth/login', statusCode: 403 });
    recordObservabilityEvent({ category: 'auth_rate_limited', route: '/api/auth/login', statusCode: 429 });
    recordObservabilityEvent({
      category: 'app_error',
      route: '/api/test',
      statusCode: 500,
      detail: 'Failed connecting to postgresql://viewora_app:supersecret@ep-demo.neon.tech/neondb with Bearer abc.def.ghi',
    });

    const snap = getInternalMetricsSnapshot();
    expect(snap.scope).toBe('process_local_not_globally_aggregated');
    expect(snap.counters.healthChecksTotal).toBe(3);
    expect(snap.counters.healthChecksDegraded).toBe(1);
    expect(snap.counters.authFailureTotal).toBe(1);
    expect(snap.counters.csrfBlockedTotal).toBe(1);
    expect(snap.counters.authRateLimitedTotal).toBe(1);
    expect(snap.counters.securityEventsTotal).toBe(2);
    expect(snap.counters.appErrorsTotal).toBe(1);
    expect(snap.latency.dbSamples).toBe(3);
    expect(snap.latency.dbP95Ms).toBe(950);

    const recent = getRecentObservabilityEvents(5);
    expect(recent[0]?.detail).toContain('[REDACTED_DB_URI]');
    expect(recent[0]?.detail).toContain('Bearer [REDACTED]');
    expect(recent[0]?.detail).not.toContain('supersecret');

    expect(sanitizeTelemetryDetail('token=xyz123&ok=1')).toBe('token=[REDACTED]&ok=1');
  });
});
