import type { Metadata } from 'next';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { isDatabaseConfigured, isDemoModeEnabled } from '@/lib/env';
import { LoginForm } from '@/components/auth/LoginForm';

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
    path: '/login',
    title: dict.auth.signInCta,
    description: dict.auth.loginSubtitle,
    noIndex: true,
  });
}

export default async function TopLevelLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const dict = getDictionary(safeLocale);

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <div className="viewora-card-elevated rounded-3xl p-7 sm:p-8">
        <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
          {dict.auth.loginTitle}
        </h1>
        <p className="mt-1.5 text-sm text-[#64748B] dark:text-[#94A3B8]">
          {dict.auth.loginSubtitle}
        </p>

        <div className="mt-6">
          <LoginForm
            locale={safeLocale}
            dict={dict}
            databaseConfigured={isDatabaseConfigured()}
            demoModeEnabled={isDemoModeEnabled()}
            redirectTo={next}
          />
        </div>
      </div>
    </div>
  );
}
