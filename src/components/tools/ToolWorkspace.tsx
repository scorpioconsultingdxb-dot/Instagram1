'use client';

import {
  AlertCircle,
  Calculator,
  Check,
  Copy,
  Loader2,
  Lock,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { ToolSlug } from '@/lib/tools/catalog';
import {
  analyzeBio,
  analyzePostPerformance,
  calculateEngagement,
  calculateFollowerGrowth,
  evaluateInfluencer,
  generateCaptions,
  generateContentIdeas,
  generateHashtags,
  type CaptionTone,
} from '@/lib/tools/engines';
import type { ProviderResponse, StoryAvailabilityData } from '@/lib/providers/types';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/Primitives';
import { ProfileSearchExperience } from '@/components/search/ProfileSearchExperience';

async function safeCopy(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function ToolWorkspace({
  slug,
  locale,
  dict,
  sampleHandles,
}: {
  slug: ToolSlug;
  locale: Locale;
  dict: Dictionary;
  sampleHandles: string[];
}) {
  switch (slug) {
    case 'instagram-viewer':
      return (
        <ProfileSearchExperience
          locale={locale}
          dict={dict}
          sampleHandles={sampleHandles}
          toolMode="anonymous-viewer"
        />
      );
    case 'instagram-profile-analyzer':
      return (
        <ProfileSearchExperience
          locale={locale}
          dict={dict}
          sampleHandles={sampleHandles}
          toolMode="profile-analyzer"
        />
      );
    case 'instagram-story-viewer':
      return <StoryViewerWorkspace dict={dict} sampleHandles={sampleHandles} />;
    case 'instagram-engagement-calculator':
      return <EngagementCalculatorWorkspace dict={dict} />;
    case 'instagram-follower-growth':
      return <FollowerGrowthWorkspace dict={dict} />;
    case 'instagram-bio-analyzer':
      return <BioAnalyzerWorkspace dict={dict} />;
    case 'instagram-hashtag-generator':
      return <HashtagGeneratorWorkspace dict={dict} />;
    case 'instagram-competitor-analysis':
      return <CompetitorComparisonWorkspace dict={dict} />;
    case 'instagram-influencer-analyzer':
      return <InfluencerAnalyzerWorkspace dict={dict} />;
    case 'instagram-post-analyzer':
      return <PostPerformanceWorkspace dict={dict} />;
    case 'instagram-caption-generator':
      return <CaptionGeneratorWorkspace dict={dict} />;
    case 'instagram-content-ideas':
      return <ContentIdeasWorkspace dict={dict} />;
  }
}

function PresetBar({
  presets,
  onClear,
}: {
  presets: Array<{ label: string; apply: () => void }>;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 font-semibold text-[#64748B] dark:text-[#94A3B8]">
          <Sparkles className="h-3.5 w-3.5 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
          Examples:
        </span>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={p.apply}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0F172A] transition hover:border-[#7957FF] hover:text-[#6941EF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200 dark:hover:border-[#A99AFF]"
          >
            {p.label}
          </button>
        ))}
      </div>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#64748B] hover:bg-slate-200/70 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-white"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Clear
        </button>
      ) : null}
    </div>
  );
}

