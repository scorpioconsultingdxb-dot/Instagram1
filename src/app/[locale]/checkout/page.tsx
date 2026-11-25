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
    <div className="mx-auto max-w-lg px-4 py-16 text-center" data-page-ready="checkout">
      <div className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm dark:border-amber-900/60 dark:bg-[#131C2E]">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-extrabold text-[#0F172A] dark:text-white">
          Paid Checkout Currently Unavailable
        </h1>
        <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
          Subscription billing and payment collection are not currently active. No payment details
          are collected, and you can continue exploring all 12 free tools at no cost.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${safeLocale}/tools`}
            className="rounded-xl bg-[#7957FF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6441f5]"
          >
            Explore Free Tools
          </Link>
          <Link
            href={`/${safeLocale}/pricing`}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            Back to Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
