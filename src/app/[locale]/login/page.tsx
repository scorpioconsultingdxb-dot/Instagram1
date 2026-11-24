import type { Metadata } from 'next';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { isDemoModeEnabled, isSupabaseConfigured } from '@/lib/env';
import { LoginForm } from '@/components/auth/LoginForm';

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
    path: '/login',
    title: 'Sign in — Viewora',
    description: 'Sign in securely to your Viewora social intelligence workspace.',
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

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
        <h1 className="text-2xl font-extrabold text-[#0F172A] dark:text-white">
          Sign in to Viewora
        </h1>
        <p className="mt-1.5 text-sm text-[#64748B] dark:text-slate-400">
          Access saved public profiles, historical trends, AI reports, and workspace settings.
        </p>

        <div className="mt-6">
          <LoginForm
            locale={safeLocale}
            supabaseConfigured={isSupabaseConfigured()}
            demoModeEnabled={isDemoModeEnabled()}
            redirectTo={next}
          />
        </div>
      </div>
    </div>
  );
}
