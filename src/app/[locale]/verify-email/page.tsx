import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale } from '@/i18n/config';

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
        <MailCheck className="mx-auto h-10 w-10 text-[#7957FF]" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-extrabold text-[#0F172A] dark:text-white">
          Check your email inbox
        </h1>
        <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
          If an account exists for that email address and Supabase email delivery is configured, a
          secure verification or recovery link has been sent.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={`/${safeLocale}/login`}
            className="rounded-xl bg-[#7957FF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6441f5]"
          >
            Go to Sign in
          </Link>
          <Link
            href={`/${safeLocale}`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
