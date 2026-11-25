'use client';

import { ChevronDown, ChevronUp, FileDown, FileText, Lock, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { Dictionary } from '@/i18n/types';
import type {
  ExportHistoryRecord,
  SavedAiReportRecord,
  SavedProfileRecord,
} from '@/lib/dashboard/store';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { EmptyState } from '@/components/ui/Primitives';

export function ReportsLibraryModule({
  dict,
  selectedEntry,
  reports,
  exportsHistory,
  canPdf,
  canCsv,
  onOpenAiStudio,
  onExportTriggered,
}: {
  dict: Dictionary;
  selectedEntry: SavedProfileRecord | null;
  reports: SavedAiReportRecord[];
  exportsHistory: ExportHistoryRecord[];
  canPdf: boolean;
  canCsv: boolean;
  onOpenAiStudio: () => void;
  onExportTriggered?: (format: 'pdf' | 'csv', username: string) => void;
}) {
  const [expandedReportId, setExpandedReportId] = useState<string | null>(reports[0]?.id ?? null);
  const [filterType, setFilterType] = useState<string>('all');

  const filteredReports =
    filterType === 'all'
      ? reports
      : reports.filter((r) => r.report.reportType === filterType);

  return (
    <div className="space-y-6">
      {/* Quick Export Panel */}
      <div className="viewora-card rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Generate Provenance-Stamped Exports
              {selectedEntry ? ` — @${selectedEntry.username}` : ''}
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Downloads are verified server-side against your entitlements and recorded in Export
              History below.
            </p>
          </div>
          {selectedEntry ? (
            <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
          ) : null}
        </div>

        {!selectedEntry ? (
          <div className="mt-4">
            <EmptyState
              title="No active profile selected for export"
              description="Save a profile or enable Demo Preview Mode to export PDF summaries and CSV datasets."
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-[#263047] dark:bg-[#0F172A]">
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                Viewora Branded PDF Report
              </h3>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Executive printable report stamped with source attribution and historical
                checkpoints.
              </p>
              {canPdf ? (
                <a
                  href={`/api/dashboard/export?format=pdf&username=${encodeURIComponent(selectedEntry.username)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => onExportTriggered?.('pdf', selectedEntry.username)}
                  className="viewora-btn-primary mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                  Open PDF Report
                </a>
              ) : (
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-[#FBBF24]">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Requires Premium+ Plan
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-[#263047] dark:bg-[#0F172A]">
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                Structured CSV Data Export
              </h3>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Spreadsheet-ready profile metrics and snapshot timeline with explicit data-class
                columns.
              </p>
              {canCsv ? (
                <a
                  href={`/api/dashboard/export?format=csv&username=${encodeURIComponent(selectedEntry.username)}`}
                  onClick={() => onExportTriggered?.('csv', selectedEntry.username)}
                  className="viewora-btn-primary mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                  Download CSV
                </a>
              ) : (
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-[#FBBF24]">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Requires Pro+ Plan
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Persistent AI Report Library */}
      <div className="viewora-card space-y-4 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Saved AI Report Library ({reports.length})
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reports.length > 0 ? (
              <select
                aria-label="Filter saved reports by type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
              >
                <option value="all">All report types</option>
                <option value="profile_performance">Profile Performance</option>
                <option value="growth_opportunity">Growth Opportunity</option>
                <option value="competitor_comparison">Competitor Comparison</option>
                <option value="influencer_evaluation">Influencer Evaluation</option>
                <option value="content_strategy">Content Strategy</option>
                <option value="social_media_audit">Social Media Audit</option>
                <option value="weekly_executive_summary">Weekly Executive Summary</option>
              </select>
            ) : null}
            <button
              type="button"
              onClick={onOpenAiStudio}
              className="inline-flex items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-[#6941EF] hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-[#A99AFF]"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              New AI Report
            </button>
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <EmptyState
            title="No saved AI reports in your library yet"
            description="Generate any of the 7 structured briefs in AI Intelligence Studio — each generated report is archived here automatically."
            actionLabel="Open AI Intelligence Studio"
            onAction={onOpenAiStudio}
          />
        ) : (
          <div className="space-y-3">
            {filteredReports.map((entry) => {
              const r = entry.report;
              const open = expandedReportId === entry.id;
              return (
                <article
                  key={entry.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpandedReportId(open ? null : entry.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-white">
                          @{r.username}
                        </span>
                        <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-[#6941EF] dark:bg-violet-950 dark:text-[#A99AFF]">
                          {r.reportType.replace(/_/g, ' ')}
                        </span>
                        <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-[10px] text-slate-700 dark:bg-[#192337] dark:text-slate-300">
                          {r.executionMode}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        Saved {new Date(entry.savedAt).toLocaleString()} · Model: {r.modelName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ProvenanceBadge dataClass={r.dataClass} labels={dict.provenance} />
                      {open ? (
                        <ChevronUp className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
                      )}
                    </div>
                  </button>

                  {open ? (
                    <div className="space-y-3 border-t border-slate-200 p-4 text-xs dark:border-[#263047]">
                      <p className="leading-relaxed text-[#0F172A] dark:text-slate-200">
                        {r.executiveSummary}
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="font-bold text-emerald-700 dark:text-[#34D399]">
                            Key Findings
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-4 text-[#64748B] dark:text-slate-300">
                            {r.keyFindings.map((k) => (
                              <li key={k}>{k}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-bold text-[#6941EF] dark:text-[#A99AFF]">
                            Recommendations
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-4 text-[#64748B] dark:text-slate-300">
                            {r.recommendations.map((rec) => (
                              <li key={rec}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Persistent Export History Table */}
      <div className="viewora-card space-y-4 rounded-2xl p-6">
        <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
          Export History ({exportsHistory.length})
        </h2>
        {exportsHistory.length === 0 ? (
          <EmptyState
            title="No exports recorded yet"
            description="When you open a PDF report or download a CSV file above, it will be logged here with timestamp and data-class provenance."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#263047]">
            <table className="w-full min-w-[500px] text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[#64748B] dark:border-[#263047] dark:bg-[#0F172A]">
                  <th className="px-4 py-2.5 font-semibold">Profile</th>
                  <th className="px-4 py-2.5 font-semibold">Format</th>
                  <th className="px-4 py-2.5 font-semibold">Provenance</th>
                  <th className="px-4 py-2.5 font-semibold">Exported At</th>
                  <th className="px-4 py-2.5 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#263047]">
                {exportsHistory.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5 font-mono font-bold text-[#0F172A] dark:text-white">
                      @{item.username}
                    </td>
                    <td className="px-4 py-2.5 uppercase font-semibold text-[#6941EF] dark:text-[#A99AFF]">
                      {item.format}
                    </td>
                    <td className="px-4 py-2.5">
                      <ProvenanceBadge dataClass={item.dataClass} labels={dict.provenance} />
                    </td>
                    <td className="px-4 py-2.5 text-[#64748B] dark:text-[#94A3B8]">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <a
                        href={`/api/dashboard/export?format=${item.format}&username=${encodeURIComponent(item.username)}`}
                        target={item.format === 'pdf' ? '_blank' : undefined}
                        rel={item.format === 'pdf' ? 'noreferrer' : undefined}
                        className="font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                      >
                        Download again
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
