import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentSessionUser, isAdminRole } from '@/lib/auth/session';
import { getAccountProfilePrefs } from '@/lib/auth/profile-prefs';
import {
  loadConfiguredPlans,
  loadUserEntitlementOverrides,
  resolveEntitlements,
} from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import { loadUserWorkspaceState, type SavedProfileRecord } from '@/lib/dashboard/store';
import { loadActiveBroadcastNotifications } from '@/lib/admin/store';
import {
  CustomerDashboard,
  type DashboardTab,
} from '@/components/dashboard/CustomerDashboard';
import { SettingsAccountPanel } from '@/components/dashboard/SettingsAccountPanel';

export const dynamic = 'force-dynamic';

const SECTION_TO_TAB: Record<string, DashboardTab> = {
  profiles: 'profiles',
  analytics: 'analytics',
  activity: 'timeline',
  calendar: 'calendar',
  competitors: 'competitors',
  'ai-insights': 'ai',
  reports: 'exports',
  notifications: 'notifications',
  subscription: 'billing',
  support: 'support',
};

const VALID_SECTIONS = new Set([
  ...Object.keys(SECTION_TO_TAB),
  'billing',
  'settings',
]);

export default async function DashboardSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; section: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const { locale, section } = await params;
  const { demo } = await searchParams;
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
        <h1 className="mt-4 font-display text-2xl font-extrabold text-[#0F172A] dark:text-white">
          Account &amp; Privacy Settings
        </h1>
        <p className="mt-1 text-sm text-[#64748B] dark:text-slate-400">
          Manage your GDPR, LGPD, and UAE PDPL data rights, personal data export, and permanent
          account deletion.
        </p>

        <div className="mt-6">
          <SettingsAccountPanel locale={safeLocale} userEmail={user.email} />
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
        <div className="viewora-card mt-5 rounded-2xl border-amber-200 p-7 dark:border-amber-900/60">
          <ShieldAlert className="h-8 w-8 text-amber-500" aria-hidden="true" />
          <h1 className="mt-3 font-display text-xl font-extrabold text-[#0F172A] dark:text-white">
            Billing Reserved for Phase 7 (Payments Disabled)
          </h1>
          <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
            Your active entitlement tier is <strong>{user.planCode}</strong> ({user.billingInterval}
            ). Live Stripe billing, invoices, and card collection remain strictly disabled until
            explicitly authorized.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/${safeLocale}/pricing`}
              className="viewora-btn-primary inline-block rounded-xl px-4 py-2 text-xs font-semibold"
            >
              Compare All 5 Membership Tiers
            </Link>
            <Link
              href={`/${safeLocale}/dashboard/subscription`}
              className="inline-block rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#0F172A] dark:border-[#263047] dark:text-slate-200"
            >
              Inspect My Entitlements
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const dict = getDictionary(safeLocale);
  const [plans, overrides, profilePrefs, broadcasts] = await Promise.all([
    loadConfiguredPlans(),
    loadUserEntitlementOverrides(user.id),
    getAccountProfilePrefs(user.id),
    loadActiveBroadcastNotifications(user.segment),
  ]);
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
    plans,
    overrides,
  });

  const defaultWs =
    profilePrefs.workspaceName ||
    (user.segment === 'agency' ? 'Primary Agency HQ' : 'Personal Workspace');
  const workspace = await loadUserWorkspaceState(user.id, defaultWs);

  const demoPreviewProfiles: SavedProfileRecord[] = [];
  const now = new Date().toISOString();
  for (const h of ['viewora.studio', 'aurora.coffee', 'nordic.design']) {
    const res = await defaultProviderRegistry.lookupPublicProfile(h, { allowDemoFallback: true });
    if (res.data) {
      demoPreviewProfiles.push({
        id: `demo-preview-${res.data.username}`,
        username: res.data.username,
        profile: res.data,
        dataClass: res.meta.dataClass,
        providerLabel: res.meta.providerLabel,
        workspace: defaultWs,
        folderId: null,
        tags: ['demo-preview'],
        privateNote: '',
        savedAt: now,
        updatedAt: now,
      });
    }
  }

  return (
    <CustomerDashboard
      locale={safeLocale}
      dict={dict}
      user={user}
      entitlements={entitlements}
      initialWorkspace={workspace}
      demoPreviewProfiles={demoPreviewProfiles}
      profilePrefs={profilePrefs}
      broadcasts={broadcasts}
      isAdmin={isAdminRole(user.role)}
      initialTab={SECTION_TO_TAB[section] ?? 'overview'}
      initialDemoPreview={demo === '1'}
    />
  );
}
