'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  Compass,
  Loader2,
  Lock,
  Megaphone,
  Sparkles,
  Target,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CustomerSegment } from '@/lib/entitlements/types';
import type { CustomerGoal, OnboardingSegment, PersonalProfilePrefs } from '@/lib/auth/profile-prefs';
import { useTheme, type ThemePreference } from '@/components/theme/ThemeProvider';

const SEGMENT_OPTIONS: Array<{
  id: OnboardingSegment;
  coreSegment: CustomerSegment;
  title: string;
  desc: string;
  defaultWorkspace: string;
  icon: typeof User;
}> = [
  {
    id: 'individual_researcher',
    coreSegment: 'personal',
    title: 'Individual Researcher',
    desc: 'Inspect public profiles, organize personal research folders, and verify metrics transparently.',
    defaultWorkspace: 'Personal Research HQ',
    icon: Compass,
  },
  {
    id: 'content_creator',
    coreSegment: 'personal',
    title: 'Content Creator',
    desc: 'Benchmark engagement rates, publishing cadence, and format mix across Reels and Carousels.',
    defaultWorkspace: 'Creator Growth Studio',
    icon: Camera,
  },
  {
    id: 'influencer',
    coreSegment: 'personal',
    title: 'Influencer & Talent',
    desc: 'Track audience consistency, sponsor-ready metrics, and structured performance briefs.',
    defaultWorkspace: 'Creator Media Kit HQ',
    icon: Sparkles,
  },
  {
    id: 'social_media_manager',
    coreSegment: 'business',
    title: 'Social Media Manager',
    desc: 'Run competitor sets, weekly publishing calendars, and repeatable workflow reminders.',
    defaultWorkspace: 'Social Operations Desk',
    icon: Megaphone,
  },
  {
    id: 'marketing_professional',
    coreSegment: 'business',
    title: 'Marketing Professional',
    desc: 'Compare niche benchmarks, import CSV research datasets, and produce executive briefs.',
    defaultWorkspace: 'Marketing Intelligence Hub',
    icon: Briefcase,
  },
  {
    id: 'brand_business',
    coreSegment: 'business',
    title: 'Brand / Business Team',
    desc: 'Monitor brand positioning, creator shortlists, and structured campaign audits.',
    defaultWorkspace: 'Brand Intelligence Desk',
    icon: Building2,
  },
  {
    id: 'agency',
    coreSegment: 'agency',
    title: 'Agency & Multi-Client Team',
    desc: 'Manage isolated client workspaces, team roles, and white-label stakeholder reports.',
    defaultWorkspace: 'Agency Client Hub',
    icon: Users,
  },
];

const GOAL_OPTIONS: Array<{
  id: CustomerGoal;
  label: string;
  toolHint: string;
  toolHref: string;
}> = [
  {
    id: 'track_public_profiles',
    label: 'Track public profiles',
    toolHint: 'Public Profile Snapshot',
    toolHref: '/tools',
  },
  {
    id: 'analyze_engagement',
    label: 'Analyze engagement rates',
    toolHint: 'Engagement Rate Calculator',
    toolHref: '/instagram-engagement-calculator',
  },
  {
    id: 'compare_competitors',
    label: 'Compare competitors',
    toolHint: 'Competitor Comparison Studio',
    toolHref: '/dashboard/competitors',
  },
  {
    id: 'research_creators',
    label: 'Research creators & influencers',
    toolHint: 'Research Workspace Pro',
    toolHref: '/dashboard/projects',
  },
  {
    id: 'create_reports',
    label: 'Create stakeholder reports',
    toolHint: 'Professional Report Builder',
    toolHref: '/dashboard/report-builder',
  },
  {
    id: 'manage_client_accounts',
    label: 'Manage client accounts',
    toolHint: 'Agency Collaboration Center',
    toolHref: '/dashboard/agency',
  },
  {
    id: 'explore_free_tools',
    label: 'Explore 12 free tools',
    toolHint: '12 Free Instagram Calculators',
    toolHref: '/tools',
  },
];

