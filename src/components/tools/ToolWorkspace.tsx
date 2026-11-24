'use client';

import { Copy, Check, Lock } from 'lucide-react';
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
import { ProfileSearchExperience } from '@/components/search/ProfileSearchExperience';

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

function StoryViewerWorkspace({
  dict,
  sampleHandles,
}: {
  dict: Dictionary;
  sampleHandles: string[];
}) {
  const [handle, setHandle] = useState('viewora.studio');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    ok: boolean;
    error?: { message: string };
    result?: ProviderResponse<StoryAvailabilityData>;
  } | null>(null);

  const checkAvailability = async (target: string) => {
    setHandle(target);
    setLoading(true);
    try {
      const res = await fetch(`/api/stories?q=${encodeURIComponent(target)}`);
      const json = (await res.json()) as {
        ok: boolean;
        error?: { message: string };
        result?: ProviderResponse<StoryAvailabilityData>;
      };
      setResponse(json);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Availability &amp; Anonymity Disclosure</p>
            <p className="mt-1 text-xs leading-relaxed">
              Instagram Stories are restricted by Meta’s official APIs to authorized account owners.
              Viewora never scrapes private or third-party Stories and never simulates unauthorized
              anonymous playback.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          aria-label="Instagram username to check Story availability"
          placeholder="Enter @username"
          className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void checkAvailability(handle)}
          className="h-11 rounded-xl bg-[#7957FF] px-5 text-sm font-semibold text-white hover:bg-[#6441f5] disabled:opacity-60"
        >
          {loading ? 'Checking…' : 'Check Authorized Availability'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
        {sampleHandles.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void checkAvailability(s)}
            className="rounded border border-slate-200 px-2 py-0.5 font-mono hover:border-[#7957FF] dark:border-slate-700"
          >
            @{s}
          </button>
        ))}
      </div>

      {response?.error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{response.error.message}</p>
      ) : null}

      {response?.ok && response.result?.data ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-[#080D19]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Story Source Status for @{response.result.data.username}
            </h3>
            <ProvenanceBadge dataClass="unavailable" labels={dict.provenance} />
          </div>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            {response.result.data.reason}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
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

  const result = calculateEngagement({
    followers,
    avgLikes,
    avgComments,
    avgSaves,
    avgShares,
    avgReach,
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField label="Followers" value={followers} onChange={setFollowers} />
        <NumberField label="Avg. Likes / Post" value={avgLikes} onChange={setAvgLikes} />
        <NumberField label="Avg. Comments / Post" value={avgComments} onChange={setAvgComments} />
        <NumberField label="Avg. Saves (Optional)" value={avgSaves} onChange={setAvgSaves} />
        <NumberField label="Avg. Shares (Optional)" value={avgShares} onChange={setAvgShares} />
        <NumberField label="Avg. Reach (Optional)" value={avgReach} onChange={setAvgReach} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-[#080D19]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Engagement Breakdown
          </h3>
          <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <MetricBox label="ER by Followers" value={`${result.erByFollowers}%`} />
          <MetricBox
            label="ER by Reach"
            value={result.erByReach !== null ? `${result.erByReach}%` : '—'}
          />
          <MetricBox label="Account Tier" value={result.tier} />
          <MetricBox label="Benchmark Band" value={result.benchmarkRange} />
        </div>
        <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">
          Status: <strong className="text-slate-900 dark:text-white">{result.rating}</strong> ·
          Total avg interactions: <strong>{result.totalAvgInteractions.toLocaleString()}</strong>.
        </p>
      </div>
    </div>
  );
}

function FollowerGrowthWorkspace({ dict }: { dict: Dictionary }) {
  const [startFollowers, setStartFollowers] = useState(41200);
  const [endFollowers, setEndFollowers] = useState(48200);
  const [days, setDays] = useState(150);
  const [targetMilestone, setTargetMilestone] = useState(60000);

  const result = calculateFollowerGrowth({
    startFollowers,
    endFollowers,
    days,
    targetMilestone,
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField label="Start Followers" value={startFollowers} onChange={setStartFollowers} />
        <NumberField label="Current Followers" value={endFollowers} onChange={setEndFollowers} />
        <NumberField label="Days Elapsed" value={days} onChange={setDays} />
        <NumberField
          label="Target Milestone"
          value={targetMilestone}
          onChange={setTargetMilestone}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-[#080D19]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Growth Velocity &amp; Milestone Estimate
          </h3>
          <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <MetricBox
            label="Net Change"
            value={`${result.netChange >= 0 ? '+' : ''}${result.netChange.toLocaleString()}`}
          />
          <MetricBox label="Growth Rate" value={`${result.percentChange}%`} />
          <MetricBox label="Avg. Daily Gain" value={`${result.dailyAverage} / day`} />
          <MetricBox
            label="Est. Days to Milestone"
            value={
              result.estimatedDaysToTarget !== null
                ? `${result.estimatedDaysToTarget} days`
                : 'N/A'
            }
          />
        </div>
      </div>
    </div>
  );
}

function BioAnalyzerWorkspace({ dict }: { dict: Dictionary }) {
  const [bio, setBio] = useState(
    'Small-batch Nordic coffee roastery ☕\nWeekly brew guides & origin notes\nShop fresh beans via our link below 👇'
  );
  const result = analyzeBio(bio);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="bio-textarea"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Paste or draft your Instagram bio
          </label>
          <span
            className={`font-mono text-xs ${
              result.characterCount > 150 ? 'text-rose-600' : 'text-slate-500'
            }`}
          >
            {result.characterCount} / {result.maxCharacters} chars
          </span>
        </div>
        <textarea
          id="bio-textarea"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-[#080D19]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Bio Readiness Score: {result.score} / 100
          </h3>
          <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-[#7957FF] transition-all"
            style={{ width: `${result.score}%` }}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Strengths</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
              {result.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Suggestions</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
              {result.suggestions.length > 0 ? (
                result.suggestions.map((s) => <li key={s}>{s}</li>)
              ) : (
                <li>All core bio checks passed.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function HashtagGeneratorWorkspace({ dict }: { dict: Dictionary }) {
  const [topic, setTopic] = useState('specialty coffee pour over');
  const [niche, setNiche] = useState('food');
  const [copied, setCopied] = useState(false);

  const tags = generateHashtags(topic, niche);

  const copyAll = async () => {
    await navigator.clipboard.writeText(tags.all.join(' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label
            htmlFor="hashtag-topic"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Post Topic / Keywords
          </label>
          <input
            id="hashtag-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
          />
        </div>
        <div>
          <label
            htmlFor="hashtag-niche"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Niche Category
          </label>
          <select
            id="hashtag-niche"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
          >
            <option value="marketing">Marketing &amp; SaaS</option>
            <option value="food">Food &amp; Coffee</option>
            <option value="fitness">Health &amp; Fitness</option>
            <option value="design">Design &amp; Interiors</option>
            <option value="ecommerce">E-commerce &amp; DTC</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-[#080D19]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Balanced Hashtag Set ({tags.all.length} tags)
            </h3>
            <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
          </div>
          <button
            type="button"
            onClick={() => void copyAll()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#131C2E] dark:text-slate-200"
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
    </div>
  );
}

function CompetitorComparisonWorkspace({ dict }: { dict: Dictionary }) {
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

  const followerRatio = (accountA.followers / Math.max(1, accountB.followers)).toFixed(2);
  const erDelta = Number((accountA.er - accountB.er).toFixed(2));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Compare labeled demo accounts or enter your own public benchmark values.
        </p>
        <ProvenanceBadge dataClass="demo" labels={dict.provenance} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#080D19]">
          <input
            type="text"
            aria-label="Account A label"
            value={accountA.name}
            onChange={(e) => setAccountA({ ...accountA, name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold dark:border-slate-700 dark:bg-[#131C2E] dark:text-white"
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <NumberField
              label="Followers"
              value={accountA.followers}
              onChange={(v) => setAccountA({ ...accountA, followers: v })}
            />
            <NumberField
              label="ER (%)"
              step={0.1}
              value={accountA.er}
              onChange={(v) => setAccountA({ ...accountA, er: v })}
            />
            <NumberField
              label="Posts / wk"
              step={0.1}
              value={accountA.postsPerWeek}
              onChange={(v) => setAccountA({ ...accountA, postsPerWeek: v })}
            />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#080D19]">
          <input
            type="text"
            aria-label="Account B label"
            value={accountB.name}
            onChange={(e) => setAccountB({ ...accountB, name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold dark:border-slate-700 dark:bg-[#131C2E] dark:text-white"
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <NumberField
              label="Followers"
              value={accountB.followers}
              onChange={(v) => setAccountB({ ...accountB, followers: v })}
            />
            <NumberField
              label="ER (%)"
              step={0.1}
              value={accountB.er}
              onChange={(v) => setAccountB({ ...accountB, er: v })}
            />
            <NumberField
              label="Posts / wk"
              step={0.1}
              value={accountB.postsPerWeek}
              onChange={(v) => setAccountB({ ...accountB, postsPerWeek: v })}
            />
          </div>
        </div>
      </div>
      <div className="grid gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 sm:grid-cols-3 dark:border-violet-900/60 dark:bg-violet-950/30">
        <MetricBox label="Audience Ratio (A vs B)" value={`${followerRatio}×`} />
        <MetricBox label="Engagement Delta" value={`${erDelta >= 0 ? '+' : ''}${erDelta} pts`} />
        <MetricBox
          label="Higher Cadence"
          value={accountA.postsPerWeek >= accountB.postsPerWeek ? accountA.name : accountB.name}
        />
      </div>
    </div>
  );
}

function InfluencerAnalyzerWorkspace({ dict }: { dict: Dictionary }) {
  const [followers, setFollowers] = useState(74900);
  const [avgLikes, setAvgLikes] = useState(3180);
  const [avgComments, setAvgComments] = useState(214);
  const [postsPerWeek, setPostsPerWeek] = useState(4.5);

  const result = evaluateInfluencer({ followers, avgLikes, avgComments, postsPerWeek });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <NumberField label="Followers" value={followers} onChange={setFollowers} />
        <NumberField label="Avg. Likes" value={avgLikes} onChange={setAvgLikes} />
        <NumberField label="Avg. Comments" value={avgComments} onChange={setAvgComments} />
        <NumberField
          label="Posts / Week"
          step={0.5}
          value={postsPerWeek}
          onChange={setPostsPerWeek}
        />
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-[#080D19]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Creator Evaluation Summary
          </h3>
          <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <MetricBox label="Influencer Tier" value={result.tier} />
          <MetricBox label="Engagement Rate" value={`${result.engagementRate}%`} />
          <MetricBox
            label="Est. Reach Range"
            value={`${result.estimatedReachLow.toLocaleString()} – ${result.estimatedReachHigh.toLocaleString()}`}
          />
          <MetricBox label="Readiness Score" value={`${result.readinessScore} / 100`} />
        </div>
      </div>
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

  const result = analyzePostPerformance({ likes, comments, saves, shares, reach, followers });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField label="Likes" value={likes} onChange={setLikes} />
        <NumberField label="Comments" value={comments} onChange={setComments} />
        <NumberField label="Saves" value={saves} onChange={setSaves} />
        <NumberField label="Shares" value={shares} onChange={setShares} />
        <NumberField label="Post Reach" value={reach} onChange={setReach} />
        <NumberField label="Followers" value={followers} onChange={setFollowers} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-[#080D19]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Post Diagnostics: {result.verdict}
          </h3>
          <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <MetricBox label="ER by Reach" value={`${result.engagementRateByReach}%`} />
          <MetricBox label="Save Rate" value={`${result.saveRate}%`} />
          <MetricBox label="Share Rate" value={`${result.shareRate}%`} />
          <MetricBox label="Comment / Like" value={`${result.commentToLikeRatio}%`} />
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
          {result.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CaptionGeneratorWorkspace({ dict }: { dict: Dictionary }) {
  const [topic, setTopic] = useState('Q4 Instagram carousel benchmark insights');
  const [tone, setTone] = useState<CaptionTone>('professional');
  const [cta, setCta] = useState('Save this breakdown for your next weekly planning session.');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const drafts = generateCaptions({ topic, tone, cta });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Post Topic
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
            />
          </label>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Brand Tone
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as CaptionTone)}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
            >
              <option value="professional">Professional</option>
              <option value="conversational">Conversational</option>
              <option value="educational">Educational</option>
              <option value="bold">Bold</option>
            </select>
          </label>
        </div>
      </div>

      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
        Call to Action
        <input
          type="text"
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        {drafts.map((draft, i) => (
          <div
            key={draft.style}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#080D19]"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#7957FF]">{draft.style}</span>
                <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
              </div>
              <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {draft.text}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <span className="font-mono text-[11px] text-slate-500">
                {draft.characterCount} chars
              </span>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(draft.text);
                  setCopiedIdx(i);
                  setTimeout(() => setCopiedIdx(null), 1500);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold dark:border-slate-700 dark:bg-[#131C2E]"
              >
                {copiedIdx === i ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copiedIdx === i ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContentIdeasWorkspace({ dict }: { dict: Dictionary }) {
  const [niche, setNiche] = useState('specialty coffee branding');
  const [audience, setAudience] = useState('independent cafe founders');
  const [goal, setGoal] = useState<'reach' | 'saves' | 'conversion' | 'community'>('saves');

  const ideas = generateContentIdeas({ niche, audience, goal });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Niche / Topic
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Target Audience
          <input
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-normal dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Primary Objective
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as typeof goal)}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
          >
            <option value="saves">Maximize Saves</option>
            <option value="reach">Maximize Discovery Reach</option>
            <option value="community">Grow Comments &amp; Replies</option>
            <option value="conversion">Drive Bio Link Clicks</option>
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Structured Content Calendar Ideas ({ideas.length})
        </h3>
        <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {ideas.map((idea) => (
          <div
            key={idea.title}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#080D19]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                {idea.format}
              </span>
              <span className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-400">
                KPI: {idea.kpiFocus}
              </span>
            </div>
            <h4 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{idea.title}</h4>
            <p className="mt-1 text-xs italic text-slate-600 dark:text-slate-400">
              Hook: {idea.hook}
            </p>
          </div>
        ))}
      </div>
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
      <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <input
        type="number"
        min={0}
        step={step}
        value={Number.isNaN(value) ? 0 : value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
      />
    </label>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-[#131C2E]">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 truncate text-base font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function TagGroup({ title, tags }: { title: string; tags: string[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-[#131C2E]">
      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-violet-50 px-2 py-0.5 font-mono text-xs text-[#7957FF] dark:bg-violet-950 dark:text-[#A99AFF]"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
