import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Download, ShieldAlert, Trash2 } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentSessionUser, isAdminRole } from '@/lib/auth/session';
import { resolveEntitlements } from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import {
  CustomerDashboard,
  type DashboardSavedProfile,
} from '@/components/dashboard/CustomerDashboard';

export const dynamic = 'force-dynamic';

const VALID_SECTIONS = new Set([
  'profiles',
  'analytics',
  'activity',
  'calendar',
  'competitors',
  'ai-insights',
  'reports',
  'notifications',
  'subscription',
  'billing',
  'settings',
  'support',
]);

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{ locale: string; section: string }>;
}) {
  const { locale, section } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  if (!VALID_SECTIONS.has(section)) {
    notFound();
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/${safeLocale}/login?next=/${safeLocale}/dashboard/${section}`);
  }

  if (section === 'settings') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={`/${safeLocale}/dashboard`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#7957FF]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Dashboard Overview
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold text-[#0F172A] dark:text-white">
          Account &amp; Privacy Settings
        </h1>
        <p className="mt-1 text-sm text-[#64748B] dark:text-slate-400">
          Manage your GDPR, LGPD, and UAE PDPL data rights, Meta OAuth connections, and session
          security.
        </p>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
              Personal Data Export
            </h2>
            <p className="mt-1.5 text-xs text-[#64748B] dark:text-slate-300">
              Download a machine-readable JSON archive of your account profile, preferences, and
              active entitlements.
            </p>
            <Link
              href="/api/auth/export-data"
              prefetch={false}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#7957FF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6441f5]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download My Data (JSON)
            </Link>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-900/50 dark:bg-[#131C2E]">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <h2 className="text-base font-bold">Account Deletion</h2>
            </div>
            <p className="mt-1.5 text-xs text-[#64748B] dark:text-slate-300">
              Permanently revoke sessions and delete your personal account via{' '}
              <code className="font-mono">POST /api/auth/delete-account</code> with email
              confirmation.
            </p>
            <p className="mt-3 rounded-lg bg-slate-50 p-2.5 font-mono text-[11px] text-slate-600 dark:bg-[#080D19] dark:text-slate-400">
              Account: {user.email}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'billing') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={`/${safeLocale}/dashboard`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#7957FF]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Dashboard
        </Link>
        <div className="mt-5 rounded-2xl border border-amber-200 bg-white p-7 shadow-sm dark:border-amber-900/60 dark:bg-[#131C2E]">
          <ShieldAlert className="h-8 w-8 text-amber-500" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-extrabold text-[#0F172A] dark:text-white">
            Billing Reserved for Phase 7 (Payments Disabled)
          </h1>
          <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
            Your active entitlement tier is <strong>{user.planCode}</strong> ({user.billingInterval}
            ). Live Stripe billing, invoices, and card collection remain disabled until Phase 7
            authorization.
          </p>
          <Link
            href={`/${safeLocale}/pricing`}
            className="mt-5 inline-block rounded-xl bg-[#7957FF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6441f5]"
          >
            Inspect Plan Comparison
          </Link>
        </div>
      </div>
    );
  }

  const dict = getDictionary(safeLocale);
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
  });

  const handles = ['viewora.studio', 'aurora.coffee'].slice(
    0,
    entitlements.rules.tracked_profiles.numericLimit ?? 2
  );
  const initialProfiles: DashboardSavedProfile[] = [];
  for (const h of handles) {
    const res = await defaultProviderRegistry.lookupPublicProfile(h, { allowDemoFallback: true });
    if (res.data) {
      initialProfiles.push({
        profile: res.data,
        dataClass: res.meta.dataClass,
        providerLabel: res.meta.providerLabel,
        workspace: user.segment === 'agency' ? 'Primary Agency HQ' : 'Personal Workspace',
      });
    }
  }

  return (
    <CustomerDashboard
      locale={safeLocale}
      dict={dict}
      user={user}
      entitlements={entitlements}
      initialProfiles={initialProfiles}
      isAdmin={isAdminRole(user.role)}
    />
  );
}
