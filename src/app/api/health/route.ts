import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import {
  isBackgroundJobsEnabled,
  isDemoModeEnabled,
  isEmailDeliveryEnabled,
  isPaymentsEnabled,
} from '@/lib/env';
import { checkDatabaseHealth } from '@/lib/db/prisma';
import { defaultProviderRegistry } from '@/lib/providers';
import { defaultJobQueue } from '@/lib/jobs/queue';
import { getAiCostSummary } from '@/lib/ai/gemini';

export const dynamic = 'force-dynamic';

/**
 * Operational System Health endpoint.
 * Reports measured PostgreSQL connectivity and runtime status — never fabricates uptime.
 */
export async function GET() {
  const correlationId = randomUUID();
  const [dbHealth, providers] = await Promise.all([
    checkDatabaseHealth(),
    defaultProviderRegistry.checkAllHealth(),
  ]);
  const jobSummary = defaultJobQueue.getSummary();
  const aiSummary = getAiCostSummary();

  return NextResponse.json(
    {
      ok: true,
      correlationId,
      checkedAt: new Date().toISOString(),
      uptimeMeasured: 'unavailable_external_monitor_required',
      services: {
        database: {
          engine: dbHealth.engine,
          configured: dbHealth.configured,
          reachable: dbHealth.reachable,
          status: dbHealth.status,
          latencyMs: dbHealth.latencyMs,
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
    },
    {
      headers: {
        'x-request-id': correlationId,
      },
    }
  );
}
