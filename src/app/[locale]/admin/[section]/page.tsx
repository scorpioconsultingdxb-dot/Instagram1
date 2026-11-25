import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { getCurrentSessionUser, isAdminRole, listLocalDemoUsers } from '@/lib/auth/session';
import { loadConfiguredPlans } from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import { PROVIDER_EVALUATION_MATRIX } from '@/lib/providers/resilience';
import { getAiCostSummary } from '@/lib/ai/gemini';
import { defaultJobQueue } from '@/lib/jobs/queue';
import { listEmailDeliveries } from '@/lib/email/resend';
import { getReferralOverview } from '@/lib/referrals/service';
import {
  getApiUsageMetrics,
  getSearchAnalyticsMetrics,
  loadAuditLogs,
  loadBroadcastNotifications,
  loadCmsContent,
  loadFeatureFlags,
  loadSupportTickets,
} from '@/lib/admin/store';
import { loadFunnelSummary } from '@/lib/analytics/funnel';
import { DEFAULT_EXPERIMENTS } from '@/lib/experiments/ab';
import { AdminConsole, type AdminTab } from '@/components/admin/AdminConsole';

export const dynamic = 'force-dynamic';

const SECTION_TO_ADMIN_TAB: Record<string, AdminTab> = {
  customers: 'users',
  workspaces: 'users',
  plans: 'plans',
  subscriptions: 'plans',
  entitlements: 'entitlements',
  providers: 'providers',
  notifications: 'notifications',
  support: 'support',
  analytics: 'searches',
  conversions: 'conversions',
  content: 'cms',
  seo: 'cms',
  'feature-flags': 'flags',
  'audit-logs': 'audit',
  settings: 'flags',
};

const ADMIN_SECTIONS = new Set([
  ...Object.keys(SECTION_TO_ADMIN_TAB),
  'jobs',
  'ai-usage',
  'email',
  'referrals',
  'system-health',
]);

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ locale: string; section: string }>;
}) {
  const { locale, section } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  if (!ADMIN_SECTIONS.has(section)) {
    notFound();
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/${safeLocale}/login?next=/${safeLocale}/admin/${section}`);
  }

  if (!isAdminRole(user.role)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="viewora-card rounded-2xl border-rose-200 p-8 dark:border-rose-900/60">
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-600" />
          <h1 className="mt-4 font-display text-xl font-extrabold text-[#0F172A] dark:text-white">
            403 — Administrator Access Required
          </h1>
          <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
            Role <code className="font-mono">{user.role}</code> cannot access /admin/{section}.
          </p>
        </div>
      </div>
    );
  }

  if (
    section === 'jobs' ||
    section === 'ai-usage' ||
    section === 'email' ||
    section === 'referrals' ||
    section === 'system-health'
  ) {
    const jobSummary = defaultJobQueue.getSummary();
    const aiSummary = getAiCostSummary();
    const emails = listEmailDeliveries();
    const referrals = getReferralOverview();
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={`/${safeLocale}/admin`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#7957FF]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Admin Overview
        </Link>
        <h1 className="mt-4 font-display text-2xl font-extrabold capitalize text-[#0F172A] dark:text-white">
          Admin · {section.replace('-', ' ')}
        </h1>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="viewora-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">
              Background Jobs Queue
            </h2>
            <p className="mt-2 font-mono text-xs text-[#64748B] dark:text-slate-300">
              Queued: {jobSummary.queued} · Running: {jobSummary.running} · Completed:{' '}
              {jobSummary.completed} · Dead-letter: {jobSummary.deadLetter}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              Heartbeat: {jobSummary.lastHeartbeatAt ?? 'Not yet triggered'}
            </p>
          </div>

          <div className="viewora-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">
              AI Usage &amp; Cost Budgets
            </h2>
            <p className="mt-2 font-mono text-xs text-[#64748B] dark:text-slate-300">
              Daily: ${aiSummary.dailySpentUsd.toFixed(4)} / ${aiSummary.dailyBudgetUsd} · Monthly:
              ${aiSummary.monthlySpentUsd.toFixed(4)} / ${aiSummary.monthlyBudgetUsd}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              Gemini Live Configured: {String(aiSummary.geminiConfigured)} · Kill Switch:{' '}
              {String(aiSummary.killSwitchActive)}
            </p>
          </div>

          <div className="viewora-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">
              Transactional Email Deliveries ({emails.length})
            </h2>
            <p className="mt-2 text-xs text-[#64748B]">
              External Resend delivery stays disabled until EMAIL_NOTIFICATIONS_ENABLED=true and
              RESEND_API_KEY + SPF/DKIM/DMARC are configured.
            </p>
          </div>

          <div className="viewora-card rounded-2xl p-5">
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">
              Referral &amp; Affiliate Architecture
            </h2>
            <p className="mt-2 text-xs text-[#64748B] dark:text-slate-300">
              Proposed Commission: {referrals.proposedCommissionPercent}% for{' '}
              {referrals.proposedCommissionMonths} months · Payouts Enabled:{' '}
              <strong>{String(referrals.payoutsEnabled)}</strong> (Disabled until Phase 7).
            </p>
          </div>
        </div>

        <div className="viewora-card mt-6 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">
            Provider Commercial Evaluation Matrix
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[#64748B] dark:border-[#263047]">
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Commercial Rights</th>
                  <th className="py-2 pr-3">Coverage</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#263047]">
                {PROVIDER_EVALUATION_MATRIX.map((row) => (
                  <tr key={row.providerName}>
                    <td className="py-2.5 pr-3 font-semibold">{row.providerName}</td>
                    <td className="py-2.5 pr-3">{row.commercialRights}</td>
                    <td className="py-2.5 pr-3 text-[#64748B] dark:text-[#94A3B8]">
                      {row.profileCoverage}
                    </td>
                    <td className="py-2.5 font-mono text-[11px]">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const [
    providerHealth,
    initialPlans,
    conversionAnalytics,
    initialCms,
    initialTickets,
    initialBroadcasts,
    initialAuditLogs,
    initialFlags,
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
  return (
    <AdminConsole
      actor={user}
      initialTab={SECTION_TO_ADMIN_TAB[section] ?? 'users'}
      initialUsers={listLocalDemoUsers()}
      initialPlans={initialPlans}
      providerHealth={providerHealth}
      apiUsage={getApiUsageMetrics()}
      searchAnalytics={getSearchAnalyticsMetrics()}
      conversionAnalytics={conversionAnalytics}
      experiments={DEFAULT_EXPERIMENTS}
      initialCms={initialCms}
      initialTickets={initialTickets}
      initialBroadcasts={initialBroadcasts}
      initialAuditLogs={initialAuditLogs}
      initialFlags={initialFlags}
    />
  );
}
