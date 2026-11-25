import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { resolveEntitlements } from '@/lib/entitlements/service';
import { getAccountProfilePrefs } from '@/lib/auth/profile-prefs';
import { getWorkspaceUsageStats } from '@/lib/dashboard/store';
import { ProfileHeadquarters } from '@/components/profile/ProfileHeadquarters';

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
    path: '/dashboard/profile',
    title: 'My Profile — Personal Digital HQ',
    description:
      'Customize your Viewora personal digital headquarters, avatar, cover banner, accent palette, shortcuts, workspace identity, membership, and privacy controls.',
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

  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/${safeLocale}/login?next=/${safeLocale}/dashboard/profile`);
  }

  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
  });

  const initialPrefs = await getAccountProfilePrefs(user.id);
  const usageStats = getWorkspaceUsageStats(user.id);

  return (
    <ProfileHeadquarters
      locale={safeLocale}
      user={user}
      entitlements={entitlements}
      initialPrefs={initialPrefs}
      usageStats={usageStats}
    />
  );
}
