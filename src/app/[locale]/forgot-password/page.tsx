import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { isDatabaseConfigured } from '@/lib/env';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const dynamic = 'force-dynamic';

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <div className="viewora-card-elevated rounded-3xl p-7">
        <h1 className="font-display text-xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
          Enter your Viewora account email to generate a single-use, expiring password reset token.
        </p>
        <div className="mt-5">
          <ForgotPasswordForm
            locale={safeLocale}
            databaseConfigured={isDatabaseConfigured()}
          />
        </div>
      </div>
    </div>
  );
}
