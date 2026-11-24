import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { getCurrentSessionUser, isAdminRole, listLocalDemoUsers } from '@/lib/auth/session';
import { getConfiguredPlans } from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import {
  getApiUsageMetrics,
  getSearchAnalyticsMetrics,
  listAuditLogs,
  listCmsContent,
  listFeatureFlags,
  listSupportTickets,
} from '@/lib/admin/store';
import { getFunnelSummary } from '@/lib/analytics/funnel';
import { DEFAULT_EXPERIMENTS } from '@/lib/experiments/ab';
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
    title: 'Admin Console — Viewora',
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
        <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm dark:border-rose-900/60 dark:bg-slate-900">
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-600 dark:text-rose-400" />
          <h1 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">
            403 — Administrator Access Required
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Your current account role (<span className="font-mono">{user.role}</span>) does not have
            permission to access administrative controls.
          </p>
          <Link
            href={`/${safeLocale}/dashboard`}
            className="mt-6 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const providerHealth = await defaultProviderRegistry.checkAllHealth();
  const conversionAnalytics = getFunnelSummary();

  return (
    <AdminConsole
      actor={user}
      initialUsers={listLocalDemoUsers()}
      initialPlans={getConfiguredPlans()}
      providerHealth={providerHealth}
      apiUsage={getApiUsageMetrics()}
      searchAnalytics={getSearchAnalyticsMetrics()}
      conversionAnalytics={conversionAnalytics}
      experiments={DEFAULT_EXPERIMENTS}
      initialCms={listCmsContent()}
      initialTickets={listSupportTickets()}
      initialAuditLogs={listAuditLogs()}
      initialFlags={listFeatureFlags()}
    />
  );
}
