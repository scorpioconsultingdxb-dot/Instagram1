import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/rbac';
import {
  getApiUsageMetrics,
  getSearchAnalyticsMetrics,
  loadAuditLogs,
  loadBroadcastNotifications,
  loadCmsContent,
  loadFeatureFlags,
  loadSupportTickets,
} from '@/lib/admin/store';
import { listLocalDemoUsers } from '@/lib/auth/session';
import { loadConfiguredPlans } from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import { loadFunnelSummary } from '@/lib/analytics/funnel';
import { DEFAULT_EXPERIMENTS } from '@/lib/experiments/ab';

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const [
    providerHealth,
    plans,
    conversionAnalytics,
    cmsContent,
    supportTickets,
    broadcastNotifications,
    auditLogs,
    featureFlags,
  ] = await Promise.all([
    defaultProviderRegistry.checkAllHealth(),
    loadConfiguredPlans(),
    loadFunnelSummary(),
    loadCmsContent(),
    loadSupportTickets(),
    loadBroadcastNotifications(),
    loadAuditLogs(),
    loadFeatureFlags(),
  ]);

  return NextResponse.json({
    ok: true,
    actor: { email: guard.user.email, role: guard.user.role },
    users: listLocalDemoUsers(),
    plans,
    providerHealth,
    apiUsage: getApiUsageMetrics(),
    searchAnalytics: getSearchAnalyticsMetrics(),
    conversionAnalytics,
    experiments: DEFAULT_EXPERIMENTS,
    cmsContent,
    supportTickets,
    broadcastNotifications,
    auditLogs,
    featureFlags,
  });
}
