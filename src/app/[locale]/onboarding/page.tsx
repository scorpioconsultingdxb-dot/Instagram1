'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { CustomerSegment } from '@/lib/entitlements/types';

const USE_CASES: Array<{ id: string; label: string; segment: CustomerSegment }> = [
  { id: 'personal_browsing', label: 'Personal browsing', segment: 'personal' },
  { id: 'own_account', label: 'Own-account analytics', segment: 'personal' },
  { id: 'competitor_research', label: 'Business competitor research', segment: 'business' },
  { id: 'influencer_research', label: 'Influencer research', segment: 'business' },
  { id: 'marketing_agency', label: 'Marketing agency', segment: 'agency' },
  { id: 'other', label: 'Other', segment: 'personal' },
];

export default function OnboardingPage() {
  const params = useParams<{ locale: string }>();
  const locale = params?.locale || 'en';
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedUseCase, setSelectedUseCase] = useState(USE_CASES[0]!);
  const [starterHandle, setStarterHandle] = useState('viewora.studio');
  const [workspaceName, setWorkspaceName] = useState('Primary Workspace');

  const finishOnboarding = async () => {
    await fetch('/api/auth/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment: selectedUseCase.segment }),
    }).catch(() => {});
    router.push(`/${locale}/dashboard?saved=${encodeURIComponent(starterHandle)}`);
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#7957FF]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Step {step} of 4
          </span>
          <Link href={`/${locale}/dashboard`} className="hover:underline">
            Skip onboarding →
          </Link>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-[#7957FF] transition-all"
            style={{ width: `${step * 25}%` }}
          />
        </div>

        {step === 1 ? (
          <div className="mt-6 space-y-4">
            <h1 className="text-2xl font-extrabold text-[#0F172A] dark:text-white">
              Welcome to Viewora
            </h1>
            <p className="text-sm text-[#64748B] dark:text-slate-300">
              Let’s tailor your workspace in under a minute. You can skip any step and adjust all
              preferences later from Settings.
            </p>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#7957FF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6441f5]"
            >
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 space-y-4">
            <h1 className="text-xl font-extrabold text-[#0F172A] dark:text-white">
              How do you plan to use Viewora?
            </h1>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {USE_CASES.map((uc) => (
                <button
                  key={uc.id}
                  type="button"
                  onClick={() => setSelectedUseCase(uc)}
                  className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${
                    selectedUseCase.id === uc.id
                      ? 'border-[#7957FF] bg-violet-50 text-[#7957FF] dark:bg-violet-950/40 dark:text-[#A99AFF]'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-[#080D19] dark:text-slate-200'
                  }`}
                >
                  {uc.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#7957FF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6441f5]"
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 space-y-4">
            <h1 className="text-xl font-extrabold text-[#0F172A] dark:text-white">
              Add an eligible profile or connect Meta OAuth
            </h1>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Starter public or demo username
              <input
                type="text"
                value={starterHandle}
                onChange={(e) => setStarterHandle(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
              />
            </label>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Official Meta OAuth connection can also be linked anytime from Dashboard Settings.
            </p>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#7957FF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6441f5]"
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="mt-6 space-y-4">
            <h1 className="text-xl font-extrabold text-[#0F172A] dark:text-white">
              Configure your workspace
            </h1>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Workspace Name
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => void finishOnboarding()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#7957FF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6441f5]"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Open Dashboard
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
