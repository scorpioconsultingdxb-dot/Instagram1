import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { getCurrentSessionUser, isAdminRole, listLocalDemoUsers } from '@/lib/auth/session';
import { getConfiguredPlans } from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import { PROVIDER_EVALUATION_MATRIX } from '@/lib/providers/resilience';
import { getAiCostSummary } from '@/lib/ai/gemini';
import { defaultJobQueue } from '@/lib/jobs/queue';
import { listEmailDeliveries } from '@/lib/email/resend';
import { getReferralOverview } from '@/lib/referrals/service';
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

const ADMIN_SECTIONS = new Set([
  'customers',
  'workspaces',
  'plans',
  'subscriptions',
  'entitlements',
  'providers',
  'jobs',
  'ai-usage',
  'notifications',
  'email',
  'support',
  'analytics',
  'conversions',
  'content',
  'seo',
  'referrals',
  'system-health',
  'feature-flags',
  'audit-logs',
  'settings',
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
        <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm dark:border-rose-900/60 dark:bg-[#131C2E]">
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-600" />
          <h1 className="mt-4 text-xl font-extrabold text-[#0F172A] dark:text-white">
            403 — Administrator Access Required
          </h1>
          <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
            Role <code className="font-mono">{user.role}</code> cannot access /admin/{section}.
          </p>
        </div>
      </div>
    );
  }

  if (section === 'jobs' || section === 'ai-usage' || section === 'email' || section === 'referrals' || section === 'system-health') {
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
          Back to Super Admin Overview
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold capitalize text-[#0F172A] dark:text-white">
          Admin · {section.replace('-', ' ')}
        </h1>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#131C2E]">
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">
              Background Jobs Queue
            </h2>
            <p className="mt-2 font-mono text-xs text-slate-600 dark:text-slate-300">
              Queued: {jobSummary.queued} · Running: {jobSummary.running} · Completed:{' '}
              {jobSummary.completed} · Dead-letter: {jobSummary.deadLetter}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Heartbeat: {jobSummary.lastHeartbeatAt ?? 'Not yet triggered'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#131C2E]">
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">
              AI Usage &amp; Cost Budgets
            </h2>
            <p className="mt-2 font-mono text-xs text-slate-600 dark:text-slate-300">
              Daily: ${aiSummary.dailySpentUsd.toFixed(4)} / ${aiSummary.dailyBudgetUsd} · Monthly:
              ${aiSummary.monthlySpentUsd.toFixed(4)} / ${aiSummary.monthlyBudgetUsd}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Gemini Live Configured: {String(aiSummary.geminiConfigured)} · Kill Switch:{' '}
              {String(aiSummary.killSwitchActive)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#131C2E]">
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">
              Transactional Email Deliveries ({emails.length})
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              External Resend delivery stays disabled until EMAIL_NOTIFICATIONS_ENABLED=true and
              RESEND_API_KEY + SPF/DKIM/DMARC are configured.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#131C2E]">
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">
              Referral &amp; Affiliate Architecture
            </h2>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              Proposed Commission: {referrals.proposedCommissionPercent}% for{' '}
              {referrals.proposedCommissionMonths} months · Payouts Enabled:{' '}
              <strong>{String(referrals.payoutsEnabled)}</strong> (Disabled until Phase 7).
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#131C2E]">
          <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">
            Provider Commercial Evaluation Matrix
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Commercial Rights</th>
                  <th className="py-2 pr-3">Coverage</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {PROVIDER_EVALUATION_MATRIX.map((row) => (
                  <tr key={row.providerName}>
                    <td className="py-2.5 pr-3 font-semibold">{row.providerName}</td>
                    <td className="py-2.5 pr-3">{row.commercialRights}</td>
                    <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-400">
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

  const providerHealth = await defaultProviderRegistry.checkAllHealth();
  return (
    <AdminConsole
      actor={user}
      initialUsers={listLocalDemoUsers()}
      initialPlans={getConfiguredPlans()}
      providerHealth={providerHealth}
      apiUsage={getApiUsageMetrics()}
      searchAnalytics={getSearchAnalyticsMetrics()}
      conversionAnalytics={getFunnelSummary()}
      experiments={DEFAULT_EXPERIMENTS}
      initialCms={listCmsContent()}
      initialTickets={listSupportTickets()}
      initialAuditLogs={listAuditLogs()}
      initialFlags={listFeatureFlags()}
    />
  );
}
