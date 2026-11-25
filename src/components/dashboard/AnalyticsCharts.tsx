'use client';

import { BarChart3, Clock, Info, Table } from 'lucide-react';
import { useState } from 'react';
import type { DataClass, PublicProfileData } from '@/lib/providers/types';
import { EmptyState } from '@/components/ui/Primitives';

export type DateRangeFilter = '30d' | '90d' | 'all';
export type ViewMode = 'charts' | 'table' | 'both';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function AnalyticsVisualizations({
  profile,
  dataClass = 'demo',
  providerLabel,
  fetchedAt,
  initialRange = 'all',
  initialViewMode = 'both',
}: {
  profile: PublicProfileData;
  dataClass?: DataClass;
  providerLabel?: string;
  fetchedAt?: string;
  initialRange?: DateRangeFilter;
  initialViewMode?: ViewMode;
}) {
  const [range, setRange] = useState<DateRangeFilter>(initialRange);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const allPoints = profile.historicalTrend;
  const points =
    range === '30d'
      ? allPoints.slice(-2)
      : range === '90d'
        ? allPoints.slice(-4)
        : allPoints;

  if (points.length === 0) {
    return (
      <EmptyState
        title={`No historical checkpoints recorded yet for @${profile.username}`}
        description="Once public or authorized snapshots are captured over time, interactive growth curves and accessible checkpoint tables will appear here."
      />
    );
  }

  const maxF = Math.max(...points.map((p) => p.followers));
  const minF = Math.min(...points.map((p) => p.followers));
  const fSpan = Math.max(1, maxF - minF);

  const coords = points.map((pt, idx) => ({
    pt,
    x: 28 + (idx / Math.max(1, points.length - 1)) * 304,
    y: 126 - ((pt.followers - minF) / fSpan) * 94,
  }));

  const linePath = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPath = `28,136 ${linePath} ${coords[coords.length - 1]?.x ?? 332},136`;

  const maxEr = Math.max(...points.map((p) => p.engagementRate), 1);

  const firstPoint = points[0]!;
  const lastPoint = points[points.length - 1]!;
  const netGrowth = lastPoint.followers - firstPoint.followers;
  const pctGrowth =
    firstPoint.followers > 0 ? Number(((netGrowth / firstPoint.followers) * 100).toFixed(1)) : 0;

  // Content format breakdown from actual recent posts
  const formatCounts = profile.recentPosts.reduce(
    (acc, post) => {
      acc[post.mediaType] += 1;
      return acc;
    },
    { reel: 0, carousel: 0, image: 0 }
  );
  const totalPostsSample = profile.recentPosts.length;
  const reelPct = totalPostsSample > 0 ? Math.round((formatCounts.reel / totalPostsSample) * 100) : 0;
  const carouselPct =
    totalPostsSample > 0 ? Math.round((formatCounts.carousel / totalPostsSample) * 100) : 0;
  const imagePct = totalPostsSample > 0 ? Math.max(0, 100 - reelPct - carouselPct) : 0;

  // Weekday distribution derived strictly from recentPosts timestamps (no hardcoded fake array)
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const post of profile.recentPosts) {
    const d = new Date(post.publishedAt);
    if (!Number.isNaN(d.getTime())) {
      weekdayCounts[d.getUTCDay()] = (weekdayCounts[d.getUTCDay()] ?? 0) + 1;
    }
  }
  const maxWeekdayCount = Math.max(...weekdayCounts, 1);

  const inspected = activeIdx !== null ? coords[activeIdx] : coords[coords.length - 1];

  return (
    <div className="space-y-6">
      {/* Controls & Source Freshness Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
        <div className="flex flex-wrap items-center gap-3 text-[#64748B] dark:text-[#94A3B8]">
          <span>
            Checkpoints:{' '}
            <strong className="tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
              {points.length}
            </strong>{' '}
            ({dataClass.toUpperCase()})
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-[#22D3EE]" aria-hidden="true" />
            {providerLabel || 'Provider'} ·{' '}
            {fetchedAt ? new Date(fetchedAt).toLocaleDateString() : lastPoint.date}
          </span>
          <span
            className={`font-semibold tabular-nums ${
              netGrowth >= 0
                ? 'text-emerald-600 dark:text-[#34D399]'
                : 'text-rose-600 dark:text-[#F87171]'
            }`}
          >
            Window Δ: {netGrowth >= 0 ? '+' : ''}
            {netGrowth.toLocaleString()} ({pctGrowth >= 0 ? '+' : ''}
            {pctGrowth}%)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Date range filter"
            className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-[#263047] dark:bg-[#131C2E]"
          >
            {(
              [
                ['30d', '30d'],
                ['90d', '90d'],
                ['all', 'All'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={range === id}
                onClick={() => {
                  setRange(id);
                  setActiveIdx(null);
                }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  range === id
                    ? 'bg-[#7957FF] text-white'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Visualization mode"
            className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-[#263047] dark:bg-[#131C2E]"
          >
            {(
              [
                ['charts', 'Charts', BarChart3],
                ['table', 'Table', Table],
                ['both', 'Both', Info],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={viewMode === id}
                onClick={() => setViewMode(id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  viewMode === id
                    ? 'bg-[#0F172A] text-white dark:bg-[#22D3EE] dark:text-[#080D19]'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode !== 'table' ? (
        <>
          {/* Primary Charts Grid */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Follower Growth Trajectory */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Follower Growth Trajectory
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Select or hover any checkpoint to inspect exact counts.
                  </p>
                </div>
                {inspected ? (
                  <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums text-[#6941EF] shadow-2xs dark:bg-[#192337] dark:text-[#A99AFF]">
                    {inspected.pt.date}: {inspected.pt.followers.toLocaleString()}
                  </span>
                ) : null}
              </div>

              <svg
                viewBox="0 0 360 160"
                className="mt-3 h-48 w-full"
                role="img"
                aria-label={`Follower growth chart for @${profile.username}, ranging from ${minF.toLocaleString()} to ${maxF.toLocaleString()} followers`}
              >
                <defs>
                  <linearGradient id="vieworaAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7957FF" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[36, 80, 126].map((y) => (
                  <line
                    key={y}
                    x1="24"
                    y1={y}
                    x2="336"
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.1"
                    strokeDasharray="3 3"
                  />
                ))}
                <polygon points={areaPath} fill="url(#vieworaAreaGrad)" />
                <polyline
                  fill="none"
                  stroke="#7957FF"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={linePath}
                />
                {coords.map((c, idx) => (
                  <g
                    key={c.pt.date}
                    className="cursor-pointer"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => setActiveIdx(idx)}
                  >
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={activeIdx === idx ? 6 : 4}
                      fill={activeIdx === idx ? '#22D3EE' : '#7957FF'}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                    <text x={c.x} y="152" textAnchor="middle" fontSize="9.5" fill="#94A3B8">
                      {c.pt.date.slice(5)}
                    </text>
                  </g>
                ))}
              </svg>

              {/* Keyboard-Accessible Checkpoint Selector Buttons */}
              <div className="mt-2 flex flex-wrap gap-1">
                {points.map((pt, idx) => (
                  <button
                    key={pt.date}
                    type="button"
                    aria-pressed={activeIdx === idx}
                    onClick={() => setActiveIdx(idx)}
                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] transition ${
                      activeIdx === idx
                        ? 'bg-[#7957FF] font-bold text-white'
                        : 'bg-white text-[#64748B] hover:text-[#0F172A] dark:bg-[#131C2E] dark:text-[#94A3B8]'
                    }`}
                  >
                    {pt.date}
                  </button>
                ))}
              </div>
            </div>

            {/* Engagement Rate Bar Chart */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Estimated Engagement Rate (%)
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Interactions divided by followers at each recorded snapshot.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex h-48 items-end justify-between gap-2.5 pt-4">
                {points.map((pt) => {
                  const hPct = Math.max(16, Math.round((pt.engagementRate / maxEr) * 100));
                  return (
                    <div
                      key={pt.date}
                      title={`${pt.date}: ${pt.engagementRate}% ER · ${pt.posts} posts`}
                      className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                    >
                      <span className="font-mono text-[10px] font-bold tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                        {pt.engagementRate}%
                      </span>
                      <div className="flex h-32 w-full items-end justify-center">
                        <div
                          className="w-full max-w-11 rounded-t-xl bg-gradient-to-t from-[#7957FF] to-[#22D3EE] opacity-90 transition group-hover:opacity-100"
                          style={{ height: `${hPct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                        {pt.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Format Mix + Observed Weekday Distribution */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
              <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Content Format Mix ({totalPostsSample} sampled posts)
              </h3>
              {totalPostsSample === 0 ? (
                <p className="mt-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  No recent post records available for format breakdown.
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-6">
                  <svg
                    viewBox="0 0 100 100"
                    className="h-28 w-28 shrink-0"
                    role="img"
                    aria-label={`Content mix: ${reelPct}% Reels, ${carouselPct}% Carousels, ${imagePct}% Single Posts`}
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="36"
                      fill="none"
                      stroke="#E2E8F0"
                      strokeWidth="14"
                      className="dark:stroke-[#192337]"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="36"
                      fill="none"
                      stroke="#7957FF"
                      strokeWidth="14"
                      strokeDasharray={`${(reelPct / 100) * 226} 226`}
                      transform="rotate(-90 50 50)"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="36"
                      fill="none"
                      stroke="#22D3EE"
                      strokeWidth="14"
                      strokeDasharray={`${(carouselPct / 100) * 226} 226`}
                      strokeDashoffset={`${-((reelPct / 100) * 226)}`}
                      transform="rotate(-90 50 50)"
                    />
                    <text
                      x="50"
                      y="54"
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="700"
                      fill="currentColor"
                    >
                      {totalPostsSample}
                    </text>
                  </svg>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#7957FF]" />
                      <span className="text-[#64748B] dark:text-[#94A3B8]">Reels:</span>
                      <strong className="tabular-nums text-[#0F172A] dark:text-white">
                        {reelPct}% ({formatCounts.reel})
                      </strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#22D3EE]" />
                      <span className="text-[#64748B] dark:text-[#94A3B8]">Carousels:</span>
                      <strong className="tabular-nums text-[#0F172A] dark:text-white">
                        {carouselPct}% ({formatCounts.carousel})
                      </strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                      <span className="text-[#64748B] dark:text-[#94A3B8]">Single Posts:</span>
                      <strong className="tabular-nums text-[#0F172A] dark:text-white">
                        {imagePct}% ({formatCounts.image})
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Derived Weekday Distribution (Computed strictly from recentPosts) */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Observed Weekday Publishing Distribution
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Derived directly from sampled post timestamps (UTC).
                  </p>
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                  ~{profile.postingCadencePerWeek ?? 0} posts/wk
                </span>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[10px]">
                {WEEKDAYS.map((day, i) => {
                  const count = weekdayCounts[i] ?? 0;
                  const heightPct = count > 0 ? Math.max(24, Math.round((count / maxWeekdayCount) * 100)) : 8;
                  return (
                    <div key={day} className="flex flex-col items-center gap-1.5">
                      <span className="font-mono font-bold tabular-nums text-[#0F172A] dark:text-slate-200">
                        {count}
                      </span>
                      <div className="flex h-20 w-full items-end justify-center rounded-lg bg-slate-200/50 p-1 dark:bg-[#192337]">
                        <div
                          className={`w-full rounded-md transition-all ${
                            count > 0 ? 'bg-[#7957FF]' : 'bg-slate-300/60 dark:bg-[#263047]'
                          }`}
                          style={{ height: `${heightPct}%` }}
                          title={`${day}: ${count} sampled post${count === 1 ? '' : 's'}`}
                        />
                      </div>
                      <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">
                        {day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Accessible Data Table Alternative */}
      {viewMode !== 'charts' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-[#263047] dark:bg-[#0F172A]">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-[#263047]">
            <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Accessible Checkpoint Data Table (@{profile.username})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E]">
                  <th className="px-4 py-2.5 font-semibold">Observed Date</th>
                  <th className="px-4 py-2.5 font-semibold">Followers</th>
                  <th className="px-4 py-2.5 font-semibold">Net Change</th>
                  <th className="px-4 py-2.5 font-semibold">Total Posts</th>
                  <th className="px-4 py-2.5 font-semibold">Est. ER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#263047]">
                {points.map((pt, idx) => {
                  const prev = idx > 0 ? points[idx - 1] : null;
                  const delta = prev ? pt.followers - prev.followers : null;
                  return (
                    <tr key={pt.date}>
                      <td className="px-4 py-2.5 font-mono text-[#0F172A] dark:text-slate-200">
                        {pt.date}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-[#0F172A] dark:text-white">
                        {pt.followers.toLocaleString()}
                      </td>
                      <td
                        className={`px-4 py-2.5 font-semibold ${
                          delta === null
                            ? 'text-[#64748B]'
                            : delta >= 0
                              ? 'text-emerald-600 dark:text-[#34D399]'
                              : 'text-rose-600 dark:text-[#F87171]'
                        }`}
                      >
                        {delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toLocaleString()}`}
                      </td>
                      <td className="px-4 py-2.5 text-[#64748B] dark:text-slate-300">{pt.posts}</td>
                      <td className="px-4 py-2.5 font-semibold text-[#6941EF] dark:text-[#A99AFF]">
                        {pt.engagementRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
