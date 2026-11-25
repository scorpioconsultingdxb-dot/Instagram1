'use client';

import Link from 'next/link';
import { ArrowRight, BarChart3, Layers, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { MembershipBadge } from '@/components/ui/Primitives';

interface DemoShowcaseProfile {
  handle: string;
  displayName: string;
  category: string;
  followers: string;
  er: string;
  cadence: string;
  growth6m: string;
  series: Array<{ label: string; followers: number; er: number }>;
  mix: { reels: number; carousels: number; images: number };
}

const SHOWCASE_PROFILES: DemoShowcaseProfile[] = [
  {
    handle: 'viewora.studio',
    displayName: 'Viewora Design Studio',
    category: 'Product & Analytics',
    followers: '48.2K',
    er: '4.18%',
    cadence: '4.2 / wk',
    growth6m: '+17.0%',
    series: [
      { label: 'Jun', followers: 41200, er: 3.7 },
      { label: 'Jul', followers: 42500, er: 3.9 },
      { label: 'Aug', followers: 44100, er: 4.0 },
      { label: 'Sep', followers: 45400, er: 4.1 },
      { label: 'Oct', followers: 46900, er: 4.15 },
      { label: 'Nov', followers: 48200, er: 4.18 },
    ],
    mix: { reels: 50, carousels: 33, images: 17 },
  },
  {
    handle: 'aurora.coffee',
    displayName: 'Aurora Coffee Roasters',
    category: 'Specialty Food & Beverage',
    followers: '19.5K',
    er: '5.12%',
    cadence: '5.0 / wk',
    growth6m: '+20.1%',
    series: [
      { label: 'Jun', followers: 16200, er: 4.6 },
      { label: 'Jul', followers: 16850, er: 4.7 },
      { label: 'Aug', followers: 17400, er: 4.85 },
      { label: 'Sep', followers: 18100, er: 4.95 },
      { label: 'Oct', followers: 18800, er: 5.04 },
      { label: 'Nov', followers: 19450, er: 5.12 },
    ],
    mix: { reels: 40, carousels: 40, images: 20 },
  },
  {
    handle: 'nordic.design',
    displayName: 'Nordic Interiors Collective',
    category: 'Architecture & Design',
    followers: '128.4K',
    er: '2.94%',
    cadence: '3.6 / wk',
    growth6m: '+8.4%',
    series: [
      { label: 'Jun', followers: 118400, er: 2.7 },
      { label: 'Jul', followers: 120100, er: 2.76 },
      { label: 'Aug', followers: 122300, er: 2.82 },
      { label: 'Sep', followers: 124600, er: 2.86 },
      { label: 'Oct', followers: 126500, er: 2.91 },
      { label: 'Nov', followers: 128400, er: 2.94 },
    ],
    mix: { reels: 25, carousels: 55, images: 20 },
  },
];

export function WorkspaceAnalyticsPreview({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const active = SHOWCASE_PROFILES[selectedIdx] ?? SHOWCASE_PROFILES[0]!;

  const minVal = Math.min(...active.series.map((s) => s.followers));
  const maxVal = Math.max(...active.series.map((s) => s.followers));
  const span = Math.max(1, maxVal - minVal);

  const coords = active.series.map((pt, i) => ({
    pt,
    x: 24 + (i / (active.series.length - 1)) * 312,
    y: 112 - ((pt.followers - minVal) / span) * 82,
  }));

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `24,124 ${polyline} ${coords[coords.length - 1]?.x ?? 336},124`;

  return (
    <section
      aria-labelledby="workspace-preview-heading"
      className="viewora-card-elevated mt-16 overflow-hidden rounded-3xl"
    >
      {/* Window Chrome */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-3.5 sm:px-6 dark:border-[#263047] dark:bg-[#0F172A]">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
          <span className="ml-2 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
            viewora.app / workspace / analytics-preview
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProvenanceBadge dataClass="demo" labels={dict.provenance} />
          <MembershipBadge planCode="premium" />
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-12">
        {/* Left Interactive Chart Workspace */}
        <div className="space-y-5 lg:col-span-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                Tier 2 · Professional Analytics Studio
              </p>
              <h2
                id="workspace-preview-heading"
                className="mt-1 font-display text-xl font-extrabold text-[#0F172A] sm:text-2xl dark:text-[#F8FAFC]"
              >
                Inspect growth trajectories, engagement depth &amp; publishing cadence
              </h2>
            </div>

            {/* Demo Profile Selector */}
            <div
              role="tablist"
              aria-label="Select labeled demo profile preview"
              className="flex flex-wrap gap-1.5"
            >
              {SHOWCASE_PROFILES.map((item, idx) => (
                <button
                  key={item.handle}
                  type="button"
                  role="tab"
                  aria-selected={selectedIdx === idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={`rounded-xl px-3 py-1.5 font-mono text-xs font-semibold transition ${
                    selectedIdx === idx
                      ? 'bg-[#7957FF] text-white shadow-xs'
                      : 'border border-slate-200 bg-slate-50 text-[#64748B] hover:border-[#7957FF]/50 hover:text-[#0F172A] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
                  }`}
                >
                  @{item.handle}
                </button>
              ))}
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-[#263047] dark:bg-[#0F172A]">
              <p className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">Followers</p>
              <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                {active.followers}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-emerald-600 dark:text-[#34D399]">
                {active.growth6m} (6m demo)
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-[#263047] dark:bg-[#0F172A]">
              <p className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">Est. ER</p>
              <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#6941EF] dark:text-[#A99AFF]">
                {active.er}
              </p>
              <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">Formula-based</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-[#263047] dark:bg-[#0F172A]">
              <p className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">Cadence</p>
              <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                {active.cadence}
              </p>
              <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">Public posts</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-[#263047] dark:bg-[#0F172A]">
              <p className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">Reels Share</p>
              <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0891B2] dark:text-[#22D3EE]">
                {active.mix.reels}%
              </p>
              <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {active.mix.carousels}% Carousel
              </p>
            </div>
          </div>

          {/* Interactive SVG Area Chart */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {active.displayName} — 6-Checkpoint Follower Trajectory (Demo Fixture)
              </span>
              <span className="font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {active.category}
              </span>
            </div>

            <svg
              viewBox="0 0 360 145"
              className="mt-3 h-40 w-full"
              role="img"
              aria-label={`Labeled demo follower trajectory chart for @${active.handle}`}
            >
              <defs>
                <linearGradient id="homePreviewArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7957FF" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="homePreviewStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7957FF" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
              </defs>
              {[32, 72, 112].map((y) => (
                <line
                  key={y}
                  x1="20"
                  y1={y}
                  x2="340"
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  strokeDasharray="3 3"
                />
              ))}
              <polygon points={area} fill="url(#homePreviewArea)" />
              <polyline
                fill="none"
                stroke="url(#homePreviewStroke)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polyline}
              />
              {coords.map((c) => (
                <g key={c.pt.label}>
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r="4"
                    fill="#7957FF"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <text x={c.x} y="139" textAnchor="middle" fontSize="9.5" fill="#94A3B8">
                    {c.pt.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Right Personal HQ & Workflow Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/90 via-white to-cyan-50/50 p-5 lg:col-span-4 dark:border-[#263047] dark:from-[#192337] dark:via-[#131C2E] dark:to-[#0F172A]">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-[#6941EF] shadow-2xs dark:bg-[#080D19] dark:text-[#22D3EE]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Personal Digital Headquarters
            </span>
            <div>
              <h3 className="font-display text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                Save research, organize folders &amp; export reports
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                Every metric card carries a clear provenance badge (Live, Cached, Estimate, Demo, or
                Unavailable). Organize saved profiles into research folders, keep private notes, and
                customize your workspace theme.
              </p>
            </div>
            <ul className="space-y-2 text-xs text-[#0F172A] dark:text-slate-200">
              <li className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 shrink-0 text-[#7957FF]" aria-hidden="true" />
                <span>Persistent folders, private notes &amp; comparisons</span>
              </li>
              <li className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5 shrink-0 text-[#22D3EE]" aria-hidden="true" />
                <span>Accessible charts with full tabular data view</span>
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#34D399]" aria-hidden="true" />
                <span>Press Ctrl+K / ⌘K anywhere for instant navigation</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 space-y-2.5">
            <Link
              href={`/${locale}/register`}
              className="viewora-btn-primary inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
            >
              Create Your Free Workspace
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link
              href={`/${locale}/pricing`}
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0F172A] transition hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#080D19] dark:text-[#F8FAFC]"
            >
              Compare All 5 Membership Tiers
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
