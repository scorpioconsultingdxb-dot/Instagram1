import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE, isSupportedLocale } from '@/i18n/config';

export default async function LegacyAuthSignupRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ handle?: string; next?: string; segment?: string }>;
}) {
  const { locale } = await params;
  const { handle, next, segment } = await searchParams;
  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  const qs = new URLSearchParams();
  if (handle) qs.set('handle', handle);
  if (next) qs.set('next', next);
  if (segment) qs.set('segment', segment);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  redirect(`/${safeLocale}/register${suffix}`);
}
