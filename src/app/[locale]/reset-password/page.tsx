import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="viewora-card-elevated rounded-3xl p-7">
        <h1 className="font-display text-xl font-extrabold text-[#0F172A] dark:text-white">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
          Provide your single-use password reset token and choose a new password. All prior sessions
          will be signed out automatically.
        </p>
        <div className="mt-5">
          <ResetPasswordForm locale={safeLocale} initialToken={token ?? ''} />
        </div>
      </div>
    </div>
  );
}
