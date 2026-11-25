import Link from 'next/link';
import { ArrowRight, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { loadReferralCodeRecord, recordReferralLandingVisit } from '@/lib/referrals/service';
import { isDatabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function ReferralLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; code: string }>;
  searchParams: Promise<{ utm_campaign?: string }>;
}) {
  const { locale, code } = await params;
  const { utm_campaign } = await searchParams;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const normalizedCode = code.trim().toUpperCase();

  let record = null;
  try {
    record = await loadReferralCodeRecord(normalizedCode);
    if (record && !isDatabaseConfigured()) {
      recordReferralLandingVisit(normalizedCode, utm_campaign);
    }
  } catch {
    // Never crash public referral landing pages on read-only filesystems
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6" data-page-ready="referral-landing">
      <div className="viewora-card-elevated rounded-3xl p-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Viewora Community Invitation
        </span>
        <h1 className="mt-4 font-display text-3xl font-extrabold text-[#0F172A] dark:text-white">
          Explore More. Discover More.
        </h1>
        <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
          {record
            ? `You were invited with referral code ${record.code}. Create a free Viewora workspace to access 12 free Instagram analytics tools, private research projects, and transparent data provenance.`
            : `Referral code "${normalizedCode}" was not found in our active directory, or has expired. You can still create a free Viewora workspace below.`}
        </p>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p>
              <strong>Transparent Attribution Notice:</strong> First-party referral attribution is
              recorded only with your explicit consent during account creation. Billing and
              referral payouts remain disabled.
            </p>
          </div>
        </div>

        <ul className="mt-6 grid gap-2 text-left text-xs text-[#64748B] sm:grid-cols-2 dark:text-[#94A3B8]">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            12 free deterministic Instagram calculators
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            Private research projects &amp; CSV import
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            Transparent LIVE / CACHED / DEMO labels
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            Zero credit card required
          </li>
        </ul>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${safeLocale}/register${record ? `?ref=${encodeURIComponent(record.code)}` : ''}`}
            className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold"
          >
            Create Free Account
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/${safeLocale}/tools`}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-white"
          >
            Try 12 Free Tools First
          </Link>
        </div>
      </div>
    </div>
  );
}
