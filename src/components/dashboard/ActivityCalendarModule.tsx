'use client';

import { Calendar as CalendarIcon, Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Dictionary } from '@/i18n/types';
import type { SavedProfileRecord } from '@/lib/dashboard/store';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { EmptyState } from '@/components/ui/Primitives';

export function ActivityCalendarModule({
  mode,
  dict,
  selectedEntry,
  onEnableDemoPreview,
}: {
  mode: 'timeline' | 'calendar';
  dict: Dictionary;
  selectedEntry: SavedProfileRecord | null;
  onEnableDemoPreview?: () => void;
}) {
  const months = useMemo(() => {
    if (!selectedEntry) return [];
    const set = new Set<string>();
    for (const post of selectedEntry.profile.recentPosts) {
      if (post.publishedAt.length >= 7) {
        set.add(post.publishedAt.slice(0, 7));
      }
    }
    return Array.from(set).sort().reverse();
  }, [selectedEntry]);

  const [selectedMonth, setSelectedMonth] = useState<string>(months[0] ?? '2026-11');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  if (!selectedEntry) {
    return (
      <div className="viewora-card rounded-2xl p-6">
        <EmptyState
          title={
            mode === 'timeline'
              ? 'No snapshot timeline checkpoints yet'
              : 'No publishing calendar posts yet'
          }
          description={
            onEnableDemoPreview
              ? 'Save an eligible profile in Saved Profiles or turn on explicit Demo Preview Mode to explore longitudinal checkpoints and publishing cadence.'
              : 'Save an eligible public profile in Saved Profiles to record longitudinal checkpoints and publishing cadence.'
          }
          actionLabel={onEnableDemoPreview ? 'Enable Demo Preview Mode' : undefined}
          onAction={onEnableDemoPreview}
        />
      </div>
    );
  }

  const activeMonth = months.includes(selectedMonth) ? selectedMonth : months[0] ?? '2026-11';
  const [yearNum, monthNum] = activeMonth.split('-').map((n) => Number(n));
  const daysInMonth =
    yearNum && monthNum ? new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate() : 30;
  const firstWeekday =
    yearNum && monthNum ? new Date(Date.UTC(yearNum, monthNum - 1, 1)).getUTCDay() : 0;
  const monthLabel =
    yearNum && monthNum
      ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
          new Date(Date.UTC(yearNum, monthNum - 1, 1))
        )
      : activeMonth;

  if (mode === 'timeline') {
    const trend = selectedEntry.profile.historicalTrend;
    if (trend.length === 0) {
      return (
        <div className="viewora-card rounded-2xl p-6">
          <EmptyState
            title={`No recorded checkpoints for @${selectedEntry.username}`}
            description="Checkpoints are recorded whenever authorized snapshots are refreshed."
          />
        </div>
      );
    }

    const chronological = trend.map((pt, idx) => {
      const prev = idx > 0 ? trend[idx - 1] : null;
      return {
        ...pt,
        followerDelta: prev ? pt.followers - prev.followers : null,
        erDelta: prev ? Number((pt.engagementRate - prev.engagementRate).toFixed(2)) : null,
      };
    });

    return (
      <div className="viewora-card space-y-5 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Activity &amp; Snapshot Timeline — @{selectedEntry.username}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Source: {selectedEntry.providerLabel} · Distinguishing observed snapshot dates and
              interval changes.
            </p>
          </div>
          <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
        </div>

        <ol className="space-y-3 border-l-2 border-[#7957FF]/30 pl-4">
          {chronological
            .slice()
            .reverse()
            .map((pt) => (
              <li
                key={pt.date}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-bold text-[#0F172A] dark:text-white">
                    Observed {pt.date}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 tabular-nums">
                    <span className="font-bold text-[#0F172A] dark:text-white">
                      {pt.followers.toLocaleString()} followers
                    </span>
                    {pt.followerDelta !== null ? (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          pt.followerDelta >= 0
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-[#34D399]'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-[#F87171]'
                        }`}
                      >
                        {pt.followerDelta >= 0 ? (
                          <TrendingUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="h-3 w-3" aria-hidden="true" />
                        )}
                        {pt.followerDelta >= 0 ? '+' : ''}
                        {pt.followerDelta.toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1.5 text-[#64748B] dark:text-[#94A3B8]">
                  {pt.posts.toLocaleString()} total public posts ·{' '}
                  <strong className="text-[#6941EF] dark:text-[#A99AFF]">
                    {pt.engagementRate}%
                  </strong>{' '}
                  est. ER
                  {pt.erDelta !== null
                    ? ` (${pt.erDelta >= 0 ? '+' : ''}${pt.erDelta} pts vs prior checkpoint)`
                    : ' (baseline checkpoint)'}
                </p>
              </li>
            ))}
        </ol>
      </div>
    );
  }

  // Calendar Mode
  const postsInMonth = selectedEntry.profile.recentPosts.filter((p) =>
    p.publishedAt.startsWith(activeMonth)
  );
  const selectedDayPosts =
    selectedDay !== null
      ? postsInMonth.filter((p) =>
          p.publishedAt.startsWith(`${activeMonth}-${String(selectedDay).padStart(2, '0')}`)
        )
      : [];

  return (
    <div className="viewora-card space-y-5 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon
              className="h-4 w-4 text-[#6941EF] dark:text-[#A99AFF]"
              aria-hidden="true"
            />
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Publishing Calendar — {monthLabel}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
            @{selectedEntry.username} · {postsInMonth.length} sampled post
            {postsInMonth.length === 1 ? '' : 's'} in {monthLabel}. Select any highlighted day to
            inspect post metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {months.length > 1 ? (
            <select
              aria-label="Select calendar month"
              value={activeMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedDay(null);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : null}
          <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[460px] grid-cols-7 gap-2 text-center text-xs">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="pb-1 font-bold text-[#64748B] dark:text-[#94A3B8]">
              {d}
            </div>
          ))}
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`pad-${i}`} aria-hidden="true" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateStr = `${activeMonth}-${String(day).padStart(2, '0')}`;
            const dayPosts = postsInMonth.filter((p) => p.publishedAt.startsWith(dateStr));
            const hasPost = dayPosts.length > 0;
            const isSelected = selectedDay === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(hasPost ? day : null)}
                disabled={!hasPost}
                className={`min-h-16 rounded-xl border p-2 text-left transition ${
                  isSelected
                    ? 'border-[#22D3EE] bg-cyan-50/70 ring-2 ring-[#22D3EE]/30 dark:bg-cyan-950/40'
                    : hasPost
                      ? 'cursor-pointer border-[#7957FF] bg-violet-50/70 hover:bg-violet-100/70 dark:bg-violet-950/40'
                      : 'cursor-default border-slate-200 bg-slate-50/70 opacity-75 dark:border-[#263047] dark:bg-[#0F172A]'
                }`}
              >
                <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                  {day}
                </span>
                {dayPosts.slice(0, 2).map((p) => (
                  <span
                    key={p.id}
                    className="mt-1 block truncate rounded bg-[#7957FF] px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase"
                  >
                    {p.mediaType}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDayPosts.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
          <p className="text-xs font-bold text-[#6941EF] dark:text-[#A99AFF]">
            Published on {activeMonth}-{String(selectedDay).padStart(2, '0')}
          </p>
          {selectedDayPosts.map((post) => (
            <div key={post.id} className="text-xs text-[#0F172A] dark:text-slate-200">
              <p className="font-semibold uppercase">{post.mediaType}</p>
              <p className="mt-1 text-[#64748B] dark:text-[#94A3B8]">{post.captionExcerpt}</p>
              <p className="mt-1.5 font-mono text-[11px] tabular-nums">
                {post.likes.toLocaleString()} likes · {post.comments.toLocaleString()} comments
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
