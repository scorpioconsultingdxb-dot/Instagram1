import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale } from '@/i18n/config';

export default async function DisabledCheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm dark:border-amber-900/60 dark:bg-[#131C2E]">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-extrabold text-[#0F172A] dark:text-white">
          Checkout Disabled (Phase 7 Reserved)
        </h1>
        <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
          Live Stripe checkout and payment collection are intentionally disabled (
          <code className="font-mono">PAYMENTS_ENABLED=false</code>). No payment details are
          collected.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={`/${safeLocale}/pricing`}
            className="rounded-xl bg-[#7957FF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6441f5]"
          >
            Back to Pricing
          </Link>
          <Link
            href={`/${safeLocale}/dashboard`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Open Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
