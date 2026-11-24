import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { getCurrentSessionUser, isAdminRole } from '@/lib/auth/session';
import { resolveEntitlements } from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import {
  CustomerDashboard,
  type DashboardSavedProfile,
} from '@/components/dashboard/CustomerDashboard';

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
    path: '/dashboard',
    title: 'Customer Dashboard — Viewora',
    description: 'Manage saved public Instagram profiles, analytics charts, and reports.',
    noIndex: true,
  });
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { locale } = await params;
  const { saved } = await searchParams;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/${safeLocale}/login?next=/${safeLocale}/dashboard`);
  }

  const dict = getDictionary(safeLocale);
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
  });

  const starterHandles = Array.from(
    new Set(
      [saved, 'viewora.studio', 'aurora.coffee'].filter((h): h is string => Boolean(h))
    )
  ).slice(0, entitlements.rules.tracked_profiles.numericLimit ?? 3);

  const initialProfiles: DashboardSavedProfile[] = [];
  for (const handle of starterHandles) {
    const res = await defaultProviderRegistry.lookupPublicProfile(handle, {
      allowDemoFallback: true,
    });
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
