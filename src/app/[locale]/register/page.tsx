import type { Metadata } from 'next';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { isDemoModeEnabled, isSupabaseConfigured } from '@/lib/env';
import type { CustomerSegment } from '@/lib/entitlements/types';
import { SignupForm } from '@/components/auth/SignupForm';

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
    path: '/register',
    title: 'Create Account',
    description: 'Create your free Viewora account with transparent privacy controls.',
    noIndex: true,
  });
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ handle?: string; segment?: string; next?: string }>;
}) {
  const { locale } = await params;
  const { handle, segment, next } = await searchParams;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const safeSegment: CustomerSegment =
    segment === 'business' || segment === 'agency' ? segment : 'personal';

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="viewora-card-elevated rounded-3xl p-7 sm:p-8">
        <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
          Create your free Viewora account
        </h1>
        <p className="mt-1.5 text-sm text-[#64748B] dark:text-[#94A3B8]">
          No Instagram password or credit card required. Choose your workflow and notification
          preferences.
        </p>

        <div className="mt-6">
          <SignupForm
            locale={safeLocale}
            initialHandle={handle}
            initialSegment={safeSegment}
            redirectTo={next}
            supabaseConfigured={isSupabaseConfigured()}
            demoModeEnabled={isDemoModeEnabled()}
          />
        </div>
      </div>
    </div>
  );
}