function ValidationAlert({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <ul className="space-y-0.5">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FormulaBox({ title, lines }: { title: string; lines: string[] }) {
  return (
    <details className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-xs dark:border-[#263047] dark:bg-[#131C2E]">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
        <Calculator className="h-3.5 w-3.5 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
        {title}
      </summary>
      <ul className="mt-2.5 space-y-1 font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

function StoryViewerWorkspace({
  dict,
  sampleHandles,
}: {
  dict: Dictionary;
  sampleHandles: string[];
}) {
  const [handle, setHandle] = useState('viewora.studio');
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [response, setResponse] = useState<{
    ok: boolean;
    error?: { message: string };
    result?: ProviderResponse<StoryAvailabilityData>;
  } | null>(null);

  const checkAvailability = async (target: string) => {
    const trimmed = target.trim();
    setHandle(target);
    setNetworkError(null);
    if (!trimmed) {
      setResponse({ ok: false, error: { message: 'Enter an Instagram username to check authorized Story availability.' } });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/stories?q=${encodeURIComponent(trimmed)}`);
      const json = (await res.json()) as {
        ok: boolean;
        error?: { message: string };
        result?: ProviderResponse<StoryAvailabilityData>;
      };
      setResponse(json);
    } catch {
      setNetworkError('Unable to reach the Story availability endpoint right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">Availability &amp; Anonymity Disclosure</p>
            <p className="mt-1 text-xs leading-relaxed">
              Instagram Stories are restricted by Meta&apos;s official APIs strictly to authorized
              account owners. Viewora never scrapes third-party Stories and never simulates
              unauthorized anonymous playback.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void checkAvailability(handle);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          aria-label="Instagram username to check Story availability"
          placeholder="Enter @username"
          className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
        />
        <button
          type="submit"
          disabled={loading}
          className="viewora-btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {loading ? 'Checking scope…' : 'Check Authorized Availability'}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
        <span>Sample handles:</span>
        {sampleHandles.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void checkAvailability(s)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A] dark:text-slate-200"
          >
            @{s}
          </button>
        ))}
      </div>

      {loading ? <SkeletonCard lines={2} /> : null}

      {!loading && networkError ? (
        <ErrorState
          title="Availability check failed"
          description={networkError}
          onRetry={() => void checkAvailability(handle)}
        />
      ) : null}

      {!loading && response?.error ? (
        <ValidationAlert messages={[response.error.message]} />
      ) : null}

      {!loading && !response && !networkError ? (
        <EmptyState
          title="Ready to verify Story API eligibility"
          description="Submit any handle above to inspect whether an authorized Meta OAuth Story connection is active. Unauthorized third-party Stories will always report UNAVAILABLE."
        />
      ) : null}

      {!loading && response?.ok && response.result?.data ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-[#263047] dark:bg-[#0F172A]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-white">
              Story Source Status for @{response.result.data.username}
            </h3>
            <ProvenanceBadge dataClass="unavailable" labels={dict.provenance} />
          </div>
          <p className="mt-2 text-sm text-[#0F172A]/85 dark:text-slate-300">
            {response.result.data.reason}
          </p>
          <p className="mt-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
            {response.result.data.anonymityDisclosure}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function EngagementCalculatorWorkspace({ dict }: { dict: Dictionary }) {
  const [followers, setFollowers] = useState(48200);
  const [avgLikes, setAvgLikes] = useState(1840);
  const [avgComments, setAvgComments] = useState(142);
  const [avgSaves, setAvgSaves] = useState(210);
  const [avgShares, setAvgShares] = useState(85);
  const [avgReach, setAvgReach] = useState(29400);
  const [copied, setCopied] = useState(false);

  const errors: string[] = [];
  if (followers <= 0) errors.push('Enter a follower count greater than 0 to compute engagement rate.');
  if (avgLikes < 0 || avgComments < 0 || avgSaves < 0 || avgShares < 0 || avgReach < 0) {
    errors.push('Metrics cannot be negative.');
  }

  const isEmpty = followers === 0 && avgLikes === 0 && avgComments === 0;
  const result = !isEmpty && errors.length === 0
    ? calculateEngagement({ followers, avgLikes, avgComments, avgSaves, avgShares, avgReach })
    : null;

  return (
    <div className="space-y-5">
      <PresetBar
        presets={[
          {
            label: 'Micro Brand (19.5K)',
            apply: () => {
              setFollowers(19450);
              setAvgLikes(820);
              setAvgComments(64);
              setAvgSaves(95);
              setAvgShares(42);
              setAvgReach(14200);
            },
          },
          {
            label: 'Mid-Tier Studio (48.2K)',
            apply: () => {
              setFollowers(48200);
              setAvgLikes(1840);
              setAvgComments(142);
              setAvgSaves(210);
              setAvgShares(85);
              setAvgReach(29400);
            },
          },
          {
            label: 'Macro Creator (320K)',
            apply: () => {
              setFollowers(320000);
              setAvgLikes(7400);
              setAvgComments(390);
              setAvgSaves(810);
              setAvgShares(310);
              setAvgReach(185000);
            },
          },
        ]}
        onClear={() => {
          setFollowers(0);
          setAvgLikes(0);
          setAvgComments(0);
          setAvgSaves(0);
          setAvgShares(0);
          setAvgReach(0);
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField label="Followers *" value={followers} onChange={setFollowers} />
        <NumberField label="Avg. Likes / Post" value={avgLikes} onChange={setAvgLikes} />
        <NumberField label="Avg. Comments / Post" value={avgComments} onChange={setAvgComments} />
        <NumberField label="Avg. Saves (Optional)" value={avgSaves} onChange={setAvgSaves} />
        <NumberField label="Avg. Shares (Optional)" value={avgShares} onChange={setAvgShares} />
        <NumberField label="Avg. Reach (Optional)" value={avgReach} onChange={setAvgReach} />
      </div>

      {isEmpty ? (
        <EmptyState
          title="Enter your account metrics above"
          description="Provide followers and average post interactions—or choose one of the example scenarios above—to compute deterministic engagement rates."
        />
      ) : errors.length > 0 ? (
        <ValidationAlert messages={errors} />
      ) : result ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-[#263047] dark:bg-[#0F172A]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-white">
                Engagement Breakdown · {result.rating}
              </h3>
              <div className="flex items-center gap-2">
                <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
                <button
                  type="button"
                  onClick={async () => {
                    const summary = `ER by Followers: ${result.erByFollowers}% | ER by Reach: ${result.erByReach ?? 'N/A'}% | Tier: ${result.tier} (${result.benchmarkRange}) | Status: ${result.rating}`;
                    if (await safeCopy(summary)) {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy Summary'}
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricBox label="ER by Followers" value={`${result.erByFollowers}%`} accent />
              <MetricBox
                label="ER by Reach"
                value={result.erByReach !== null ? `${result.erByReach}%` : '—'}
              />
              <MetricBox label="Account Tier" value={result.tier} />
              <MetricBox label="Benchmark Band" value={result.benchmarkRange} />
            </div>
            <p className="mt-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Total average interactions per post:{' '}
              <strong className="tabular-nums text-[#0F172A] dark:text-white">
                {result.totalAvgInteractions.toLocaleString()}
              </strong>
              .
            </p>
          </div>
          <FormulaBox
            title="Calculation formula & inputs used"
            lines={[
              `Total Interactions = ${avgLikes} + ${avgComments} + ${avgSaves} + ${avgShares} = ${result.totalAvgInteractions}`,
              `ER by Followers = (${result.totalAvgInteractions} / ${followers}) × 100 = ${result.erByFollowers}%`,
              avgReach > 0
                ? `ER by Reach = (${result.totalAvgInteractions} / ${avgReach}) × 100 = ${result.erByReach}%`
                : 'ER by Reach = not computed (enter Avg. Reach > 0)',
            ]}
          />
        </>
      ) : null}
    </div>
  );
}

function FollowerGrowthWorkspace({ dict }: { dict: Dictionary }) {
  const [startFollowers, setStartFollowers] = useState(41200);
  const [endFollowers, setEndFollowers] = useState(48200);
  const [days, setDays] = useState(150);
  const [targetMilestone, setTargetMilestone] = useState(60000);

  const errors: string[] = [];
  if (days <= 0) errors.push('Days elapsed must be at least 1.');
  if (startFollowers < 0 || endFollowers < 0 || targetMilestone < 0) {
    errors.push('Follower values cannot be negative.');
  }
  const isEmpty = startFollowers === 0 && endFollowers === 0;
  const result =
    !isEmpty && errors.length === 0
      ? calculateFollowerGrowth({ startFollowers, endFollowers, days, targetMilestone })
      : null;

  return (
    <div className="space-y-5">
      <PresetBar
        presets={[
          {
            label: 'Steady 90-Day Climb',
            apply: () => {
              setStartFollowers(12400);
              setEndFollowers(16900);
              setDays(90);
              setTargetMilestone(25000);
            },
          },
          {
            label: '6-Month Studio Growth',
            apply: () => {
              setStartFollowers(41200);
              setEndFollowers(48200);
              setDays(150);
              setTargetMilestone(60000);
            },
          },
        ]}
        onClear={() => {
          setStartFollowers(0);
          setEndFollowers(0);
          setDays(30);
          setTargetMilestone(0);
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="Start Followers" value={startFollowers} onChange={setStartFollowers} />
        <NumberField label="Current Followers" value={endFollowers} onChange={setEndFollowers} />
        <NumberField label="Days Elapsed *" value={days} onChange={setDays} />
        <NumberField
          label="Target Milestone"
          value={targetMilestone}
          onChange={setTargetMilestone}
        />
      </div>

      {isEmpty ? (
        <EmptyState
          title="Enter starting and current follower counts"
          description="Supply two follower counts and the number of days between them to calculate velocity, 30-day projection, and milestone timelines."
        />
      ) : errors.length > 0 ? (
        <ValidationAlert messages={errors} />
      ) : result ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-[#263047] dark:bg-[#0F172A]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-white">
                Growth Velocity &amp; Milestone Estimate
              </h3>
              <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricBox
                label="Net Change"
                value={`${result.netChange >= 0 ? '+' : ''}${result.netChange.toLocaleString()}`}
                accent
              />
              <MetricBox label="Growth Rate" value={`${result.percentChange}%`} />
              <MetricBox label="Avg. Daily Gain" value={`${result.dailyAverage} / day`} />
              <MetricBox
                label="Est. Days to Milestone"
                value={
                  result.estimatedDaysToTarget !== null
                    ? `${result.estimatedDaysToTarget} days`
                    : 'Not reachable at current rate'
                }
              />
            </div>
            <p className="mt-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Projected 30-day net gain at current pace:{' '}
              <strong className="tabular-nums text-[#0F172A] dark:text-white">
                {result.projected30DayGain >= 0 ? '+' : ''}
                {result.projected30DayGain.toLocaleString()}
              </strong>{' '}
              followers (projected total:{' '}
              <strong className="tabular-nums text-[#0F172A] dark:text-white">
                {(endFollowers + result.projected30DayGain).toLocaleString()}
              </strong>
              ).
            </p>
          </div>
          <FormulaBox
            title="Calculation formula & inputs used"
            lines={[
              `Net Change = ${endFollowers} − ${startFollowers} = ${result.netChange}`,
              `Daily Average = ${result.netChange} / ${days} days = ${result.dailyAverage} followers/day`,
              `30-Day Gain = ${result.dailyAverage} × 30 = ${result.projected30DayGain} (Total: ${endFollowers + result.projected30DayGain})`,
            ]}
          />
        </>
      ) : null}
    </div>
  );
}

function BioAnalyzerWorkspace({ dict }: { dict: Dictionary }) {
  const [bio, setBio] = useState(
    'Small-batch Nordic coffee roastery ☕\nWeekly brew guides & origin notes\nShop fresh beans via our link below 👇'
  );
  const trimmed = bio.trim();
  const result = trimmed ? analyzeBio(bio) : null;

  return (
    <div className="space-y-5">
      <PresetBar
        presets={[
          {
            label: 'Specialty Brand',
            apply: () =>
              setBio(
                'Small-batch Nordic coffee roastery ☕\nWeekly brew guides & origin notes\nShop fresh beans via our link below 👇'
              ),
          },
          {
            label: 'B2B SaaS / Agency',
            apply: () =>
              setBio(
                'Privacy-first Instagram analytics for teams\n12 free tools · Weekly benchmarks\nTry free at viewora.app ↓'
              ),
          },
          {
            label: 'Over-limit Draft',
            apply: () =>
              setBio(
                'We help creators and businesses grow faster on social media with consulting, workshops, templates, coaching, photography, video editing, brand strategy, and daily tips for everyone around the world.'
              ),
          },
        ]}
        onClear={() => setBio('')}
      />

      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="bio-textarea"
            className="text-xs font-semibold text-[#0F172A] dark:text-slate-200"
          >
            Paste or draft your Instagram bio
          </label>
          <span
            className={`font-mono text-xs tabular-nums ${
              bio.trim().length > 150
                ? 'font-bold text-rose-600 dark:text-[#F87171]'
                : 'text-[#64748B] dark:text-[#94A3B8]'
            }`}
          >
            {bio.trim().length} / 150 chars
          </span>
        </div>
        <textarea
          id="bio-textarea"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Write or paste your bio here (up to 150 characters)…"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
        />
      </div>

      {!result ? (
        <EmptyState
          title="Draft or paste an Instagram bio"
          description="Viewora scores character efficiency (150-char limit), scannable formatting, call-to-action clarity, and emoji balance deterministically."
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-[#263047] dark:bg-[#0F172A]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-white">
              Bio Readiness Score: {result.score} / 100
            </h3>
            <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
          </div>
          <div
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-[#192337]"
            role="progressbar"
            aria-valuenow={result.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Bio readiness score"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7957FF] to-[#22D3EE] transition-all"
              style={{ width: `${result.score}%` }}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-[#34D399]">Strengths</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-[#64748B] dark:text-slate-300">
                {result.strengths.length > 0 ? (
                  result.strengths.map((s) => <li key={s}>{s}</li>)
                ) : (
                  <li>Add clearer positioning or a call to action to build bio strengths.</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-amber-700 dark:text-[#FBBF24]">Suggestions</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-[#64748B] dark:text-slate-300">
                {result.suggestions.length > 0 ? (
                  result.suggestions.map((s) => <li key={s}>{s}</li>)
                ) : (
                  <li>All core bio clarity and formatting checks passed.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HashtagGeneratorWorkspace({ dict }: { dict: Dictionary }) {
  const [topic, setTopic] = useState('specialty coffee pour over');
  const [niche, setNiche] = useState('food');
  const [copied, setCopied] = useState(false);

  const hasTopic = topic.trim().length >= 2;
  const tags = hasTopic ? generateHashtags(topic, niche) : null;

  return (
    <div className="space-y-5">
      <PresetBar
        presets={[
          {
            label: 'Specialty Coffee',
            apply: () => {
              setTopic('specialty coffee pour over');
              setNiche('food');
            },
          },
          {
            label: 'SaaS Marketing',
            apply: () => {
              setTopic('instagram analytics dashboard benchmarks');
              setNiche('marketing');
            },
          },
          {
            label: 'Minimalist Interiors',
            apply: () => {
              setTopic('scandinavian living room lighting');
              setNiche('design');
            },
          },
        ]}
        onClear={() => setTopic('')}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label
            htmlFor="hashtag-topic"
            className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200"
          >
            Post Topic / Keywords *
          </label>
          <input
            id="hashtag-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. specialty coffee pour over"
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          />
        </div>
        <div>
          <label
            htmlFor="hashtag-niche"
            className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200"
          >
            Niche Category
          </label>
          <select
            id="hashtag-niche"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          >
            <option value="marketing">Marketing &amp; SaaS</option>
            <option value="food">Food &amp; Coffee</option>
            <option value="fitness">Health &amp; Fitness</option>
            <option value="design">Design &amp; Interiors</option>
            <option value="ecommerce">E-commerce &amp; DTC</option>
          </select>
        </div>
      </div>

      {!tags ? (
        <EmptyState
          title="Enter at least 2 characters for your post topic"
          description="Viewora generates balanced Broad, Niche, and Community hashtag clusters without spammy repetition."
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-[#263047] dark:bg-[#0F172A]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-white">
                Balanced Hashtag Set ({tags.all.length} tags)
              </h3>
              <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
            </div>
            <button
              type="button"
              onClick={async () => {
                if (await safeCopy(tags.all.join(' '))) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy All'}
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <TagGroup title="Broad Reach" tags={tags.broad} />
            <TagGroup title="Niche Specific" tags={tags.niche} />
            <TagGroup title="Community" tags={tags.community} />
          </div>
        </div>
      )}
    </div>
  );
}

function CompetitorComparisonWorkspace({ dict }: { dict: Dictionary }) {
  const [isDemoPreset, setIsDemoPreset] = useState(true);
  const [accountA, setAccountA] = useState({
    name: '@viewora.studio (Demo)',
    followers: 48200,
    er: 4.18,
    postsPerWeek: 4.2,
  });
  const [accountB, setAccountB] = useState({
    name: '@aurora.coffee (Demo)',
    followers: 19450,
    er: 5.12,
    postsPerWeek: 5.0,
  });

  const updateA = (patch: Partial<typeof accountA>) => {
    setIsDemoPreset(false);
    setAccountA((prev) => ({ ...prev, ...patch }));
  };
  const updateB = (patch: Partial<typeof accountB>) => {
    setIsDemoPreset(false);
    setAccountB((prev) => ({ ...prev, ...patch }));
  };

  const errors: string[] = [];
  if (accountA.followers <= 0 || accountB.followers <= 0) {
    errors.push('Both accounts must have follower counts greater than 0 for an accurate audience ratio.');
  }

  const followerRatio = (accountA.followers / Math.max(1, accountB.followers)).toFixed(2);
  const erDelta = Number((accountA.er - accountB.er).toFixed(2));
  const cadenceDelta = Number((accountA.postsPerWeek - accountB.postsPerWeek).toFixed(1));

  return (
    <div className="space-y-5">
      <PresetBar
        presets={[
          {
            label: 'Demo Fixtures (@viewora vs @aurora)',
            apply: () => {
              setIsDemoPreset(true);
              setAccountA({ name: '@viewora.studio (Demo)', followers: 48200, er: 4.18, postsPerWeek: 4.2 });
              setAccountB({ name: '@aurora.coffee (Demo)', followers: 19450, er: 5.12, postsPerWeek: 5.0 });
            },
          },
          {
            label: 'Custom Challenger Benchmark',
            apply: () => {
              setIsDemoPreset(false);
              setAccountA({ name: 'My Brand', followers: 28000, er: 4.6, postsPerWeek: 4.0 });
              setAccountB({ name: 'Category Leader', followers: 95000, er: 2.9, postsPerWeek: 5.5 });
            },
          },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          {isDemoPreset
            ? 'Showing labeled demo fixture comparison. Edit any field to calculate your own custom benchmark.'
            : 'Computing deterministic deltas from your entered benchmark metrics.'}
        </p>
        <ProvenanceBadge dataClass={isDemoPreset ? 'demo' : 'estimate'} labels={dict.provenance} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
          <input
            type="text"
            aria-label="Account A label"
            value={accountA.name}
            onChange={(e) => updateA({ name: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
          />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <NumberField
              label="Followers"
              value={accountA.followers}
              onChange={(v) => updateA({ followers: v })}
            />
            <NumberField
              label="ER (%)"
              step={0.1}
              value={accountA.er}
              onChange={(v) => updateA({ er: v })}
            />
            <NumberField
              label="Posts / wk"
              step={0.1}
              value={accountA.postsPerWeek}
              onChange={(v) => updateA({ postsPerWeek: v })}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
          <input
            type="text"
            aria-label="Account B label"
            value={accountB.name}
            onChange={(e) => updateB({ name: e.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
          />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <NumberField
              label="Followers"
              value={accountB.followers}
              onChange={(v) => updateB({ followers: v })}
            />
            <NumberField
              label="ER (%)"
              step={0.1}
              value={accountB.er}
              onChange={(v) => updateB({ er: v })}
            />
            <NumberField
              label="Posts / wk"
              step={0.1}
              value={accountB.postsPerWeek}
              onChange={(v) => updateB({ postsPerWeek: v })}
            />
          </div>
        </div>
      </div>

      {errors.length > 0 ? (
        <ValidationAlert messages={errors} />
      ) : (
        <>
          <div className="grid gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:grid-cols-3 dark:border-[#263047] dark:bg-[#192337]/60">
            <MetricBox label="Audience Ratio (A / B)" value={`${followerRatio}×`} accent />
            <MetricBox label="Engagement Delta (A − B)" value={`${erDelta >= 0 ? '+' : ''}${erDelta} pts`} />
            <MetricBox
              label="Cadence Delta (A − B)"
              value={`${cadenceDelta >= 0 ? '+' : ''}${cadenceDelta} posts/wk`}
            />
          </div>
          <FormulaBox
            title="Comparison formulas"
            lines={[
              `Audience Ratio = ${accountA.followers} / ${accountB.followers} = ${followerRatio}×`,
              `Engagement Delta = ${accountA.er}% − ${accountB.er}% = ${erDelta >= 0 ? '+' : ''}${erDelta} percentage points`,
              `Cadence Delta = ${accountA.postsPerWeek} − ${accountB.postsPerWeek} = ${cadenceDelta >= 0 ? '+' : ''}${cadenceDelta} posts/wk`,
            ]}
          />
        </>
      )}
    </div>
  );
}

function InfluencerAnalyzerWorkspace({ dict }: { dict: Dictionary }) {
  const [followers, setFollowers] = useState(74900);
  const [avgLikes, setAvgLikes] = useState(3180);
  const [avgComments, setAvgComments] = useState(214);
  const [postsPerWeek, setPostsPerWeek] = useState(4.5);

  const isEmpty = followers === 0 && avgLikes === 0 && avgComments === 0;
  const errors = followers <= 0 && !isEmpty ? ['Enter followers > 0 to classify the creator tier.'] : [];
  const result =
    !isEmpty && errors.length === 0
      ? evaluateInfluencer({ followers, avgLikes, avgComments, postsPerWeek })
      : null;

  return (
    <div className="space-y-5">
      <PresetBar
        presets={[
          {
            label: 'Nano Creator (8.5K)',
            apply: () => {
              setFollowers(8500);
              setAvgLikes(510);
              setAvgComments(48);
              setPostsPerWeek(3.5);
            },
          },
          {
            label: 'Mid-Tier Creator (74.9K)',
            apply: () => {
              setFollowers(74900);
              setAvgLikes(3180);
              setAvgComments(214);
              setPostsPerWeek(4.5);
            },
          },
        ]}
        onClear={() => {
          setFollowers(0);
          setAvgLikes(0);
          setAvgComments(0);
          setPostsPerWeek(0);
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="Followers *" value={followers} onChange={setFollowers} />
        <NumberField label="Avg. Likes" value={avgLikes} onChange={setAvgLikes} />
        <NumberField label="Avg. Comments" value={avgComments} onChange={setAvgComments} />
        <NumberField
          label="Posts / Week"
          step={0.5}
          value={postsPerWeek}
          onChange={setPostsPerWeek}
        />
      </div>

      {isEmpty ? (
        <EmptyState
          title="Enter creator metrics to evaluate partnership readiness"
          description="Provide follower count, average likes, average comments, and posting cadence to calculate tier classification and reach bands."
        />
      ) : errors.length > 0 ? (
        <ValidationAlert messages={errors} />
      ) : result ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-[#263047] dark:bg-[#0F172A]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-white">
                Creator Evaluation Summary
              </h3>
              <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricBox label="Influencer Tier" value={result.tier} accent />
              <MetricBox label="Engagement Rate" value={`${result.engagementRate}%`} />
              <MetricBox
                label="Est. Reach Band"
                value={`${result.estimatedReachLow.toLocaleString()} – ${result.estimatedReachHigh.toLocaleString()}`}
              />
              <MetricBox label="Readiness Score" value={`${result.readinessScore} / 100`} />
            </div>
          </div>
          <FormulaBox
            title="Evaluation methodology"
            lines={[
              `Engagement Rate = ((${avgLikes} + ${avgComments}) / ${followers}) × 100 = ${result.engagementRate}%`,
              `Estimated Reach Band = conservative 18%–36% follower delivery range adjusted for engagement health`,
            ]}
          />
        </>
      ) : null}
    </div>
  );
}

function PostPerformanceWorkspace({ dict }: { dict: Dictionary }) {
  const [likes, setLikes] = useState(1840);
  const [comments, setComments] = useState(142);
  const [saves, setSaves] = useState(690);
  const [shares, setShares] = useState(340);
  const [reach, setReach] = useState(29400);
  const [followers, setFollowers] = useState(48200);

  const isEmpty = likes === 0 && comments === 0 && saves === 0 && shares === 0 && reach === 0;
  const errors =
    !isEmpty && reach <= 0
      ? ['Post Reach must be greater than 0 to compute Save Rate, Share Rate, and ER by Reach.']
      : [];

  const result =
    !isEmpty && errors.length === 0
      ? analyzePostPerformance({ likes, comments, saves, shares, reach, followers })
      : null;

  return (
    <div className="space-y-5">
      <PresetBar
        presets={[
          {
            label: 'High-Save Carousel',
            apply: () => {
              setLikes(1840);
              setComments(142);
              setSaves(690);
              setShares(340);
              setReach(29400);
              setFollowers(48200);
            },
          },
          {
            label: 'Viral Discovery Reel',
            apply: () => {
              setLikes(6200);
              setComments(245);
              setSaves(1120);
              setShares(1950);
              setReach(142000);
              setFollowers(48200);
            },
          },
        ]}
        onClear={() => {
          setLikes(0);
          setComments(0);
          setSaves(0);
          setShares(0);
          setReach(0);
          setFollowers(0);
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField label="Likes" value={likes} onChange={setLikes} />
        <NumberField label="Comments" value={comments} onChange={setComments} />
        <NumberField label="Saves" value={saves} onChange={setSaves} />
        <NumberField label="Shares" value={shares} onChange={setShares} />
        <NumberField label="Post Reach *" value={reach} onChange={setReach} />
        <NumberField label="Followers" value={followers} onChange={setFollowers} />
      </div>

      {isEmpty ? (
        <EmptyState
          title="Enter post insights to diagnose performance"
          description="Add likes, comments, saves, shares, and post reach from your Instagram Insights screen to compute exact resonance ratios."
        />
      ) : errors.length > 0 ? (
        <ValidationAlert messages={errors} />
      ) : result ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-[#263047] dark:bg-[#0F172A]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-white">
                Post Diagnostics: {result.verdict}
              </h3>
              <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricBox label="ER by Reach" value={`${result.engagementRateByReach}%`} accent />
              <MetricBox label="Save Rate" value={`${result.saveRate}%`} />
              <MetricBox label="Share Rate" value={`${result.shareRate}%`} />
              <MetricBox label="Comment / Like" value={`${result.commentToLikeRatio}%`} />
            </div>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-[#64748B] dark:text-slate-300">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
          <FormulaBox
            title="Diagnostic formulas"
            lines={[
              `ER by Reach = ((${likes} + ${comments} + ${saves} + ${shares}) / ${reach}) × 100 = ${result.engagementRateByReach}%`,
              `Save Rate = (${saves} / ${reach}) × 100 = ${result.saveRate}%`,
              `Share Rate = (${shares} / ${reach}) × 100 = ${result.shareRate}%`,
            ]}
          />
        </>
      ) : null}
    </div>
  );
}

function CaptionGeneratorWorkspace({ dict }: { dict: Dictionary }) {
  const [topic, setTopic] = useState('Q4 Instagram carousel benchmark insights');
  const [tone, setTone] = useState<CaptionTone>('professional');
  const [cta, setCta] = useState('Save this breakdown for your next weekly planning session.');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const hasTopic = topic.trim().length >= 3;
  const drafts = hasTopic ? generateCaptions({ topic, tone, cta }) : [];

  return (
    <div className="space-y-5">
      <PresetBar
        presets={[
          {
            label: 'Carousel Benchmark',
            apply: () => {
              setTopic('Q4 Instagram carousel benchmark insights');
              setTone('professional');
              setCta('Save this breakdown for your next weekly planning session.');
            },
          },
          {
            label: 'Product Launch Story',
            apply: () => {
              setTopic('Behind the scenes of our winter roast launch');
              setTone('conversational');
              setCta('Tell us which tasting note you want to try first.');
            },
          },
        ]}
        onClear={() => {
          setTopic('');
          setCta('');
        }}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
            Post Topic *
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Describe what your post or Reel covers…"
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
          </label>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
            Brand Tone
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as CaptionTone)}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            >
              <option value="professional">Professional</option>
              <option value="conversational">Conversational</option>
              <option value="educational">Educational</option>
              <option value="bold">Bold</option>
            </select>
          </label>
        </div>
      </div>

      <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
        Call to Action
        <input
          type="text"
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          placeholder="Optional prompt at the end of your caption"
          className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
        />
      </label>

      {!hasTopic ? (
        <EmptyState
          title="Describe your post topic to draft captions"
          description="Enter at least 3 characters above to generate Short Hook, Storyteller, and Educational caption variations."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {drafts.map((draft, i) => (
            <div
              key={draft.style}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#6941EF] dark:text-[#A99AFF]">
                    {draft.style}
                  </span>
                  <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
                </div>
                <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-[#0F172A]/85 dark:text-slate-300">
                  {draft.text}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-[#263047]">
                <span className="font-mono text-[11px] tabular-nums text-[#64748B]">
                  {draft.characterCount} chars
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if (await safeCopy(draft.text)) {
                      setCopiedIdx(i);
                      setTimeout(() => setCopiedIdx(null), 1500);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
                >
                  {copiedIdx === i ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copiedIdx === i ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentIdeasWorkspace({ dict }: { dict: Dictionary }) {
  const [niche, setNiche] = useState('specialty coffee branding');
  const [audience, setAudience] = useState('independent cafe founders');
  const [goal, setGoal] = useState<'reach' | 'saves' | 'conversion' | 'community'>('saves');

  const ready = niche.trim().length >= 2 && audience.trim().length >= 2;
  const ideas = ready ? generateContentIdeas({ niche, audience, goal }) : [];

  return (
    <div className="space-y-5">
      <PresetBar
        presets={[
          {
            label: 'Specialty Coffee',
            apply: () => {
              setNiche('specialty coffee branding');
              setAudience('independent cafe founders');
              setGoal('saves');
            },
          },
          {
            label: 'Digital Agency',
            apply: () => {
              setNiche('social media reporting');
              setAudience('B2B marketing leads');
              setGoal('conversion');
            },
          },
        ]}
        onClear={() => {
          setNiche('');
          setAudience('');
        }}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
          Niche / Topic *
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g. specialty coffee branding"
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          />
        </label>
        <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
          Target Audience *
          <input
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. independent cafe founders"
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          />
        </label>
        <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
          Primary Objective
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as typeof goal)}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          >
            <option value="saves">Maximize Saves</option>
            <option value="reach">Maximize Discovery Reach</option>
            <option value="community">Grow Comments &amp; Replies</option>
            <option value="conversion">Drive Bio Link Clicks</option>
          </select>
        </label>
      </div>

      {!ready ? (
        <EmptyState
          title="Enter your niche and target audience"
          description="Provide both fields above to generate Reel, Carousel, and Story briefs mapped to your primary KPI."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-white">
              Structured Content Calendar Ideas ({ideas.length})
            </h3>
            <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {ideas.map((idea) => (
              <div
                key={idea.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-[#6941EF] dark:bg-violet-950 dark:text-[#A99AFF]">
                    {idea.format}
                  </span>
                  <span className="text-[11px] font-semibold text-[#0891B2] dark:text-[#22D3EE]">
                    KPI: {idea.kpiFocus}
                  </span>
                </div>
                <h4 className="mt-2 font-display text-sm font-bold text-[#0F172A] dark:text-white">
                  {idea.title}
                </h4>
                <p className="mt-1 text-xs italic text-[#64748B] dark:text-[#94A3B8]">
                  Hook: {idea.hook}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
        {label}
      </span>
      <input
        type="number"
        min={0}
        step={step}
        value={Number.isNaN(value) ? 0 : value}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          onChange(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
        }}
        className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm tabular-nums text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
      />
    </label>
  );
}

function MetricBox({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-[#263047] dark:bg-[#131C2E]">
      <p className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">{label}</p>
      <p
        className={`mt-1 font-display text-lg font-extrabold tabular-nums ${
          accent
            ? 'text-[#6941EF] dark:text-[#A99AFF]'
            : 'text-[#0F172A] dark:text-[#F8FAFC]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TagGroup({ title, tags }: { title: string; tags: string[] }) {
  return (
    <div>
      <p className="text-xs font-bold text-[#0F172A] dark:text-slate-200">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
