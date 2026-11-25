import type { Metadata } from 'next';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { getConfiguredPlans } from '@/lib/entitlements/service';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { isPaymentsEnabled } from '@/lib/env';
import { PricingExperience } from '@/components/pricing/PricingExperience';

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
    path: '/pricing',
    title: 'Pricing Plans (Demo)',
    description:
      'Compare Viewora Free, Starter, Premium, Pro, and Agency plans with transparent monthly, quarterly (15% off), and annual (30% off) billing options.',
  });
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const plans = getConfiguredPlans().filter((p) => p.isActive);
  const paymentsEnabled = isPaymentsEnabled();
  const user = await getCurrentSessionUser();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-[#6941EF] dark:border-violet-800/60 dark:bg-violet-950/60 dark:text-[#A99AFF]">
          5 Synchronized Membership Tiers · Payments Disabled
        </span>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl dark:text-[#F8FAFC]">
          Simple, Transparent Plans
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
          Start free with public profile lookups and 12 analytics &amp; planning tools. Explore
          entitlement-driven tiers for Personal, Business, and Agency workflows.
        </p>
      </div>

      <div className="mt-10">
        <PricingExperience
          locale={safeLocale}
          plans={plans}
          paymentsEnabled={paymentsEnabled}
          currentPlanCode={user?.planCode ?? null}
        />
      </div>
    </div>
  );
}
