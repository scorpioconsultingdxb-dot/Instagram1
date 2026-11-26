import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/rbac';
import { getEnv, isDatabaseConfigured, isEmailDeliveryEnabled } from '@/lib/env';
import {
  defaultApiGateway,
  evaluateBudgetUtilization,
  isProviderEffectivelyEnabled,
  loadAdminCustomerUsageSummary,
  loadEmergencyHaltMetadata,
  loadPersistentIntegrationTelemetry,
  loadProviderApprovalMap,
} from '@/lib/integrations';
import { getDbBackgroundJobSummary } from '@/lib/db/repositories/jobs.repo';
import { loadAdminCommunicationOverview } from '@/lib/db/repositories/email.repo';
import { defaultJobQueue } from '@/lib/jobs/queue';

/**
 * Super Admin Integration Center 2.0 telemetry endpoint (Stages 41–49).
 * Combines gateway catalog/policies with durable PostgreSQL kill-switch states,
 * fixed-precision budget utilization alerts (50/75/90/100%), halt metadata,
 * 10-point activation approvals, privacy-safe customer usage summary,
 * durable job statistics, and communication overview.
 * Strictly NEVER exposes raw API keys, tokens, secrets, or private customer notes.
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const env = getEnv();
  const [
    snapshot,
    persistentTelemetry,
    haltMetadata,
    providerApprovals,
    customerUsageSummary,
    jobQueueSummary,
    communicationOverview,
  ] = await Promise.all([
    Promise.resolve(defaultApiGateway.getIntegrationCenterSnapshot()),
    loadPersistentIntegrationTelemetry().catch(() => null),
    loadEmergencyHaltMetadata().catch(() => []),
    loadProviderApprovalMap().catch(() => ({})),
    loadAdminCustomerUsageSummary().catch(() => null),
    isDatabaseConfigured()
      ? getDbBackgroundJobSummary().catch(() => defaultJobQueue.getSummary())
      : Promise.resolve(defaultJobQueue.getSummary()),
    loadAdminCommunicationOverview(
      isEmailDeliveryEnabled() && isProviderEffectivelyEnabled('resend_email'),
      env.EMAIL_FROM_ADDRESS
    ).catch(() => null),
  ]);

  const dailySpent = persistentTelemetry?.dailySpentUsd ?? snapshot.costControl.dailySpentUsd;
  const dailyCap = persistentTelemetry?.dailyCapUsd ?? snapshot.costControl.dailyCapUsd;
  const monthlySpent = persistentTelemetry?.monthlySpentUsd ?? snapshot.costControl.monthlySpentUsd;
  const monthlyCap = persistentTelemetry?.monthlyCapUsd ?? snapshot.costControl.monthlyCapUsd;

  return NextResponse.json(
    {
      ok: true,
      actor: { email: guard.user.email, role: guard.user.role },
      integrationCenter: snapshot,
      distributedTelemetry: persistentTelemetry,
      budgetAlerts: {
        daily: evaluateBudgetUtilization('global_daily', dailySpent, dailyCap),
        monthly: evaluateBudgetUtilization('global_monthly', monthlySpent, monthlyCap),
      },
      haltMetadata,
      providerApprovals,
      customerUsageSummary,
      jobQueueSummary,
      communicationOverview,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    }
  );
}
