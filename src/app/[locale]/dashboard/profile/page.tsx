import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { loadConfiguredPlans, resolveEntitlements } from '@/lib/entitlements/service';
import { getAccountProfilePrefs } from '@/lib/auth/profile-prefs';
import { loadWorkspaceUsageStats } from '@/lib/dashboard/store';
import { ProfileHeadquarters } from '@/components/profile/ProfileHeadquarters';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const dict = getDictionary(safeLocale);
  return buildPageMetadata({
    locale: safeLocale,
    path: '/dashboard/profile',
    title: dict.profileHq.breadcrumbTitle,
    description: dict.profileHq.summaryBody,
    noIndex: true,
  });
}

export default async function UserProfileHeadquartersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const dict = getDictionary(safeLocale);

  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/${safeLocale}/login?next=/${safeLocale}/dashboard/profile`);
  }

  const plans = await loadConfiguredPlans();
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
    plans,
  });

  const initialPrefs = await getAccountProfilePrefs(user.id);
  const usageStats = await loadWorkspaceUsageStats(user.id);

  return (
    <ProfileHeadquarters
      locale={safeLocale}
      dict={dict}
      user={user}
      entitlements={entitlements}
      initialPrefs={initialPrefs}
      usageStats={usageStats}
    />
  );
}
