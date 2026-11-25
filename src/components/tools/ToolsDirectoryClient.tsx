'use client';

import Link from 'next/link';
import { ArrowRight, Calculator, Lock, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { getDictionary } from '@/i18n/get-dictionary';
import { FREE_TOOLS, type ToolDefinition } from '@/lib/tools/catalog';
import { EmptyState } from '@/components/ui/Primitives';

const CATEGORIES: Array<'All' | ToolDefinition['category']> = [
  'All',
  'Viewer',
  'Analytics',
  'Optimization',
  'Research',
  'Creation',
];

export function ToolsDirectoryClient({
  locale,
  dict: providedDict,
}: {
  locale: Locale;
  dict?: Dictionary;
}) {
  const dict = providedDict ?? getDictionary(locale);
  const t = dict.tools;
  const [category, setCategory] = useState<'All' | ToolDefinition['category']>('All');
  const [query, setQuery] = useState('');

  const categoryLabel = (cat: 'All' | ToolDefinition['category']) => {
    switch (cat) {
      case 'All':
        return t.categoryAll;
      case 'Viewer':
        return t.categoryViewer;
      case 'Analytics':
        return t.categoryAnalytics;
      case 'Optimization':
        return t.categoryOptimization;
      case 'Research':
        return t.categoryResearch;
      case 'Creation':
        return t.categoryCreation;
    }
  };

  const modeLabel = (mode: ToolDefinition['mode']) => {
    if (mode === 'functional_calculator') {
      return { text: t.modeCalculator, icon: Calculator };
    }
    if (mode === 'authorized_status_check') {
      return { text: t.modeStatusCheck, icon: Lock };
    }
    return { text: t.modeProvider, icon: Sparkles };
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FREE_TOOLS.filter((tool) => {
      if (category !== 'All' && tool.category !== category) return false;
      if (!q) return true;
      const localizedCat = categoryLabel(tool.category).toLowerCase();
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.shortDescription.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q) ||
        localizedCat.includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, query, locale]);

  return (
    <div className="space-y-6">
      {/* Search + Category Filter Bar */}
      <div className="viewora-card flex flex-col gap-3 rounded-2xl p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter tools by category">
          {CATEGORIES.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(cat)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-[#7957FF] text-white shadow-xs'
                    : 'bg-slate-100 text-[#64748B] hover:bg-slate-200 hover:text-[#0F172A] dark:bg-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-white'
                }`}
              >
                {categoryLabel(cat)}
              </button>
            );
          })}
        </div>

        <label className="relative block w-full lg:w-72">
          <span className="sr-only">{t.searchPlaceholder}</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-9 text-xs text-[#0F172A] placeholder:text-[#64748B] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#F8FAFC]"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyDesc}
          actionLabel={t.resetFilters}
          onAction={() => {
            setCategory('All');
            setQuery('');
          }}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tool) => {
            const badge = modeLabel(tool.mode);
            const BadgeIcon = badge.icon;
            return (
              <Link
                key={tool.slug}
                href={`/${locale}/${tool.slug}`}
                className="viewora-card group flex flex-col justify-between rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-[#7957FF]/60"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-md bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
                      {categoryLabel(tool.category)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-[#64748B] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]">
                      <BadgeIcon className="h-3 w-3" aria-hidden="true" />
                      {badge.text}
                    </span>
                  </div>
                  <h2 className="mt-3.5 font-display text-lg font-bold text-[#0F172A] group-hover:text-[#6941EF] dark:text-[#F8FAFC] dark:group-hover:text-[#A99AFF]">
                    {tool.name}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                    {tool.shortDescription}
                  </p>
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6941EF] dark:text-[#A99AFF]">
                  {t.openTool}
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
