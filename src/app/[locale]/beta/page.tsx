import type { Metadata } from 'next';
import { DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { isBetaPublicRegistrationOpen } from '@/lib/beta/service';
import { BetaAccessClient } from '@/components/beta/BetaAccessClient';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  return buildPageMetadata({
    locale: safeLocale,
    path: '/beta',
    title: 'Controlled Beta Access',
    description: 'Invitation-only controlled beta registration for Viewora.',
    noIndex: true,
  });
}

export default function BetaPage() {
  return <BetaAccessClient publicRegistrationOpen={isBetaPublicRegistrationOpen()} />;
}
