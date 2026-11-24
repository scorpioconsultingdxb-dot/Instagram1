import Link from 'next/link';
import { DEFAULT_LOCALE, isSupportedLocale } from '@/i18n/config';

export default async function ForgotPasswordPage({
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
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
          Password recovery uses Supabase Auth’s signed recovery emails. Once Supabase Auth and
          verified email delivery are configured, enter your account email to receive a one-time
          reset link.
        </p>
        <form action={`/${safeLocale}/verify-email`} className="mt-5 space-y-4">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Account email
            </span>
            <input
              type="email"
              required
              placeholder="you@company.com"
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
            />
          </label>
          <button
            type="submit"
            className="h-11 w-full rounded-xl bg-[#7957FF] text-sm font-semibold text-white hover:bg-[#6441f5]"
          >
            Send Recovery Instructions
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          <Link href={`/${safeLocale}/login`} className="font-semibold text-[#7957FF] hover:underline">
            Back to Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
