import type { Metadata } from 'next';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { getConfiguredPlans } from '@/lib/entitlements/service';
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
    title: 'Pricing Plans (Demo) — Viewora',
    description:
      'Compare Viewora Free, Starter, Premium, Pro, and Agency plans with transparent monthly, quarterly, and annual billing options.',
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Simple, Transparent Plans
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          Start free with public profile lookups and 12 analytics &amp; planning tools. Explore
          clear, entitlement-driven tiers for Personal, Business, and Agency workflows.
        </p>
      </div>

      <div className="mt-10">
        <PricingExperience
          locale={safeLocale}
          plans={plans}
          paymentsEnabled={paymentsEnabled}
        />
      </div>
    </div>
  );
}
