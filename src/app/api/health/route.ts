import { randomUUID, timingSafeEqual } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import {
  getRuntimeDatabaseSecurityStatus,
  isBackgroundJobsEnabled,
  isDemoModeEnabled,
  isEmailDeliveryEnabled,
  isPaymentsEnabled,
  isPublicRegistrationOpen,
} from '@/lib/env';
import { checkDatabaseHealth } from '@/lib/db/prisma';
import { defaultProviderRegistry } from '@/lib/providers';
import { defaultJobQueue } from '@/lib/jobs/queue';
import { getAiCostSummary } from '@/lib/ai/gemini';
import { getCurrentSessionUser } from '@/lib/auth/session';
import {
  emitStructuredLog,
  getInternalMetricsSnapshot,
  recordObservabilityEvent,
} from '@/lib/observability/metrics';

export const dynamic = 'force-dynamic';

function hasAuthorizedDiagnosticsToken(request?: NextRequest): boolean {
  const configuredToken = (process.env.HEALTH_DIAGNOSTICS_TOKEN || '').trim();
  if (!configuredToken || configuredToken.length < 24 || !request) return false;

  const headerToken = (request.headers.get('x-health-diagnostics-token') || '').trim();
  const authHeader = (request.headers.get('authorization') || '').trim();
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const candidate = headerToken || bearerToken;
  if (!candidate) return false;

  const a = Buffer.from(candidate);
  const b = Buffer.from(configuredToken);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function isAuthorizedForFullDiagnostics(request?: NextRequest): Promise<boolean> {
  if (!request) return false;
  const detail = request.nextUrl?.searchParams?.get('detail');
  if (detail !== 'full') return false;

  if (hasAuthorizedDiagnosticsToken(request)) {
    return true;
  }

  try {
    const user = await getCurrentSessionUser();
    return user?.role === 'super_admin';
  } catch {
    return false;
  }
}

/**
 * Operational System Health endpoint (Stage 74 Hardened).
 *
 * - Public unauthenticated callers receive ONLY non-sensitive operational status
 *   (availability, database reachability/latency, coarse feature posture) with zero
 *   internal role names, environment variable names, AI spend, or queue internals.
 * - Authenticated `super_admin` sessions or authorized monitoring tokens calling
 *   `/api/health?detail=full` receive full diagnostic telemetry.
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const correlationId = randomUUID();
  const includeFullDiagnostics = await isAuthorizedForFullDiagnostics(request);

  const dbHealth = await checkDatabaseHealth();
  const isHealthy = dbHealth.configured ? dbHealth.reachable : true;
  const httpStatus = isHealthy ? 200 : 503;
  const registrationOpen = isPublicRegistrationOpen();

  recordObservabilityEvent({
    category: 'db_health',
    route: '/api/health',
    statusCode: httpStatus,
    latencyMs: dbHealth.latencyMs ?? undefined,
    correlationId,
    detail: dbHealth.status,
  });

  if (!isHealthy) {
    emitStructuredLog('error', 'health.database_unreachable', {
      correlationId,
      status: dbHealth.status,
      latencyMs: dbHealth.latencyMs,
    });
  }

  const responseTimeMs = Date.now() - startedAt;
  recordObservabilityEvent({
    category: 'api_request',
    route: '/api/health',
    statusCode: httpStatus,
    latencyMs: responseTimeMs,
    correlationId,
  });

  const headers = {
    'x-request-id': correlationId,
    'x-response-time-ms': String(responseTimeMs),
    'cache-control': 'no-store, max-age=0',
  };

  if (!includeFullDiagnostics) {
    return NextResponse.json(
      {
        ok: isHealthy,
        status: isHealthy ? 'healthy' : 'degraded',
        correlationId,
        checkedAt: new Date().toISOString(),
        responseTimeMs,
        uptimeMeasured: 'unavailable_external_monitor_required',
        services: {
          database: {
            status: dbHealth.status,
            reachable: dbHealth.reachable,
            latencyMs: dbHealth.latencyMs,
          },
          registration: {
            publicOpen: registrationOpen,
          },
          demoMode: {
            enabled: isDemoModeEnabled(),
          },
          payments: {
            enabled: isPaymentsEnabled(),
          },
          backgroundJobs: {
            enabled: isBackgroundJobsEnabled(),
          },
          emailDelivery: {
            enabled: isEmailDeliveryEnabled(),
          },
        },
      },
      { status: httpStatus, headers }
    );
  }

  const providers = await defaultProviderRegistry.checkAllHealth();
  const jobSummary = defaultJobQueue.getSummary();
  const aiSummary = getAiCostSummary();
  const dbSecurity = getRuntimeDatabaseSecurityStatus();

  return NextResponse.json(
    {
      ok: isHealthy,
      status: isHealthy ? 'healthy' : 'degraded',
      diagnosticsScope: 'authorized_full',
      correlationId,
      checkedAt: new Date().toISOString(),
      responseTimeMs,
      uptimeMeasured: 'unavailable_external_monitor_required',
      services: {
        database: {
          engine: dbHealth.engine,
          configured: dbHealth.configured,
          reachable: dbHealth.reachable,
          status: dbHealth.status,
          latencyMs: dbHealth.latencyMs,
          connectedRole: dbHealth.connectedRole ?? null,
          security: dbSecurity,
        },
        registration: {
          publicOpen: registrationOpen,
          mode: registrationOpen ? 'open' : 'invitation_only_closed',
        },
        demoMode: {
          enabled: isDemoModeEnabled(),
        },
        payments: {
          enabled: isPaymentsEnabled(),
          phase: 'Phase 7 Reserved — Disabled',
        },
        backgroundJobs: {
          enabled: isBackgroundJobsEnabled(),
          ...jobSummary,
        },
        emailDelivery: {
          enabled: isEmailDeliveryEnabled(),
        },
        aiEngine: {
          geminiConfigured: aiSummary.geminiConfigured,
          killSwitchActive: aiSummary.killSwitchActive,
          dailySpentUsd: aiSummary.dailySpentUsd,
          dailyBudgetUsd: aiSummary.dailyBudgetUsd,
        },
        providers: providers.map((p) => ({
          id: p.providerId,
          status: p.status,
          configured: p.configured,
        })),
      },
      observability: getInternalMetricsSnapshot(),
    },
    { status: httpStatus, headers }
  );
}
