'use client';

import { Check, Copy, FileDown, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { AiReportOutput, AiReportType } from '@/lib/ai/gemini';
import type { SavedAiReportRecord } from '@/lib/dashboard/store';
import type { DashboardSavedProfile } from './CustomerDashboard';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { EmptyState, ErrorState, UpgradePreviewCard } from '@/components/ui/Primitives';

const REPORT_TYPES: Array<{ id: AiReportType; label: string; layoutTag: string; desc: string }> = [
  { id: 'profile_performance', label: 'Profile Performance Report', layoutTag: 'Benchmark', desc: 'Overall health, cadence & interaction depth' },
  { id: 'growth_opportunity', label: 'Growth Opportunity Report', layoutTag: 'Growth', desc: 'Audience velocity & format expansion levers' },
  { id: 'competitor_comparison', label: 'Competitor Comparison Report', layoutTag: 'Competitor', desc: 'Positioning gaps vs. niche peers' },
  { id: 'influencer_evaluation', label: 'Influencer Evaluation Report', layoutTag: 'Research', desc: 'Tier quality, consistency & estimated reach' },
  { id: 'content_strategy', label: 'Content Strategy Report', layoutTag: 'Engagement', desc: 'Reels vs. Carousel publishing roadmap' },
  { id: 'social_media_audit', label: 'Social Media Audit', layoutTag: 'Audit', desc: 'Bio, CTA, cadence & profile readiness' },
  { id: 'weekly_executive_summary', label: 'Weekly Executive Summary', layoutTag: 'Executive', desc: 'Concise leadership brief for teams/clients' },
];

export function AiIntelligenceStudio({
  locale,
  dict,
  profiles,
  canGenerateAi,
  canPdf,
  canCsv,
  onReportSaved,
  onEnableDemoPreview,
}: {
  locale: Locale;
  dict: Dictionary;
  profiles: DashboardSavedProfile[];
  canGenerateAi: boolean;
  canPdf: boolean;
  canCsv: boolean;
  onReportSaved?: (entry: SavedAiReportRecord) => void;
  onEnableDemoPreview?: () => void;
}) {
  const [reportType, setReportType] = useState<AiReportType>('profile_performance');
  const [selectedUsername, setSelectedUsername] = useState<string>(
    profiles[0]?.profile.username ?? ''
  );
  const [dateRange, setDateRange] = useState<'30d' | '90d' | '180d'>('90d');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AiReportOutput | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  const copyMarkdownBrief = async (r: AiReportOutput) => {
    const md = [
      `# ${REPORT_TYPES.find((t) => t.id === r.reportType)?.label ?? r.reportType} — @${r.username}`,
      `- **Execution Mode:** ${r.executionMode} (${r.modelName})`,
      `- **Data Provenance:** ${r.dataClass} (${r.sourceLabel})`,
      `- **Generated:** ${r.generatedAt}`,
      '',
      '## Executive Summary',
      r.executiveSummary,
      '',
      '## Key Findings',
      ...r.keyFindings.map((f) => `- ${f}`),
      '',
      '## Actionable Recommendations',
      ...r.recommendations.map((rec) => `- ${rec}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(md);
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 2200);
    } catch {
      // clipboard unavailable
    }
  };

  if (!canGenerateAi) {
    return (
      <UpgradePreviewCard
        title="Unlock the AI Intelligence Studio"
        description="Generate 7 structured Gemini AI report types (Profile Performance, Growth Opportunity, Competitor Comparison, Influencer Evaluation, Content Strategy, Audit & Weekly Executive Summary) with strict provenance citations."
        requiredTier="Starter+ Plan (3–150 reports/mo)"
        ctaHref={`/${locale}/pricing`}
      />
    );
  }

  if (profiles.length === 0) {
    return (
      <EmptyState
        title="No profiles available for AI Intelligence Studio"
        description="Save an eligible public profile in Saved Profiles or turn on explicit Demo Preview Mode to generate structured briefs."
        actionLabel={onEnableDemoPreview ? 'Enable Demo Preview Mode' : undefined}
        onAction={onEnableDemoPreview}
      />
    );
  }

  const resolvedUsername =
    profiles.some((p) => p.profile.username === selectedUsername)
      ? selectedUsername
      : profiles[0]!.profile.username;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resolvedUsername, reportType, dateRange }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        report?: AiReportOutput;
        savedReport?: SavedAiReportRecord;
      };
      if (!res.ok || !json.ok || !json.report) {
        setError(json.error ?? 'Could not generate AI report.');
        return;
      }
      setReport(json.report);
      if (json.savedReport) {
        onReportSaved?.(json.savedReport);
      }
    } catch {
      setError('Network error while requesting the AI report.');
    } finally {
      setGenerating(false);
    }
  };

  const activeProfile = profiles.find((p) => p.profile.username === resolvedUsername);

  return (
    <div className="space-y-6">
      {/* Step 1: Visual Report Template Library */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
              Step 1 · Choose Report Template (7 Structured Layouts)
            </p>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Deterministic templates run locally with explicit provenance badges when external AI APIs are inactive.
            </p>
          </div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {REPORT_TYPES.map((rt) => {
            const active = reportType === rt.id;
            return (
              <button
                key={rt.id}
                type="button"
                aria-pressed={active}
                onClick={() => setReportType(rt.id)}
                className={`rounded-2xl border p-3.5 text-left transition ${
                  active
                    ? 'border-[#7957FF] bg-violet-50/70 ring-1 ring-[#7957FF] dark:border-[#A99AFF] dark:bg-[#192337]'
                    : 'border-slate-200 bg-white hover:border-[#7957FF]/40 dark:border-[#263047] dark:bg-[#0F172A]'
                }`}
              >
                <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#64748B] uppercase dark:bg-[#131C2E] dark:text-[#94A3B8]">
                  {rt.layoutTag}
                </span>
                <span className="mt-2 block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  {rt.label}
                </span>
                <span className="mt-0.5 block text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  {rt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Studio Configuration Panel */}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 md:grid-cols-3 dark:border-[#263047] dark:bg-[#0F172A]">
        <label className="block">
          <span className="block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            1. Report Type
          </span>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as AiReportType)}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#F8FAFC]"
          >
            {REPORT_TYPES.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            2. Eligible Profile
          </span>
          <select
            value={resolvedUsername}
            onChange={(e) => setSelectedUsername(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs font-medium text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#F8FAFC]"
          >
            {profiles.map((p) => (
              <option key={p.profile.username} value={p.profile.username}>
                @{p.profile.username} ({p.dataClass})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            3. Lookback Window
          </span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#F8FAFC]"
          >
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="180d">Last 180 days</option>
          </select>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 md:col-span-3 dark:border-[#263047]">
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Input payload:{' '}
            <strong className="text-[#0F172A] dark:text-[#F8FAFC]">
              @{resolvedUsername}
            </strong>{' '}
            · {activeProfile?.profile.historicalTrend.length ?? 0} checkpoints ·{' '}
            {activeProfile?.dataClass ?? 'demo'} source.
          </p>
          <button
            type="button"
            disabled={generating}
            onClick={() => void handleGenerate()}
            className="viewora-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-sm disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {generating ? 'Processing structured report…' : 'Generate Intelligence Report'}
          </button>
        </div>
      </div>

      {error ? <ErrorState title="Report generation error" description={error} onRetry={handleGenerate} /> : null}

      {/* Structured Report Viewer */}
      {report ? (
        <div className="viewora-card animate-viewora-enter space-y-5 rounded-2xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-[#263047]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                  {REPORT_TYPES.find((r) => r.id === report.reportType)?.label}
                </h3>
                <span className="rounded-full bg-violet-100 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#6941EF] dark:bg-violet-950 dark:text-[#A99AFF]">
                  {report.executionMode}
                </span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                @{report.username} · Model: {report.modelName} · Prompt: {report.promptVersion} ·{' '}
                {new Date(report.generatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ProvenanceBadge dataClass={report.dataClass} labels={dict.provenance} />
              <button
                type="button"
                onClick={() => void copyMarkdownBrief(report)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#192337] dark:text-slate-200"
              >
                {copiedReport ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    Copy Brief
                  </>
                )}
              </button>
              {canPdf ? (
                <a
                  href={`/api/dashboard/export?format=pdf&username=${encodeURIComponent(report.username)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#192337] dark:text-slate-200"
                >
                  <FileDown className="h-3 w-3" aria-hidden="true" />
                  PDF
                </a>
              ) : null}
              {canCsv ? (
                <a
                  href={`/api/dashboard/export?format=csv&username=${encodeURIComponent(report.username)}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#192337] dark:text-slate-200"
                >
                  <FileDown className="h-3 w-3" aria-hidden="true" />
                  CSV
                </a>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 text-sm leading-relaxed text-[#0F172A] dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-slate-100">
            <strong className="block text-xs tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
              Executive Summary
            </strong>
            <p className="mt-1">{report.executiveSummary}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-[#263047]">
              <h4 className="text-xs font-bold tracking-wider text-emerald-700 uppercase dark:text-[#34D399]">
                Key Findings
              </h4>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-[#64748B] dark:text-slate-300">
                {report.keyFindings.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-[#263047]">
              <h4 className="text-xs font-bold tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
                Actionable Recommendations
              </h4>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-[#64748B] dark:text-slate-300">
                {report.recommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-[#64748B] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]">
            <strong className="text-[#0F172A] dark:text-[#F8FAFC]">Data Limitations &amp; Source:</strong>{' '}
            {report.sourceLabel}
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              {report.dataLimitations.map((lim) => (
                <li key={lim}>{lim}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
