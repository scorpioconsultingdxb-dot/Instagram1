import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/rbac';
import {
  getApiUsageMetrics,
  getLocalStorageUsageSummary,
  getSearchAnalyticsMetrics,
  loadAuditLogs,
  loadBroadcastNotifications,
  loadCmsContent,
  loadFeatureFlags,
  loadSupportTickets,
} from '@/lib/admin/store';
import { loadAdminUsers } from '@/lib/auth/session';
import { loadConfiguredPlans } from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import { loadFunnelSummary } from '@/lib/analytics/funnel';
import { DEFAULT_EXPERIMENTS } from '@/lib/experiments/ab';
import { defaultJobQueue } from '@/lib/jobs/queue';
import { loadReferralOverview } from '@/lib/referrals/service';
import { checkDatabaseHealth } from '@/lib/db/prisma';
import { getBackupDirectorySummary } from '@/lib/admin/backup-status';

export async function GET() {
  try {
    const guard = await requireAdminApi();
    if (!guard.ok) return guard.response;

    const [
      users,
      providerHealth,
      plans,
      conversionAnalytics,
      cmsContent,
      supportTickets,
      broadcastNotifications,
      auditLogs,
      featureFlags,
      databaseHealth,
      referralOverview,
    ] = await Promise.all([
      loadAdminUsers(),
      defaultProviderRegistry.checkAllHealth(),
      loadConfiguredPlans(),
      loadFunnelSummary(),
      loadCmsContent(),
      loadSupportTickets({ userId: guard.user.id, role: guard.user.role }),
      loadBroadcastNotifications(),
      loadAuditLogs(),
      loadFeatureFlags(),
      checkDatabaseHealth(),
      loadReferralOverview(),
    ]);

    return NextResponse.json({
      ok: true,
      actor: { email: guard.user.email, role: guard.user.role },
      users,
      plans,
      providerHealth,
      databaseHealth,
      apiUsage: getApiUsageMetrics(),
      searchAnalytics: getSearchAnalyticsMetrics(),
      conversionAnalytics,
      experiments: DEFAULT_EXPERIMENTS,
      cmsContent,
      supportTickets,
      broadcastNotifications,
      auditLogs,
      featureFlags,
      jobQueueSummary: defaultJobQueue.getSummary(),
      storageUsage: getLocalStorageUsageSummary(),
      backupSummary: getBackupDirectorySummary(),
      referralOverview,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Database service is temporarily unavailable.' },
      { status: 503 }
    );
  }
}
