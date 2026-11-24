import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE, isSupportedLocale } from '@/i18n/config';

export default async function CheckoutSuccessReserved({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  redirect(`/${safeLocale}/checkout`);
}
