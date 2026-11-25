'use client';

import Link from 'next/link';
import { Check, CheckCircle2, Info, Loader2, Minus, ShieldAlert, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { getDictionary } from '@/i18n/get-dictionary';
import type {
  BillingInterval,
  FeatureKey,
  PlanCode,
  PlanDefinition,
} from '@/lib/entitlements/types';
import { calculateIntervalPrice, FEATURE_LABELS, formatUsdCents } from '@/lib/entitlements/catalog';
import { MembershipBadge } from '@/components/ui/Primitives';

export function PricingExperience({
  locale,
  dict: providedDict,
  plans,
  paymentsEnabled,
  currentPlanCode,
}: {
  locale: Locale;
  dict?: Dictionary;
  plans: PlanDefinition[];
  paymentsEnabled: boolean;
  currentPlanCode?: PlanCode | null;
}) {
  const dict = providedDict ?? getDictionary(locale);
  const t = dict.pricing;
  const [interval, setInterval] = useState<BillingInterval>('annual');
  const [selectedNotice, setSelectedNotice] = useState<string | null>(null);
  const [submittingCode, setSubmittingCode] = useState<string | null>(null);

  const samplePaidPlan = plans.find((p) => p.monthlyPriceCents > 0);
  const quarterlyDiscount =
    samplePaidPlan?.billingOptions.find((o) => o.interval === 'quarterly')?.discountPercent ?? 15;
  const annualDiscount =
    samplePaidPlan?.billingOptions.find((o) => o.interval === 'annual')?.discountPercent ?? 30;

  const intervals: Array<{ id: BillingInterval; label: string; badge?: string }> = [
    { id: 'monthly', label: t.monthly },
    { id: 'quarterly', label: t.quarterly, badge: `${t.savePrefix} ${quarterlyDiscount}%` },
    { id: 'annual', label: t.annual, badge: `${t.savePrefix} ${annualDiscount}%` },
  ];

  const handleSelectPlan = async (plan: PlanDefinition) => {
    setSubmittingCode(plan.code);
    setSelectedNotice(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: plan.code, interval, locale }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      setSelectedNotice(
        json.message ||
          json.error ||
          `${plan.name} (${interval}) preview recorded. Live payments remain strictly disabled — no card information is collected.`
      );
    } catch {
      setSelectedNotice('Unable to record plan preview right now. Payments remain disabled.');
    } finally {
      setSubmittingCode(null);
    }
  };

  const featureKeys = Object.keys(FEATURE_LABELS) as FeatureKey[];

  return (
    <div className="space-y-10">
      {/* Transparent Demo Pricing & Disabled Payments Disclosure */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">{t.demoNoticeTitle}</p>
            <p className="mt-1 text-xs leading-relaxed">{t.demoNoticeBody}</p>
          </div>
        </div>
      </div>

      {/* Billing Interval Switcher */}
      <div className="flex flex-col items-center gap-2.5">
        <div
          role="radiogroup"
          aria-label="Billing interval"
          className="viewora-card inline-flex flex-wrap justify-center gap-1 rounded-2xl p-1.5"
        >
          {intervals.map((opt) => {
            const active = interval === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setInterval(opt.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-[#7957FF] text-white shadow-sm'
                    : 'text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-white'
                }`}
              >
                <span>{opt.label}</span>
                {opt.badge ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-[#34D399]'
                    }`}
                  >
                    {opt.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          {t.showingLabel}{' '}
          <strong className="text-[#0F172A] dark:text-white">
            {interval === 'monthly'
              ? t.monthlyBilling
              : interval === 'quarterly'
                ? `${t.quarterlyBilling} (${quarterlyDiscount}% ${t.savingsWord})`
                : `${t.annualBilling} (${annualDiscount}% ${t.savingsWord})`}
          </strong>{' '}
          · {t.synchronizedNote}
        </p>
      </div>

      {selectedNotice ? (
        <div
          role="status"
          className="animate-viewora-enter mx-auto max-w-3xl rounded-2xl border border-violet-200 bg-violet-50/80 p-4 text-xs text-violet-950 dark:border-[#263047] dark:bg-[#192337] dark:text-violet-200"
        >
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#6941EF] dark:text-[#22D3EE]" aria-hidden="true" />
            <p className="leading-relaxed">{selectedNotice}</p>
          </div>
        </div>
      ) : null}

      {/* 5-Tier Synchronized Plan Cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
        {plans.map((plan) => {
          const calc = calculateIntervalPrice(plan, interval);
          const fullPeriodCostCents = plan.monthlyPriceCents * calc.months;
          const savingsCents = Math.max(0, fullPeriodCostCents - calc.billedTotalCents);
          const isCurrent = currentPlanCode === plan.code;

          return (
            <article
              key={plan.code}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                plan.highlighted
                  ? 'viewora-card-elevated border-[#7957FF] ring-1 ring-[#7957FF]/40'
                  : 'viewora-card'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <MembershipBadge planCode={plan.code} />
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-[#34D399]">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      {t.currentBadge}
                    </span>
                  ) : plan.highlighted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-[#6941EF] dark:bg-violet-950 dark:text-[#A99AFF]">
                      <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                      {t.recommendedBadge}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#64748B] dark:bg-[#0F172A] dark:text-[#94A3B8]">
                      {plan.targetSegment}
                    </span>
                  )}
                </div>

                <h2 className="mt-3 font-display text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                  {plan.name}
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                  {plan.description}
                </p>

                <div className="mt-5">
                  <div className="flex items-baseline gap-1 tabular-nums">
                    <span className="font-display text-3xl font-extrabold text-[#0F172A] dark:text-white">
                      {calc.formattedMonthly}
                    </span>
                    <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{t.perMonth}</span>
                  </div>
                  <p className="mt-1 text-[11px] tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                    {plan.monthlyPriceCents === 0
                      ? t.freeForever
                      : interval === 'monthly'
                        ? t.billedMonthlyDemo
                        : `${calc.formattedTotal} / ${calc.months} mo · ${t.savePrefix} ${formatUsdCents(savingsCents)}`}
                  </p>
                </div>

                <ul className="mt-5 space-y-2 text-xs text-[#0F172A] dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#34D399]" aria-hidden="true" />
                    <span>
                      <strong className="tabular-nums">
                        {plan.entitlements.daily_searches.numericLimit === null
                          ? '∞'
                          : plan.entitlements.daily_searches.numericLimit}
                      </strong>{' '}
                      {t.dailySearches}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#34D399]" aria-hidden="true" />
                    <span>
                      <strong className="tabular-nums">
                        {plan.entitlements.tracked_profiles.numericLimit === null
                          ? '∞'
                          : plan.entitlements.tracked_profiles.numericLimit}
                      </strong>{' '}
                      {plan.entitlements.tracked_profiles.numericLimit === 1
                        ? t.savedProfileSingular
                        : t.savedProfilePlural}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#34D399]" aria-hidden="true" />
                    <span>
                      {plan.entitlements.historical_analytics_days.enabled
                        ? `${plan.entitlements.historical_analytics_days.numericLimit ?? '∞'}${t.dayHistorySuffix}`
                        : t.currentSnapshotOnly}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#34D399]" aria-hidden="true" />
                    <span>
                      {plan.entitlements.ai_profile_reports.enabled
                        ? `${plan.entitlements.ai_profile_reports.numericLimit ?? '∞'} ${t.aiReportsSuffix}`
                        : t.freeToolsIncluded}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#34D399]" aria-hidden="true" />
                    <span>
                      {plan.entitlements.pdf_export.enabled && plan.entitlements.csv_export.enabled
                        ? t.pdfAndCsvExports
                        : plan.entitlements.pdf_export.enabled
                          ? t.pdfExportsIncluded
                          : plan.entitlements.csv_export.enabled
                            ? t.csvExportsOnly
                            : t.noReportExports}
                    </span>
                  </li>
                </ul>
              </div>

              <div className="mt-6">
                {isCurrent ? (
                  <Link
                    href={`/${locale}/dashboard/subscription`}
                    className="block w-full rounded-xl border border-emerald-300 bg-emerald-50 py-2.5 text-center text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-[#34D399]"
                  >
                    {t.manageCurrentPlan}
                  </Link>
                ) : plan.code === 'free' ? (
                  <Link
                    href={`/${locale}/register`}
                    className="block w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 text-center text-xs font-semibold text-[#0F172A] transition hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A] dark:text-slate-100"
                  >
                    {t.startFreeAccount}
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={submittingCode === plan.code}
                    onClick={() => void handleSelectPlan(plan)}
                    className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition disabled:opacity-60 ${
                      plan.highlighted
                        ? 'viewora-btn-primary shadow-sm'
                        : 'border border-violet-200 bg-violet-50 text-[#6941EF] hover:bg-violet-100 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-[#A99AFF]'
                    }`}
                  >
                    {submittingCode === plan.code ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    {paymentsEnabled
                      ? `${t.choosePlanPrefix} ${plan.name}`
                      : `${t.previewPlanPrefix} ${plan.name} ${t.previewPlanSuffix}`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Authoritative Centralized Entitlement Comparison Table */}
      <section className="viewora-card overflow-hidden rounded-3xl">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-[#263047]">
          <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            {t.matrixTitle}
          </h2>
          <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">{t.matrixSubtitle}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-[#263047] dark:bg-[#0F172A]">
                <th className="px-4 py-3 font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  {t.capabilityHeading}
                </th>
                {plans.map((p) => (
                  <th
                    key={p.code}
                    className="px-4 py-3 text-center font-bold text-[#0F172A] dark:text-white"
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#263047]">
              {featureKeys.map((key) => {
                const meta = FEATURE_LABELS[key];
                return (
                  <tr key={key}>
                    <td className="px-4 py-3 font-medium text-[#0F172A] dark:text-slate-300">
                      {meta.label}
                    </td>
                    {plans.map((plan) => {
                      const rule = plan.entitlements[key];
                      return (
                        <td key={plan.code} className="px-4 py-3 text-center">
                          {!rule.enabled ? (
                            <Minus
                              className="mx-auto h-4 w-4 text-slate-300 dark:text-slate-700"
                              aria-label={t.notIncluded}
                            />
                          ) : rule.numericLimit === null ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-[#34D399]">
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              {t.included}
                            </span>
                          ) : (
                            <span className="font-semibold text-[#0F172A] dark:text-white">
                              {rule.numericLimit} {meta.unit ?? ''}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
