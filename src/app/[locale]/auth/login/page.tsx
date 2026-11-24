import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE, isSupportedLocale } from '@/i18n/config';

export default async function LegacyAuthLoginRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  redirect(`/${safeLocale}/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
}
