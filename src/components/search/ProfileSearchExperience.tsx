'use client';

import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileDown,
  Lock,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { ProviderResponse, PublicProfileData } from '@/lib/providers/types';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';

interface SearchApiResponse {
  ok: boolean;
  requiresRegistration?: boolean;
  normalized?: { username: string; profileUrl: string; inputType: string };
  result?: ProviderResponse<PublicProfileData>;
  error?: { code: string; message: string };
}

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
  const [response, setResponse] = useState<SearchApiResponse | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const runSearch = async (rawQuery: string, isDemoPreview = false) => {
    setQuery(rawQuery);
    setLoading(true);
    setNetworkError(null);

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

  return (
    <div className="mx-auto w-full max-w-4xl">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row"
      >
        <label htmlFor="ig-search-input" className="sr-only">
          {dict.home.searchPlaceholder}
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="ig-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.home.searchPlaceholder}
            autoComplete="off"
            className="h-11 w-full rounded-xl bg-transparent pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          {loading ? 'Analyzing…' : dict.home.searchButton}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      {/* Labeled demo profile quick buttons */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <span>{dict.home.tryDemoLabel}</span>
        {sampleHandles.map((handle) => (
          <button
            key={handle}
            type="button"
            onClick={() => void runSearch(handle, true)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500"
          >
            @{handle}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void runSearch('private.sample', true)}
          className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 transition hover:border-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          @private.sample (private demo)
        </button>
      </div>

      {networkError ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
        >
          {networkError}
        </div>
      ) : null}

      {/* Validation or free visitor limit error */}
      {response && !response.ok && response.error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-left dark:border-amber-900/60 dark:bg-amber-950/40"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                {response.requiresRegistration
                  ? 'Free visitor search limit reached'
                  : 'Please check the Instagram username or URL'}
              </p>
              <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
                {response.error.message}
              </p>
              {response.requiresRegistration ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/${locale}/auth/signup${response.normalized ? `?handle=${encodeURIComponent(response.normalized.username)}` : ''}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Create Free Account
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href={`/${locale}/pricing`}
                    className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    Compare Plans
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Private Account or Unavailable Honest Response */}
      {response?.ok && meta && !profile ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {meta.availability === 'private_account' ? (
                <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-slate-500" aria-hidden="true" />
              )}
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {meta.availability === 'private_account'
                  ? 'Private Instagram Account — Not Accessible'
                  : `Public data for @${response.normalized?.username} is currently unavailable`}
              </h3>
            </div>
            <ProvenanceBadge dataClass={meta.dataClass} labels={dict.provenance} />
          </div>

          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{meta.notice}</p>

          {meta.limitations.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-500 dark:text-slate-400">
              {meta.limitations.map((lim) => (
                <li key={lim}>{lim}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/tools/engagement-calculator`}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Use Manual Engagement Calculator
            </Link>
            <Link
              href={`/${locale}/tools/bio-analyzer`}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Analyze a Bio Manually
            </Link>
          </div>
        </div>
      ) : null}

      {/* Available Public / Demo Results + Premium Feature Preview */}
      {response?.ok && profile && meta ? (
        <div className="mt-6 space-y-5 text-left">
          {/* Profile Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm"
                  style={{ backgroundColor: profile.avatarAccent }}
                  aria-hidden="true"
                >
                  {profile.avatarInitials}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {profile.displayName}
                    </h3>
                    {profile.isVerified ? (
                      <CheckCircle2
                        className="h-4 w-4 text-sky-500"
                        aria-label="Verified indicator"
                      />
                    ) : null}
                  </div>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    @{profile.username} · {profile.category}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ProvenanceBadge dataClass={meta.dataClass} labels={dict.provenance} />
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {meta.providerLabel}
                </span>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">{profile.bio}</p>

            {/* Key public stats */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs text-slate-500 dark:text-slate-400">Followers</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {formatCompact(profile.followersCount)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs text-slate-500 dark:text-slate-400">Following</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {formatCompact(profile.followingCount)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs text-slate-500 dark:text-slate-400">Public Posts</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {formatCompact(profile.postsCount)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Est. Engagement</p>
                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    EST
                  </span>
                </div>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {profile.estimatedEngagementRate !== null
                    ? `${profile.estimatedEngagementRate}%`
                    : '—'}
                </p>
              </div>
            </div>

            {toolMode === 'profile-analyzer' && profile.followersCount && profile.followingCount ? (
              <div className="mt-5 rounded-xl border border-indigo-200/70 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold tracking-wider text-indigo-900 uppercase dark:text-indigo-200">
                    Profile Audit Snapshot
                  </h4>
                  <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
                </div>
                <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Follower / Following Ratio</span>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                      {(profile.followersCount / Math.max(1, profile.followingCount)).toFixed(1)}×
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Posting Cadence</span>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                      {profile.postingCadencePerWeek ?? '—'} posts / week
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Bio Link Present</span>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                      {profile.externalUrl ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Recent public posts sample */}
            {profile.recentPosts.length > 0 ? (
              <div className="mt-5">
                <h4 className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Recent Public Posts ({meta.dataClass})
                </h4>
                <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
                  {profile.recentPosts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950"
                    >
                      <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {post.mediaType}
                      </span>
                      <p className="mt-2 line-clamp-3 text-slate-700 dark:text-slate-300">
                        {post.captionExcerpt}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        <span>{formatCompact(post.likes)} likes</span>
                        <span>{formatCompact(post.comments)} comments</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Source transparency disclaimer */}
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
              <p className="font-medium text-slate-800 dark:text-slate-200">{meta.notice}</p>
              <p className="mt-1">
                Fetched: {new Date(meta.freshness.fetchedAt).toLocaleString()} · Confidence:{' '}
                <span className="font-mono">{meta.confidence}</span>
              </p>
            </div>
          </div>

          {/* Premium Feature Preview Card (Conversion Flow Step 4 → 5 → 6) */}
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white p-6 shadow-sm dark:border-indigo-900/60 dark:from-indigo-950/40 dark:to-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Premium Analytics Preview for @{profile.username}
                </h4>
              </div>
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800 dark:bg-indigo-900/70 dark:text-indigo-200">
                Preview · Account Required
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Create a free Viewora account to save @{profile.username} to your dashboard, track
              public follower changes over time, generate structured AI insights, and export CSV/PDF
              reports on eligible plans.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
                <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-slate-900 dark:text-white">
                  Historical Public Trends
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {profile.historicalTrend.length} sample checkpoints ready to explore in the dashboard.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-slate-900 dark:text-white">
                  AI Profile Report
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Content mix diagnostics, cadence recommendations, and benchmark comparisons.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3.5 dark:border-slate-800 dark:bg-slate-950/70">
                <FileDown className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-slate-900 dark:text-white">
                  CSV &amp; PDF Exports
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Client-ready reports stamped with source and freshness metadata.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/${locale}/auth/signup?handle=${encodeURIComponent(profile.username)}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Save @{profile.username} in Free Account
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href={`/${locale}/pricing`}
                className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                View Plans (Demo Pricing)
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
