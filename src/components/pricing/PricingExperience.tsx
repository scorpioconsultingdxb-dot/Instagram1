'use client';

import Link from 'next/link';
import { Check, Info, Minus, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type {
  BillingInterval,
  FeatureKey,
  PlanDefinition,
} from '@/lib/entitlements/types';
import { calculateIntervalPrice, FEATURE_LABELS } from '@/lib/entitlements/catalog';

const INTERVALS: Array<{ id: BillingInterval; label: string; badge?: string }> = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly', badge: 'Save 15%' },
  { id: 'annual', label: 'Annual', badge: 'Save 30%' },
];

export function PricingExperience({
  locale,
  plans,
  paymentsEnabled,
}: {
  locale: Locale;
  plans: PlanDefinition[];
  paymentsEnabled: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [selectedNotice, setSelectedNotice] = useState<string | null>(null);
  const [submittingCode, setSubmittingCode] = useState<string | null>(null);

  const handleSelectPlan = async (plan: PlanDefinition) => {
    setSubmittingCode(plan.code);
    setSelectedNotice(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode: plan.code, interval, locale }),
      });
      const json = (await res.json()) as { message?: string };
      setSelectedNotice(
        json.message ||
          `${plan.name} (${interval}) preview recorded. Live payments remain disabled until approved.`
      );
    } catch {
      setSelectedNotice('Unable to record plan preview right now.');
    } finally {
      setSubmittingCode(null);
    }
  };

  const featureKeys = Object.keys(FEATURE_LABELS) as FeatureKey[];

  return (
    <div className="space-y-10">
      {/* Transparent Demo Pricing & Payments Disabled Disclosure */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              Demonstration Pricing Only — Live Payments Disabled
            </p>
            <p className="mt-1 text-xs leading-relaxed">
              Prices and billing discounts below are shown strictly for demonstration and
              architecture verification. No credit cards are collected and no charges are processed
              until live billing is explicitly approved.
            </p>
          </div>
        </div>
      </div>

      {/* Billing Interval Toggle */}
      <div className="flex flex-col items-center gap-3">
        <div
          role="radiogroup"
          aria-label="Billing interval"
          className="inline-flex flex-wrap justify-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          {INTERVALS.map((opt) => {
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
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span>{opt.label}</span>
                {opt.badge ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {opt.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {selectedNotice ? (
        <div
          role="status"
          className="mx-auto max-w-3xl rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200"
        >
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{selectedNotice}</p>
          </div>
        </div>
      ) : null}

      {/* 5 Plan Cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
        {plans.map((plan) => {
          const calc = calculateIntervalPrice(plan, interval);
          return (
            <article
              key={plan.code}
              className={`flex flex-col justify-between rounded-2xl border p-5 shadow-sm ${
                plan.highlighted
                  ? 'border-indigo-500 bg-white ring-1 ring-indigo-500 dark:border-indigo-400 dark:bg-slate-900'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {plan.targetSegment}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{plan.description}</p>

                <div className="mt-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      {calc.formattedMonthly}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">/ mo</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {plan.monthlyPriceCents === 0
                      ? 'Free forever · Demo pricing'
                      : interval === 'monthly'
                        ? 'Billed monthly (demo only)'
                        : `${calc.formattedTotal} per ${calc.months} mo (${calc.discountPercent}% off · demo)`}
                  </p>
                </div>

                <ul className="mt-5 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <li>
                    <strong>{plan.entitlements.daily_searches.numericLimit}</strong> daily searches
                  </li>
                  <li>
                    <strong>{plan.entitlements.tracked_profiles.numericLimit}</strong> tracked
                    profiles
                  </li>
                  <li>
                    {plan.entitlements.historical_analytics_days.enabled
                      ? `${plan.entitlements.historical_analytics_days.numericLimit}-day public history`
                      : 'Current public snapshot only'}
                  </li>
                  <li>
                    {plan.entitlements.ai_profile_reports.enabled
                      ? `${plan.entitlements.ai_profile_reports.numericLimit} AI reports / mo`
                      : 'No AI reports'}
                  </li>
                  <li>
                    {plan.entitlements.pdf_export.enabled
                      ? 'CSV & PDF exports'
                      : plan.entitlements.csv_export.enabled
                        ? 'CSV exports only'
                        : 'No report exports'}
                  </li>
                </ul>
              </div>

              <div className="mt-6">
                {plan.code === 'free' ? (
                  <Link
                    href={`/${locale}/auth/signup`}
                    className="block w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 text-center text-xs font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    Start Free Account
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={submittingCode === plan.code}
                    onClick={() => void handleSelectPlan(plan)}
                    className={`w-full rounded-xl py-2.5 text-xs font-semibold transition disabled:opacity-60 ${
                      plan.highlighted
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300'
                    }`}
                  >
                    {paymentsEnabled ? `Choose ${plan.name}` : 'Preview Plan (Payments Disabled)'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Full Centralized Entitlement Comparison Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Transparent Entitlement Matrix
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Driven directly by Viewora’s centralized entitlement service — no hidden limits.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                  Capability
                </th>
                {plans.map((p) => (
                  <th
                    key={p.code}
                    className="px-4 py-3 text-center font-semibold text-slate-900 dark:text-white"
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {featureKeys.map((key) => {
                const meta = FEATURE_LABELS[key];
                return (
                  <tr key={key}>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                      {meta.label}
                    </td>
                    {plans.map((plan) => {
                      const rule = plan.entitlements[key];
                      return (
                        <td key={plan.code} className="px-4 py-3 text-center">
                          {!rule.enabled ? (
                            <Minus
                              className="mx-auto h-4 w-4 text-slate-300 dark:text-slate-700"
                              aria-label="Not included"
                            />
                          ) : rule.numericLimit === null ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              Included
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-900 dark:text-white">
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
