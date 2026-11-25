'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Loader2,
  Sparkles,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import type { CustomerSegment } from '@/lib/entitlements/types';

const WORKFLOW_OPTIONS: Array<{
  id: CustomerSegment;
  title: string;
  desc: string;
  icon: typeof User;
}> = [
  {
    id: 'personal',
    title: 'Personal & Creator',
    desc: 'Quick public profile checks, engagement calculators, and clean personal workspace.',
    icon: User,
  },
  {
    id: 'business',
    title: 'Business & Brand Team',
    desc: 'Competitor benchmarking, growth trajectories, and structured content audits.',
    icon: Building2,
  },
  {
    id: 'agency',
    title: 'Marketing Agency',
    desc: 'Multi-client research folders, private notes, and executive PDF/CSV reporting.',
    icon: Users,
  },
];

export default function OnboardingPage() {
  const params = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const locale = params?.locale || 'en';
  const router = useRouter();

  const initialSegmentParam = searchParams.get('segment');
  const initialHandleParam = searchParams.get('handle') ?? '';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [segment, setSegment] = useState<CustomerSegment>(
    initialSegmentParam === 'business' || initialSegmentParam === 'agency'
      ? initialSegmentParam
      : 'personal'
  );
  const [workspaceName, setWorkspaceName] = useState('Primary Workspace');
  const [firstAction, setFirstAction] = useState<'clean_dashboard' | 'demo_preview' | 'tools'>(
    initialHandleParam ? 'clean_dashboard' : 'demo_preview'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishOnboarding = async () => {
    setSaving(true);
    setError(null);
    try {
      const [prefRes, profRes] = await Promise.all([
        fetch('/api/auth/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segment }),
        }),
        fetch('/api/auth/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceName: workspaceName.trim() || 'Primary Workspace' }),
        }),
      ]);

      if (!prefRes.ok || !profRes.ok) {
        const failedJson = (await (!prefRes.ok ? prefRes : profRes).json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          failedJson?.error ??
            'Could not save your workspace preferences. Sign in first or skip onboarding to continue.'
        );
        return;
      }

      if (firstAction === 'tools') {
        router.push(`/${locale}/tools`);
      } else if (firstAction === 'demo_preview') {
        router.push(`/${locale}/dashboard?demo=1`);
      } else if (initialHandleParam) {
        router.push(`/${locale}/dashboard?saved=${encodeURIComponent(initialHandleParam)}`);
      } else {
        router.push(`/${locale}/dashboard`);
      }
      router.refresh();
    } catch {
      setError('Network error while saving onboarding preferences. You can retry or skip.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="viewora-card-elevated rounded-3xl p-7 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
          <span className="inline-flex items-center gap-1.5 font-bold text-[#6941EF] dark:text-[#A99AFF]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Optional Workspace Setup · Step {step} of 3
          </span>
          <Link
            href={`/${locale}/dashboard`}
            className="font-semibold hover:text-[#6941EF] hover:underline dark:hover:text-[#A99AFF]"
          >
            Skip to Dashboard →
          </Link>
        </div>

        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-[#192337]"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={3}
          aria-label="Onboarding progress"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7957FF] to-[#22D3EE] transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {step === 1 ? (
          <div className="mt-6 space-y-5">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                Choose your primary workflow
              </h1>
              <p className="mt-1.5 text-sm text-[#64748B] dark:text-[#94A3B8]">
                This tailors your dashboard layout and workspace defaults. You can switch anytime
                from Personal Digital HQ.
              </p>
            </div>
            <div className="grid gap-3">
              {WORKFLOW_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = segment === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSegment(opt.id)}
                    className={`flex items-start gap-3.5 rounded-2xl border p-4 text-left transition ${
                      active
                        ? 'border-[#7957FF] bg-violet-50/70 ring-1 ring-[#7957FF] dark:border-[#A99AFF] dark:bg-[#192337]'
                        : 'border-slate-200 bg-white hover:border-[#7957FF]/40 dark:border-[#263047] dark:bg-[#0F172A]'
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {opt.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#64748B] dark:text-[#94A3B8]">
                        {opt.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold"
              >
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 space-y-5">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                Name your personal workspace
              </h1>
              <p className="mt-1.5 text-sm text-[#64748B] dark:text-[#94A3B8]">
                Your workspace name appears in your dashboard header, folders, and exported PDF
                reports.
              </p>
            </div>

            <label className="block">
              <span className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                Workspace Name
              </span>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                maxLength={80}
                placeholder="e.g. Growth Research HQ"
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
            </label>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-[#263047] dark:text-slate-200 dark:hover:bg-[#192337]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold"
              >
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 space-y-5">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                Pick your first useful action
              </h1>
              <p className="mt-1.5 text-sm text-[#64748B] dark:text-[#94A3B8]">
                Start with an empty real workspace, explore labeled demo analytics immediately, or
                jump into the 12 free calculators.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                {
                  id: 'demo_preview' as const,
                  icon: BarChart3,
                  title: 'Open Dashboard with Explicit Demo Preview Mode',
                  desc: 'Inspect labeled sample charts, competitor matrix, and AI reports before adding your own profiles.',
                },
                {
                  id: 'clean_dashboard' as const,
                  icon: CheckCircle2,
                  title: initialHandleParam
                    ? `Start Workspace & Queue @${initialHandleParam}`
                    : 'Start with a Clean Empty Workspace',
                  desc: 'Zero pre-loaded sample accounts — build your own folders and notes from scratch.',
                },
                {
                  id: 'tools' as const,
                  icon: Wrench,
                  title: 'Launch the 12 Free Instagram Tools',
                  desc: 'Run engagement, follower velocity, bio readiness, and hashtag formulas right away.',
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const active = firstAction === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFirstAction(opt.id)}
                    className={`flex items-start gap-3.5 rounded-2xl border p-4 text-left transition ${
                      active
                        ? 'border-[#7957FF] bg-violet-50/70 ring-1 ring-[#7957FF] dark:border-[#A99AFF] dark:bg-[#192337]'
                        : 'border-slate-200 bg-white hover:border-[#7957FF]/40 dark:border-[#263047] dark:bg-[#0F172A]'
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {opt.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#64748B] dark:text-[#94A3B8]">
                        {opt.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <button
                type="button"
                disabled={saving}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 dark:border-[#263047] dark:text-slate-200 dark:hover:bg-[#192337]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void finishOnboarding()}
                className="viewora-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving setup…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Save &amp; Continue
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
