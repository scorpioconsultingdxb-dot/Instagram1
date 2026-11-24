'use client';

import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bookmark,
  CheckCircle2,
  Clock,
  FileDown,
  GitCompare,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { ProviderResponse, PublicProfileData } from '@/lib/providers/types';
import { generateStructuredProfileInsights } from '@/lib/reports/export';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import {
  ErrorState,
  MetricCard,
  SkeletonCard,
  UpgradePreviewCard,
} from '@/components/ui/Primitives';

interface SearchApiResponse {
  ok: boolean;
  requiresRegistration?: boolean;
  normalized?: { username: string; profileUrl: string; inputType: string };
  result?: ProviderResponse<PublicProfileData>;
  error?: { code: string; message: string };
}

type ResultTab = 'overview' | 'content' | 'growth' | 'engagement' | 'ai' | 'reports';

function formatCompact(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  );
}

export function ProfileSearchExperience({
  locale,
  dict,
  sampleHandles,
  toolMode = 'homepage',
}: {
  locale: Locale;
  dict: Dictionary;
  sampleHandles: string[];
  toolMode?: 'homepage' | 'anonymous-viewer' | 'profile-analyzer';
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ResultTab>('overview');
  const [response, setResponse] = useState<SearchApiResponse | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const runSearch = async (rawQuery: string, isDemoPreview = false) => {
    setQuery(rawQuery);
    setLoading(true);
    setNetworkError(null);
    setActiveTab('overview');

    try {
      const params = new URLSearchParams({ q: rawQuery });
      if (isDemoPreview) params.set('preview', 'demo');
      const res = await fetch(`/api/search?${params.toString()}`);
      const json = (await res.json()) as SearchApiResponse;
      setResponse(json);
    } catch {
      setNetworkError('Unable to reach the search service right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runSearch(query, false);
  };

  const profile = response?.result?.data ?? null;
  const meta = response?.result?.meta ?? null;

  const aiPreview =
    profile && meta
      ? generateStructuredProfileInsights({ profile, dataClass: meta.dataClass })
      : null;

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Elevated Search Bar */}
      <form
        onSubmit={handleSubmit}
        className="viewora-card-elevated flex flex-col gap-2 rounded-2xl p-2 sm:flex-row"
      >
        <label htmlFor="ig-search-input" className="sr-only">
          {dict.home.searchPlaceholder}
        </label>
        <div className="relative flex flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#6941EF] dark:text-[#A99AFF]"
            aria-hidden="true"
          />
          <input
            id="ig-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.home.searchPlaceholder}
            autoComplete="off"
            className="h-12 w-full rounded-xl bg-transparent pr-9 pl-10 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none dark:text-[#F8FAFC] dark:placeholder:text-[#94A3B8]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResponse(null);
                setNetworkError(null);
              }}
              aria-label="Clear search input"
              className="absolute right-2.5 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#192337] dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="viewora-btn-primary inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold shadow-sm disabled:opacity-60"
        >
          {loading ? 'Querying provider…' : dict.home.searchButton}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      {/* Labeled Demo Sample Chips */}
      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
        <span>Try a labeled demo:</span>
        {sampleHandles.map((handle) => (
          <button
            key={handle}
            type="button"
            onClick={() => void runSearch(handle, true)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-[#0F172A] transition hover:border-[#7957FF] hover:text-[#6941EF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#F8FAFC] dark:hover:border-[#A99AFF]"
          >
            @{handle}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void runSearch('private.sample', true)}
          className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs text-[#64748B] transition hover:border-amber-400 dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]"
        >
          @private.sample (private demo)
        </button>
      </div>

      {/* Honest Skeleton Loading State (zero fake percentages) */}
      {loading ? (
        <div className="mt-6">
          <SkeletonCard lines={3} />
        </div>
      ) : null}

      {!loading && networkError ? (
        <div className="mt-6 text-left">
          <ErrorState
            title="Connection interrupted"
            description={networkError}
            onRetry={() => void runSearch(query, false)}
          />
        </div>
      ) : null}

      {/* Validation or Visitor Allowance Notice */}
      {!loading && response && !response.ok && response.error ? (
        <div
          role="alert"
          className="animate-viewora-enter mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left dark:border-amber-900/60 dark:bg-amber-950/30"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-[#FBBF24]"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-950 dark:text-amber-200">
                {response.requiresRegistration
                  ? 'Free visitor search limit reached'
                  : 'Check the Instagram username or URL'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/80">
                {response.error.message}
              </p>
              {response.requiresRegistration ? (
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Link
                    href={`/${locale}/register${response.normalized ? `?handle=${encodeURIComponent(response.normalized.username)}` : ''}`}
                    className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
                  >
                    Create Free Account
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href={`/${locale}/pricing`}
                    className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
                  >
                    Compare Plans
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Honest Private Account or Unavailable State */}
      {!loading && response?.ok && meta && !profile ? (
        <div className="viewora-card animate-viewora-enter mt-6 rounded-2xl p-6 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {meta.availability === 'private_account' ? (
                <Lock className="h-5 w-5 text-amber-500" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-[#64748B]" aria-hidden="true" />
              )}
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {meta.availability === 'private_account'
                  ? 'Private Instagram Account — Access Refused'
                  : `No live public record available for @${response.normalized?.username}`}
              </h3>
            </div>
            <ProvenanceBadge
              dataClass={meta.availability === 'unavailable' ? 'unavailable' : meta.dataClass}
              labels={dict.provenance}
            />
          </div>
          <p className="mt-3 text-sm text-[#64748B] dark:text-[#94A3B8]">{meta.notice}</p>
          {meta.limitations.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              {meta.limitations.map((lim) => (
                <li key={lim}>{lim}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => void runSearch('viewora.studio', true)}
              className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Preview Labeled Demo (@viewora.studio)
            </button>
            <Link
              href={`/${locale}/instagram-engagement-calculator`}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#263047] dark:bg-[#0F172A] dark:text-slate-200"
            >
              Open Engagement Calculator
            </Link>
          </div>
        </div>
      ) : null}

      {/* 6-Tab Profile Intelligence Results Experience */}
      {!loading && response?.ok && profile && meta ? (
        <div className="viewora-card-elevated animate-viewora-enter mt-6 overflow-hidden rounded-3xl text-left">
          {/* Profile Identity Header */}
          <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50/70 via-white to-cyan-50/40 p-6 dark:border-[#263047] dark:from-[#192337] dark:via-[#131C2E] dark:to-[#0F172A]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-display text-xl font-extrabold text-white shadow-md"
                  style={{ backgroundColor: profile.avatarAccent }}
                  aria-hidden="true"
                >
                  {profile.avatarInitials}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                      {profile.displayName}
                    </h3>
                    {profile.isVerified ? (
                      <CheckCircle2 className="h-4 w-4 text-[#22D3EE]" aria-label="Verified" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                    @{profile.username} · {profile.category}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ProvenanceBadge dataClass={meta.dataClass} labels={dict.provenance} />
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 py-0.5 text-[11px] text-[#64748B] dark:border-[#263047] dark:bg-[#080D19] dark:text-[#94A3B8]">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      Updated {new Date(meta.freshness.fetchedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/${locale}/register?handle=${encodeURIComponent(profile.username)}`}
                  className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
                >
                  <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                  Save Profile
                </Link>
                <Link
                  href={`/${locale}/instagram-competitor-analysis`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#192337] dark:text-slate-200"
                >
                  <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
                  Compare
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-semibold text-[#6941EF] hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/60 dark:text-[#A99AFF]"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  AI Report
                </button>
              </div>
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#0F172A]/85 dark:text-slate-300">
              {profile.bio}
            </p>
          </div>

          {/* 6-Tab Results Navigation */}
          <div
            role="tablist"
            aria-label="Profile intelligence tabs"
            className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-4 py-2 dark:border-[#263047] dark:bg-[#0F172A]"
          >
            {(
              [
                ['overview', 'Overview'],
                ['content', 'Content'],
                ['growth', 'Growth'],
                ['engagement', 'Engagement'],
                ['ai', 'AI Insights'],
                ['reports', 'Reports'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === id
                    ? 'bg-[#7957FF] text-white shadow-sm'
                    : 'text-[#64748B] hover:bg-slate-200/70 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-[#F8FAFC]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab Panels */}
          <div className="p-6">
            {activeTab === 'overview' ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricCard label="Followers" value={formatCompact(profile.followersCount)} hint={meta.dataClass} />
                  <MetricCard label="Following" value={formatCompact(profile.followingCount)} hint={meta.dataClass} />
                  <MetricCard label="Public Posts" value={formatCompact(profile.postsCount)} hint={meta.dataClass} />
                  <MetricCard
                    label="Est. Engagement"
                    value={profile.estimatedEngagementRate !== null ? `${profile.estimatedEngagementRate}%` : '—'}
                    hint="Transparent estimate"
                    trend={{ value: `${profile.postingCadencePerWeek ?? 0}/wk`, positive: true }}
                  />
                </div>

                {toolMode === 'profile-analyzer' && profile.followersCount && profile.followingCount ? (
                  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-3 dark:border-[#263047] dark:bg-[#0F172A]">
                    <div>
                      <span className="text-[#64748B] dark:text-[#94A3B8]">Follower / Following Ratio</span>
                      <p className="mt-1 font-display text-base font-bold tabular-nums text-[#0F172A] dark:text-white">
                        {(profile.followersCount / Math.max(1, profile.followingCount)).toFixed(1)}×
                      </p>
                    </div>
                    <div>
                      <span className="text-[#64748B] dark:text-[#94A3B8]">Posting Cadence</span>
                      <p className="mt-1 font-display text-base font-bold tabular-nums text-[#0F172A] dark:text-white">
                        {profile.postingCadencePerWeek ?? '—'} posts / week
                      </p>
                    </div>
                    <div>
                      <span className="text-[#64748B] dark:text-[#94A3B8]">External Destination</span>
                      <p className="mt-1 font-display text-base font-bold text-[#0F172A] dark:text-white">
                        {profile.externalUrl ? 'Link detected' : 'None'}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-[#64748B] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]">
                  <strong className="text-[#0F172A] dark:text-[#F8FAFC]">Source Attribution:</strong>{' '}
                  {meta.providerLabel} — {meta.notice}
                </div>
              </div>
            ) : null}

            {activeTab === 'content' ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {profile.recentPosts.map((post) => (
                  <article
                    key={post.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-[#6941EF] dark:bg-violet-950 dark:text-[#A99AFF]">
                        {post.mediaType}
                      </span>
                      <span className="font-mono text-[10px] text-[#64748B]">
                        {post.publishedAt.slice(0, 10)}
                      </span>
                    </div>
                    <p className="mt-2.5 line-clamp-3 leading-relaxed text-[#0F172A] dark:text-slate-300">
                      {post.captionExcerpt}
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 font-semibold tabular-nums text-[#64748B] dark:border-[#263047] dark:text-[#94A3B8]">
                      <span>{formatCompact(post.likes)} likes</span>
                      <span>{formatCompact(post.comments)} comments</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {activeTab === 'growth' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    Recorded Snapshot Progression ({profile.historicalTrend.length} checkpoints)
                  </p>
                  <ProvenanceBadge dataClass={meta.dataClass} labels={dict.provenance} />
                </div>
                <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                  {profile.historicalTrend.map((pt) => (
                    <div
                      key={pt.date}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                    >
                      <p className="font-mono text-[10px] text-[#64748B]">{pt.date}</p>
                      <p className="mt-1 font-display text-sm font-bold tabular-nums text-[#0F172A] dark:text-white">
                        {formatCompact(pt.followers)}
                      </p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-[#6941EF] dark:text-[#A99AFF]">
                        {pt.engagementRate}% ER
                      </p>
                    </div>
                  ))}
                </div>
                <UpgradePreviewCard
                  title="Track 30 to 365 days of continuous public snapshots"
                  description="Save this profile to your Viewora workspace to capture scheduled historical checkpoints and growth velocity charts."
                  requiredTier="Starter+ Plan"
                  ctaHref={`/${locale}/register?handle=${encodeURIComponent(profile.username)}`}
                  ctaLabel={`Save @${profile.username} Free`}
                />
              </div>
            ) : null}

            {activeTab === 'engagement' ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard
                    label="Estimated Engagement Rate"
                    value={`${profile.estimatedEngagementRate ?? '—'}%`}
                    hint="Calculated from available recent public posts"
                  />
                  <MetricCard
                    label="Publishing Cadence"
                    value={`${profile.postingCadencePerWeek ?? '—'} / wk`}
                    hint="Average posts per week"
                  />
                  <MetricCard
                    label="Sample Posts Evaluated"
                    value={String(profile.recentPosts.length)}
                    hint={meta.providerLabel}
                  />
                </div>
                <Link
                  href={`/${locale}/instagram-engagement-calculator`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                >
                  <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                  Run custom Reach &amp; Save-Rate scenarios in the Engagement Calculator →
                </Link>
              </div>
            ) : null}

            {activeTab === 'ai' && aiPreview ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {aiPreview.modelLabel}
                  </p>
                  <ProvenanceBadge dataClass={aiPreview.dataClass} labels={dict.provenance} />
                </div>
                <p className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 text-sm text-[#0F172A] dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-slate-100">
                  {aiPreview.executiveSummary}
                </p>
                <UpgradePreviewCard
                  title="Unlock all 7 Gemini AI Intelligence Reports"
                  description="Generate Growth Opportunity, Competitor Comparison, Influencer Evaluation, Content Strategy, Audit, and Weekly Executive reports in the AI Intelligence Studio."
                  requiredTier="Starter+ Plan"
                  ctaHref={`/${locale}/register?handle=${encodeURIComponent(profile.username)}`}
                  ctaLabel="Open AI Intelligence Studio"
                />
              </div>
            ) : null}

            {activeTab === 'reports' ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
                      <FileDown className="h-4 w-4 text-[#6941EF]" aria-hidden="true" />
                      Viewora Branded PDF Report
                    </div>
                    <p className="mt-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                      Executive printable layout stamped with source provenance and snapshot history
                      (Premium+ plans).
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
                      <FileDown className="h-4 w-4 text-[#22D3EE]" aria-hidden="true" />
                      Structured CSV Data Export
                    </div>
                    <p className="mt-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                      Spreadsheet-ready profile metrics and timeline rows with provenance columns
                      (Pro+ plans).
                    </p>
                  </div>
                </div>
                <Link
                  href={`/${locale}/pricing`}
                  className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  Compare Export Entitlements
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