function getSegmentConfig(id: OnboardingSegment) {
  return SEGMENT_OPTIONS.find((o) => o.id === id) ?? SEGMENT_OPTIONS[0]!;
}

export default function OnboardingPage() {
  const params = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const locale = params?.locale || 'en';
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const initialSegmentParam = searchParams.get('segment');
  const initialHandleParam = searchParams.get('handle') ?? '';
  const initialOnboardingSegment: OnboardingSegment =
    initialSegmentParam === 'agency'
      ? 'agency'
      : initialSegmentParam === 'business'
        ? 'brand_business'
        : 'individual_researcher';

  const [sessionState, setSessionState] = useState<'loading' | 'authenticated' | 'anonymous'>('loading');
  const [accountName, setAccountName] = useState<string>('');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [onboardingSegment, setOnboardingSegment] =
    useState<OnboardingSegment>(initialOnboardingSegment);
  const [selectedGoals, setSelectedGoals] = useState<CustomerGoal[]>([
    'track_public_profiles',
    'analyze_engagement',
  ]);
  const [workspaceName, setWorkspaceName] = useState<string>(
    getSegmentConfig(initialOnboardingSegment).defaultWorkspace
  );
  const [workspaceEdited, setWorkspaceEdited] = useState(false);
  const [firstAction, setFirstAction] = useState<'clean_dashboard' | 'demo_preview' | 'tools'>(
    'clean_dashboard'
  );
  const [saving, setSaving] = useState(false);
  const [resumedNotice, setResumedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/auth/session').then((r) => r.json()).catch(() => null),
      fetch('/api/auth/profile').then((r) => r.json()).catch(() => null),
    ]).then(
      ([sessJson, profJson]: [
        { authenticated?: boolean; user?: { fullName?: string } } | null,
        { ok?: boolean; profile?: PersonalProfilePrefs } | null,
      ]) => {
        if (!active) return;
        if (sessJson?.authenticated && sessJson.user) {
          setSessionState('authenticated');
          setAccountName(sessJson.user.fullName || '');
          const p = profJson?.profile;
          if (p) {
            if (!initialSegmentParam && p.onboardingSegment) {
              setOnboardingSegment(p.onboardingSegment);
            }
            if (p.customerGoals && p.customerGoals.length > 0) {
              setSelectedGoals(p.customerGoals);
            }
            if (p.workspaceName && p.workspaceName !== 'Primary Workspace') {
              setWorkspaceName(p.workspaceName);
              setWorkspaceEdited(true);
            }
            if (!p.onboardingCompleted && p.onboardingStep > 1 && p.onboardingStep <= 4) {
              setStep(p.onboardingStep as 1 | 2 | 3 | 4);
              setResumedNotice(true);
            }
          }
        } else {
          setSessionState('anonymous');
        }
      }
    );
    return () => {
      active = false;
    };
  }, [initialSegmentParam]);

  const handleSegmentSelect = (nextSeg: OnboardingSegment) => {
    setOnboardingSegment(nextSeg);
    if (!workspaceEdited) {
      setWorkspaceName(getSegmentConfig(nextSeg).defaultWorkspace);
    }
  };

  const toggleGoal = (goal: CustomerGoal) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const persistProgressAndMove = async (nextStep: 1 | 2 | 3 | 4) => {
    setStep(nextStep);
    setResumedNotice(false);
    // Fire-and-forget save-and-resume progress checkpoint
    void fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        onboardingSegment,
        customerGoals: selectedGoals,
        onboardingStep: nextStep,
        workspaceName: workspaceName.trim() || getSegmentConfig(onboardingSegment).defaultWorkspace,
      }),
    }).catch(() => undefined);
  };

  const finishOnboarding = async () => {
    setSaving(true);
    setError(null);
    try {
      const segCfg = getSegmentConfig(onboardingSegment);
      const trimmedWorkspace = workspaceName.trim() || segCfg.defaultWorkspace;
      const [prefRes, profRes] = await Promise.all([
        fetch('/api/auth/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segment: segCfg.coreSegment }),
        }),
        fetch('/api/auth/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            onboardingSegment,
            customerGoals: selectedGoals,
            onboardingStep: 4,
            onboardingCompleted: true,
            workspaceName: trimmedWorkspace,
            themePreference: theme,
          }),
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

  const recommendedTools = GOAL_OPTIONS.filter((g) => selectedGoals.includes(g.id)).slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="viewora-card-elevated rounded-3xl p-7 sm:p-8">
        {sessionState === 'loading' ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <Loader2 className="h-6 w-6 animate-spin text-[#7957FF]" aria-hidden="true" />
            <span>Loading your personalized workspace setup…</span>
          </div>
        ) : sessionState === 'anonymous' ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
              Sign in to personalize your workspace
            </h1>
            <p className="mx-auto max-w-md text-sm text-[#64748B] dark:text-[#94A3B8]">
              Workspace onboarding saves your customer segment, goals, appearance theme, and default
              workspace name directly to your Viewora account with save-and-resume support.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link
                href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/onboarding`)}`}
                className="viewora-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold"
              >
                Sign in
              </Link>
              <Link
                href={`/${locale}/register`}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
              >
                Create Free Account
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span className="inline-flex items-center gap-1.5 font-bold text-[#6941EF] dark:text-[#A99AFF]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {accountName ? `Welcome, ${accountName} · ` : ''}Optional Setup · Step {step} of 4
              </span>
              <Link
                href={`/${locale}/dashboard`}
                className="font-semibold hover:text-[#6941EF] hover:underline dark:hover:text-[#A99AFF]"
              >
                Skip &amp; return later →
              </Link>
            </div>

            {resumedNotice ? (
              <p className="mt-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                Resumed from your last saved onboarding step.
              </p>
            ) : null}

            <div
              className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-[#192337]"
              role="progressbar"
              aria-valuenow={step}
              aria-valuemin={1}
              aria-valuemax={4}
              aria-label="Onboarding progress"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7957FF] to-[#22D3EE] transition-all"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>

            {/* Step 1: 7 Customer Segments */}
            {step === 1 ? (
              <div className="mt-6 space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                    Which role best describes how you use Viewora?
                  </h1>
                  <p className="mt-1.5 text-sm text-[#64748B] dark:text-[#94A3B8]">
                    Select one of 7 tailored profiles to adapt your workspace checklist and shortcuts.
                    Switch anytime in Personal Digital HQ.
                  </p>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {SEGMENT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = onboardingSegment === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleSegmentSelect(opt.id)}
                        className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
                          active
                            ? 'border-[#7957FF] bg-violet-50/70 ring-1 ring-[#7957FF] dark:border-[#A99AFF] dark:bg-[#192337]'
                            : 'border-slate-200 bg-white hover:border-[#7957FF]/40 dark:border-[#263047] dark:bg-[#0F172A]'
                        }`}
                      >
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {opt.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
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
                    onClick={() => void persistProgressAndMove(2)}
                    className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold"
                  >
                    Save &amp; Continue
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}

            {/* Step 2: 7 Selectable Goals */}
            {step === 2 ? (
              <div className="mt-6 space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                    What are your primary goals?
                  </h1>
                  <p className="mt-1.5 text-sm text-[#64748B] dark:text-[#94A3B8]">
                    Select all that apply. Viewora uses your goals to surface contextual tools and
                    your Getting-Started Checklist without clutter.
                  </p>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  {GOAL_OPTIONS.map((goal) => {
                    const checked = selectedGoals.includes(goal.id);
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        aria-pressed={checked}
                        onClick={() => toggleGoal(goal.id)}
                        className={`flex items-center justify-between gap-2 rounded-2xl border p-3.5 text-left text-xs font-semibold transition ${
                          checked
                            ? 'border-[#7957FF] bg-violet-50/70 text-[#0F172A] ring-1 ring-[#7957FF] dark:border-[#A99AFF] dark:bg-[#192337] dark:text-white'
                            : 'border-slate-200 bg-white text-[#64748B] hover:border-[#7957FF]/40 dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Target className="h-4 w-4 text-[#7957FF]" aria-hidden="true" />
                          <span>{goal.label}</span>
                        </span>
                        {checked ? (
                          <CheckCircle2 className="h-4 w-4 text-[#7957FF]" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => void persistProgressAndMove(1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#0F172A] dark:border-[#263047] dark:text-slate-200"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void persistProgressAndMove(3)}
                    className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}

            {/* Step 3: Workspace Personalization & Appearance */}
            {step === 3 ? (
              <div className="mt-6 space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                    Personalize your workspace
                  </h1>
                  <p className="mt-1.5 text-sm text-[#64748B] dark:text-[#94A3B8]">
                    Name your workspace and pick your default light, dark, or system theme.
                  </p>
                </div>

                <label className="block">
                  <span className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                    Workspace Name
                  </span>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => {
                      setWorkspaceName(e.target.value);
                      setWorkspaceEdited(true);
                    }}
                    maxLength={80}
                    placeholder="e.g. Growth Research HQ"
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
                  />
                </label>

                <div>
                  <p className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                    Appearance Mode
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(['light', 'dark', 'system'] as ThemePreference[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={theme === mode}
                        onClick={() => setTheme(mode)}
                        className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold capitalize transition ${
                          theme === mode
                            ? 'border-[#7957FF] bg-[#7957FF] text-white'
                            : 'border-slate-200 bg-white text-[#64748B] hover:border-[#7957FF]/40 dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => void persistProgressAndMove(2)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#0F172A] dark:border-[#263047] dark:text-slate-200"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void persistProgressAndMove(4)}
                    className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}

            {/* Step 4: Contextual First Action & Launch */}
            {step === 4 ? (
              <div className="mt-6 space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                    Choose how you want to start
                  </h1>
                  <p className="mt-1.5 text-sm text-[#64748B] dark:text-[#94A3B8]">
                    Real accounts start completely clean with zero fabricated activity. You can
                    opt into clearly labeled Demo Preview Mode anytime.
                  </p>
                </div>

                {recommendedTools.length > 0 ? (
                  <div className="rounded-2xl border border-violet-200/70 bg-violet-50/50 p-4 text-xs dark:border-violet-900/50 dark:bg-violet-950/20">
                    <p className="font-bold text-[#0F172A] dark:text-white">
                      Recommended Modules Based on Your Goals:
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {recommendedTools.map((g) => (
                        <Link
                          key={g.id}
                          href={`/${locale}${g.toolHref}`}
                          className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 font-semibold text-[#6941EF] hover:border-[#7957FF] dark:border-violet-800 dark:bg-[#131C2E] dark:text-[#A99AFF]"
                        >
                          {g.toolHint} →
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3">
                  {[
                    {
                      id: 'clean_dashboard' as const,
                      icon: CheckCircle2,
                      title: initialHandleParam
                        ? `Start Clean Workspace & Queue @${initialHandleParam}`
                        : 'Start with a Clean Empty Workspace (Recommended)',
                      desc: 'Zero pre-loaded sample accounts — build your own research projects, CSV imports, and private notes.',
                    },
                    {
                      id: 'demo_preview' as const,
                      icon: BarChart3,
                      title: 'Explore Explicit Demo Preview Mode',
                      desc: 'Inspect clearly labeled sample charts, deterministic analytics, and report templates first.',
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
                    onClick={() => void persistProgressAndMove(3)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#0F172A] dark:border-[#263047] dark:text-slate-200"
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
                        Finish &amp; Launch Workspace
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
