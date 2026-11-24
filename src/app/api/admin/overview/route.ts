import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/rbac';
import {
  getApiUsageMetrics,
  getSearchAnalyticsMetrics,
  listAuditLogs,
  listCmsContent,
  listFeatureFlags,
  listSupportTickets,
} from '@/lib/admin/store';
import { listLocalDemoUsers } from '@/lib/auth/session';
import { getConfiguredPlans } from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import { getFunnelSummary } from '@/lib/analytics/funnel';
import { DEFAULT_EXPERIMENTS } from '@/lib/experiments/ab';

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const providerHealth = await defaultProviderRegistry.checkAllHealth();

  return NextResponse.json({
    ok: true,
    actor: { email: guard.user.email, role: guard.user.role },
    users: listLocalDemoUsers(),
    plans: getConfiguredPlans(),
    providerHealth,
    apiUsage: getApiUsageMetrics(),
    searchAnalytics: getSearchAnalyticsMetrics(),
    conversionAnalytics: getFunnelSummary(),
    experiments: DEFAULT_EXPERIMENTS,
    cmsContent: listCmsContent(),
    supportTickets: listSupportTickets(),
    auditLogs: listAuditLogs(),
    featureFlags: listFeatureFlags(),
  });
}
