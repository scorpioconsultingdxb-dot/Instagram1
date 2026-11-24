import Link from 'next/link';
import { DEFAULT_LOCALE, isSupportedLocale } from '@/i18n/config';

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
        <h1 className="text-xl font-extrabold text-[#0F172A] dark:text-white">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
          Arrive at this page from your Supabase password-recovery email link to set a new password
          for your account.
        </p>
        <div className="mt-6">
          <Link
            href={`/${safeLocale}/login`}
            className="inline-block rounded-xl bg-[#7957FF] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#6441f5]"
          >
            Return to Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
