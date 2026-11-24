import { notFound } from 'next/navigation';
import { isSupportedLocale, SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const typedLocale: Locale = locale;
  const dict = getDictionary(typedLocale);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader locale={typedLocale} dict={dict} />
      <main className="flex-1">{children}</main>
      <SiteFooter locale={typedLocale} dict={dict} />
    </div>
  );
}
