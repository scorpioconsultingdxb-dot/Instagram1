'use client';

import { useState } from 'react';
import type { PublicProfileData } from '@/lib/providers/types';

export type DateRangeFilter = '30d' | '90d' | 'all';

export function AnalyticsVisualizations({
  profile,
}: {
  profile: PublicProfileData;
}) {
  const [range, setRange] = useState<DateRangeFilter>('all');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const allPoints = profile.historicalTrend;
  const points =
    range === '30d'
      ? allPoints.slice(-2)
      : range === '90d'
        ? allPoints.slice(-4)
        : allPoints;

  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
        No historical checkpoints recorded yet for @{profile.username}.
      </p>
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

  // Content format breakdown from recent posts
  const formatCounts = profile.recentPosts.reduce(
    (acc, post) => {
      acc[post.mediaType] += 1;
      return acc;
    },
    { reel: 0, carousel: 0, image: 0 }
  );
  const totalPostsSample = Math.max(
    1,
    formatCounts.reel + formatCounts.carousel + formatCounts.image
  );
  const reelPct = Math.round((formatCounts.reel / totalPostsSample) * 100);
  const carouselPct = Math.round((formatCounts.carousel / totalPostsSample) * 100);
  const imagePct = Math.max(0, 100 - reelPct - carouselPct);

  const activeHover = hoveredIdx !== null ? coords[hoveredIdx] : coords[coords.length - 1];

  return (
    <div className="space-y-6">
      {/* Range Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          Showing <strong className="tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">{points.length}</strong>{' '}
          recorded checkpoints (Demo Series)
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-[#263047] dark:bg-[#0F172A]">
          {(
            [
              ['30d', 'Last 30d'],
              ['90d', 'Last 90d'],
              ['all', 'All Checkpoints'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRange(id)}
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
      </div>

      {/* Primary Charts Grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Interactive Area / Line Chart */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Follower Growth Trajectory
            </h3>
            {activeHover ? (
              <span className="rounded-lg bg-white px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#6941EF] shadow-xs dark:bg-[#192337] dark:text-[#A99AFF]">
                {activeHover.pt.date}: {activeHover.pt.followers.toLocaleString()}
              </span>
            ) : null}
          </div>

          <svg
            viewBox="0 0 360 160"
            className="mt-3 h-48 w-full"
            role="img"
            aria-label={`Follower growth chart for @${profile.username}`}
          >
            <defs>
              <linearGradient id="vieworaAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7957FF" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#7957FF" stopOpacity="0.02" />
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
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={hoveredIdx === idx ? 6 : 4}
                  fill={hoveredIdx === idx ? '#22D3EE' : '#7957FF'}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
                <text x={c.x} y="152" textAnchor="middle" fontSize="9.5" fill="#94A3B8">
                  {c.pt.date.slice(5)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Engagement Rate Bar Chart */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Estimated Engagement Rate (%)
            </h3>
            <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              Hover bars for details
            </span>
          </div>
          <div className="mt-4 flex h-44 items-end justify-between gap-2.5 pt-4">
            {points.map((pt) => {
              const hPct = Math.max(16, Math.round((pt.engagementRate / maxEr) * 100));
              return (
                <div
                  key={pt.date}
                  title={`${pt.date}: ${pt.engagementRate}% ER · ${pt.posts} posts`}
                  className="group flex flex-1 flex-col items-center gap-1.5"
                >
                  <span className="font-mono text-[10px] font-bold tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                    {pt.engagementRate}%
                  </span>
                  <div
                    className="w-full max-w-11 rounded-t-xl bg-gradient-to-t from-[#7957FF] to-[#22D3EE] opacity-85 transition group-hover:opacity-100"
                    style={{ height: `${hPct}%` }}
                  />
                  <span className="font-mono text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                    {pt.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Format Donut + Cadence Heatmap */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
          <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            Sample Content Format Mix
          </h3>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" role="img" aria-label="Content format donut chart">
              <circle cx="50" cy="50" r="36" fill="none" stroke="#E2E8F0" strokeWidth="14" className="dark:stroke-[#192337]" />
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
              <text x="50" y="54" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">
                {profile.recentPosts.length}
              </text>
            </svg>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#7957FF]" />
                <span className="text-[#64748B] dark:text-[#94A3B8]">Reels:</span>
                <strong className="tabular-nums text-[#0F172A] dark:text-white">{reelPct}%</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#22D3EE]" />
                <span className="text-[#64748B] dark:text-[#94A3B8]">Carousels:</span>
                <strong className="tabular-nums text-[#0F172A] dark:text-white">{carouselPct}%</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                <span className="text-[#64748B] dark:text-[#94A3B8]">Single Posts:</span>
                <strong className="tabular-nums text-[#0F172A] dark:text-white">{imagePct}%</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Publishing Activity Heatmap */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Publishing Cadence Heatmap (Sample)
            </h3>
            <span className="text-[11px] tabular-nums text-[#64748B] dark:text-[#94A3B8]">
              ~{profile.postingCadencePerWeek ?? 0} posts/wk
            </span>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] text-[#64748B]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d}>{d}</div>
            ))}
            {[1, 3, 2, 3, 2, 1, 0, 2, 3, 1, 2, 3, 1, 1, 1, 2, 3, 2, 2, 0, 1].map((lvl, idx) => (
              <div
                key={idx}
                className={`h-6 rounded-md ${
                  lvl === 0
                    ? 'bg-slate-200/70 dark:bg-[#192337]'
                    : lvl === 1
                      ? 'bg-[#7957FF]/25'
                      : lvl === 2
                        ? 'bg-[#7957FF]/60'
                        : 'bg-[#7957FF]'
                }`}
                title={`Activity level ${lvl}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Accessible Data Table Disclosure */}
      <details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
        <summary className="cursor-pointer font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
          View accessible checkpoint data table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 text-[#64748B] dark:border-[#263047]">
                <th className="py-1.5 pr-4">Date</th>
                <th className="py-1.5 pr-4">Followers</th>
                <th className="py-1.5 pr-4">Posts</th>
                <th className="py-1.5">Est. ER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#263047]">
              {points.map((pt) => (
                <tr key={pt.date}>
                  <td className="py-1.5 pr-4 font-mono">{pt.date}</td>
                  <td className="py-1.5 pr-4">{pt.followers.toLocaleString()}</td>
                  <td className="py-1.5 pr-4">{pt.posts}</td>
                  <td className="py-1.5">{pt.engagementRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
