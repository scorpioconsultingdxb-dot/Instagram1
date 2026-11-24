import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import {
  isBackgroundJobsEnabled,
  isDemoModeEnabled,
  isEmailDeliveryEnabled,
  isPaymentsEnabled,
  isSupabaseConfigured,
} from '@/lib/env';
import { defaultProviderRegistry } from '@/lib/providers';
import { defaultJobQueue } from '@/lib/jobs/queue';
import { getAiCostSummary } from '@/lib/ai/gemini';

export const dynamic = 'force-dynamic';

/**
 * Operational System Health endpoint (Section 39).
 * Reports only measured runtime status — never fabricates uptime percentages.
 */
export async function GET() {
  const correlationId = randomUUID();
  const providers = await defaultProviderRegistry.checkAllHealth();
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
          configured: isSupabaseConfigured(),
          status: isSupabaseConfigured() ? 'configured' : 'not_configured',
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
