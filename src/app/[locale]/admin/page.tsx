import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { getCurrentSessionUser, isAdminRole, loadAdminUsers } from '@/lib/auth/session';
import { loadConfiguredPlans } from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
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
import { loadFunnelSummary } from '@/lib/analytics/funnel';
import { DEFAULT_EXPERIMENTS } from '@/lib/experiments/ab';
import { defaultJobQueue } from '@/lib/jobs/queue';
import { loadReferralOverview } from '@/lib/referrals/service';
import { checkDatabaseHealth } from '@/lib/db/prisma';
import { getBackupDirectorySummary } from '@/lib/admin/backup-status';
import { getEnv, isDatabaseConfigured, isEmailDeliveryEnabled } from '@/lib/env';
import {
  defaultApiGateway,
  isProviderEffectivelyEnabled,
  loadAdminCustomerUsageSummary,
  loadEmergencyHaltMetadata,
  loadPersistentIntegrationTelemetry,
  loadProviderApprovalMap,
} from '@/lib/integrations';
import { getDbBackgroundJobSummary } from '@/lib/db/repositories/jobs.repo';
import { loadAdminCommunicationOverview } from '@/lib/db/repositories/email.repo';
import { AdminConsole } from '@/components/admin/AdminConsole';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  return buildPageMetadata({
    locale: safeLocale,
    path: '/admin',
    title: 'Admin Console',
    description: 'Server-protected Viewora administration dashboard.',
    noIndex: true,
  });
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/${safeLocale}/login?next=/${safeLocale}/admin`);
  }

  if (!isAdminRole(user.role)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="viewora-card rounded-2xl border-rose-200 p-8 dark:border-rose-900/60">
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-600 dark:text-[#F87171]" />
          <h1 className="mt-4 font-display text-xl font-extrabold text-[#0F172A] dark:text-white">
            403 — Administrator Access Required
          </h1>
          <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
            Your current account role (<span className="font-mono">{user.role}</span>) does not have
            permission to access administrative controls.
          </p>
          <Link
            href={`/${safeLocale}/dashboard`}
            className="viewora-btn-primary mt-6 inline-block rounded-xl px-4 py-2 text-xs font-semibold"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const env = getEnv();
  const [
    initialUsers,
    providerHealth,
    conversionAnalytics,
    initialPlans,
    initialCms,
    initialTickets,
    initialBroadcasts,
    initialAuditLogs,
    initialFlags,
    referralOverview,
    databaseHealth,
    distributedTelemetry,
    communicationOverview,
    customerUsageSummary,
    haltMetadata,
    providerApprovals,
    dbJobSummary,
  ] = await Promise.all([
    loadAdminUsers(),
    defaultProviderRegistry.checkAllHealth(),
    loadFunnelSummary(),
    loadConfiguredPlans(),
    loadCmsContent(),
    loadSupportTickets({ userId: user.id, role: user.role }),
    loadBroadcastNotifications(),
    loadAuditLogs(),
    loadFeatureFlags(),
    loadReferralOverview(),
    checkDatabaseHealth(),
    loadPersistentIntegrationTelemetry().catch(() => null),
    loadAdminCommunicationOverview(
      isEmailDeliveryEnabled() && isProviderEffectivelyEnabled('resend_email'),
      env.EMAIL_FROM_ADDRESS
    ).catch(() => null),
    loadAdminCustomerUsageSummary().catch(() => null),
    loadEmergencyHaltMetadata().catch(() => []),
    loadProviderApprovalMap().catch(() => ({})),
    isDatabaseConfigured()
      ? getDbBackgroundJobSummary().catch(() => defaultJobQueue.getSummary())
      : Promise.resolve(defaultJobQueue.getSummary()),
  ]);

  return (
    <AdminConsole
      actor={user}
      initialTab="users"
      initialUsers={initialUsers}
      initialPlans={initialPlans}
      providerHealth={providerHealth}
      databaseHealth={databaseHealth}
      backupSummary={getBackupDirectorySummary()}
      integrationCenter={defaultApiGateway.getIntegrationCenterSnapshot()}
      distributedTelemetry={distributedTelemetry}
      communicationOverview={communicationOverview}
      customerUsageSummary={customerUsageSummary}
      haltMetadata={haltMetadata}
      initialProviderApprovals={providerApprovals}
      apiUsage={getApiUsageMetrics()}
      searchAnalytics={getSearchAnalyticsMetrics()}
      conversionAnalytics={conversionAnalytics}
      experiments={DEFAULT_EXPERIMENTS}
      initialCms={initialCms}
      initialTickets={initialTickets}
      initialBroadcasts={initialBroadcasts}
      initialAuditLogs={initialAuditLogs}
      initialFlags={initialFlags}
      jobQueueSummary={dbJobSummary}
      storageUsage={getLocalStorageUsageSummary()}
      referralOverview={referralOverview}
    />
  );
}
