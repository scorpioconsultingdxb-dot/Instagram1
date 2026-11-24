import type { Metadata } from 'next';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SignupForm } from '@/components/auth/SignupForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  return buildPageMetadata({
    locale: safeLocale,
    path: '/register',
    title: 'Create Account — Viewora',
    description: 'Create your free Viewora account with transparent privacy controls.',
    noIndex: true,
  });
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ handle?: string }>;
}) {
  const { locale } = await params;
  const { handle } = await searchParams;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
        <h1 className="text-2xl font-extrabold text-[#0F172A] dark:text-white">
          Create your free Viewora account
        </h1>
        <p className="mt-1.5 text-sm text-[#64748B] dark:text-slate-400">
          No Instagram password or credit card required. Choose your workflow and email preferences.
        </p>

        <div className="mt-6">
          <SignupForm locale={safeLocale} initialHandle={handle} />
        </div>
      </div>
    </div>
  );
}
