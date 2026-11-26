'use client';

import { AlertTriangle, ArrowUpDown, Download, FileText, GitCompare, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type {
  ComparisonProjectRecord,
  SavedProfileRecord,
  UserWorkspaceState,
} from '@/lib/dashboard/store';
import {
  buildCompatibleCompetitorBenchmark,
  type BenchmarkDateRange,
} from '@/lib/analytics/competitor-benchmark';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { EmptyState, UpgradePreviewCard } from '@/components/ui/Primitives';
import { ConfirmDialog, StatusBanner } from '@/components/layout/PageShell';

import { sanitizeCsvFormulaCell } from '@/lib/reports/export';

type SortField = 'followers' | 'er' | 'delta' | 'cadence';

function escapeCsvCell(value: string | number | null | undefined): string {
  return sanitizeCsvFormulaCell(value);
}

export function CompetitorStudio({
  locale,
  dict,
  canCompetitors,
  workspace,
  activeProfiles,
  isDemoPreview,
  demoPreviewAvailable = false,
  onWorkspaceChange,
}: {
  locale: Locale;
  dict: Dictionary;
  canCompetitors: boolean;
  workspace: UserWorkspaceState;
  activeProfiles: SavedProfileRecord[];
  isDemoPreview: boolean;
  demoPreviewAvailable?: boolean;
  onWorkspaceChange: (next: UserWorkspaceState) => void;
}) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedHandles, setSelectedHandles] = useState<string[]>(
    activeProfiles.slice(0, 2).map((p) => p.username)
  );
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    workspace.comparisons[0]?.id ?? null
  );
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editHandles, setEditHandles] = useState<string[]>([]);

  const [sortField, setSortField] = useState<SortField>('er');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [dateRange, setDateRange] = useState<BenchmarkDateRange>('all');
  const [visibleCols, setVisibleCols] = useState({
    followers: true,
    er: true,
    delta: true,
    cadence: true,
    growth: true,
    completeness: true,
  });

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<ComparisonProjectRecord | null>(null);

  const activeProject = workspace.comparisons.find((c) => c.id === activeProjectId) ?? null;

  const baseRows = useMemo(
    () =>
      activeProject
        ? activeProfiles.filter((p) =>
            activeProject.usernames.includes(p.username.toLowerCase())
          )
        : activeProfiles,
    [activeProject, activeProfiles]
  );

  const benchmark = useMemo(
    () => buildCompatibleCompetitorBenchmark(baseRows, dateRange),
    [baseRows, dateRange]
  );

  const avgEr = benchmark.comparableAvgEr ?? 0;

  const rowsToCompare = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...benchmark.rows].sort((a, b) => {
      if (sortField === 'followers') {
        return ((a.followersCount ?? -1) - (b.followersCount ?? -1)) * dir;
      }
      if (sortField === 'cadence') {
        return ((a.postingCadencePerWeek ?? -1) - (b.postingCadencePerWeek ?? -1)) * dir;
      }
      const erA = a.estimatedEngagementRate ?? -1;
      const erB = b.estimatedEngagementRate ?? -1;
      return (erA - erB) * dir;
    });
  }, [benchmark.rows, sortField, sortDir]);

  const generateCompetitorReport = async () => {
    if (rowsToCompare.length < 2) return;
    setBusy(true);
    setBanner(null);
    try {
      const reportTitle = activeProject
        ? `Competitor Benchmark: ${activeProject.name}`
        : `Competitor Benchmark (${rowsToCompare.length} Profiles)`;
      const res = await fetch('/api/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create',
          reportType: 'competitor_analysis',
          title: reportTitle,
          description: `${benchmark.methodologyNote} Window: ${dateRange.toUpperCase()}.`,
          usernames: rowsToCompare.map((r) => r.username),
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setBanner({ tone: 'error', message: json?.error ?? 'Could not create competitor report.' });
        return;
      }
      setBanner({
        tone: 'success',
        message: `Created "${reportTitle}" in Report Studio — open Report Builder to preview or export PDF/CSV.`,
      });
    } catch {
      setBanner({ tone: 'error', message: 'Network error while generating competitor report.' });
    } finally {
      setBusy(false);
    }
  };

  if (!canCompetitors) {
    return (
      <UpgradePreviewCard
        title="Persistent Multi-Profile Competitor Comparison Projects"
        description="Save comparison projects, inspect side-by-side engagement deltas, follower ratios, and weekly publishing cadence across saved public profiles."
        requiredTier="Premium+ Plan"
        ctaHref={`/${locale}/pricing`}
      />
    );
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const toggleHandle = (username: string) => {
    setSelectedHandles((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  const toggleEditHandle = (username: string) => {
    setEditHandles((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  const startEditingProject = (proj: ComparisonProjectRecord) => {
    setEditingProjectId(proj.id);
    setEditName(proj.name);
    setEditNotes(proj.notes);
    setEditHandles([...proj.usernames]);
  };

  const createProject = async () => {
    setBanner(null);
    if (name.trim().length < 2) {
      setBanner({ tone: 'error', message: 'Enter a comparison project name (at least 2 chars).' });
      return;
    }
    if (selectedHandles.length < 2) {
      setBanner({ tone: 'error', message: 'Select at least 2 profiles to compare.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create_comparison',
          name: name.trim(),
          usernames: selectedHandles,
          notes: notes.trim(),
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        workspace?: UserWorkspaceState;
        comparison?: ComparisonProjectRecord;
      } | null;
      if (!res.ok || !json?.ok || !json.workspace) {
        setBanner({ tone: 'error', message: json?.error ?? 'Could not save comparison project.' });
        return;
      }
      onWorkspaceChange(json.workspace);
      if (json.comparison) setActiveProjectId(json.comparison.id);
      setName('');
      setNotes('');
      setBanner({ tone: 'success', message: 'Comparison project saved to your workspace.' });
    } catch {
      setBanner({ tone: 'error', message: 'Network error while saving comparison project.' });
    } finally {
      setBusy(false);
    }
  };

  const saveEditedProject = async () => {
    if (!editingProjectId) return;
    setBanner(null);
    if (editName.trim().length < 2) {
      setBanner({ tone: 'error', message: 'Project name must be at least 2 characters.' });
      return;
    }
    if (editHandles.length < 2) {
      setBanner({ tone: 'error', message: 'Select at least 2 profiles for the comparison project.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'update_comparison',
          id: editingProjectId,
          name: editName.trim(),
          notes: editNotes.trim(),
          usernames: editHandles,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        workspace?: UserWorkspaceState;
      } | null;
      if (!res.ok || !json?.ok || !json.workspace) {
        setBanner({ tone: 'error', message: json?.error ?? 'Could not update comparison project.' });
        return;
      }
      onWorkspaceChange(json.workspace);
      setEditingProjectId(null);
      setBanner({ tone: 'success', message: 'Comparison project updated.' });
    } catch {
      setBanner({ tone: 'error', message: 'Network error while updating comparison project.' });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'delete_comparison', id: deleteTarget.id }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        workspace?: UserWorkspaceState;
      } | null;
      if (!res.ok || !json?.ok || !json.workspace) {
        setBanner({ tone: 'error', message: json?.error ?? 'Could not delete comparison project.' });
        return;
      }
      onWorkspaceChange(json.workspace);
      if (activeProjectId === deleteTarget.id) {
        setActiveProjectId(json.workspace.comparisons[0]?.id ?? null);
      }
      if (editingProjectId === deleteTarget.id) {
        setEditingProjectId(null);
      }
      setBanner({ tone: 'success', message: `Deleted comparison project "${deleteTarget.name}".` });
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  const downloadComparisonCsv = () => {
    const header = [
      'Project',
      'Date Window',
      'Username',
      'Display Name',
      'Followers',
      'Estimated ER (%)',
      'Delta vs Comparable Avg (pts)',
      'Posts per Week',
      'Follower Growth Delta',
      'Completeness (%)',
      'Data Provenance',
      'Provider',
      'Captured At',
      'Exported At',
    ];
    const exportedAt = new Date().toISOString();
    const projectLabel = activeProject?.name ?? 'All Active Profiles';
    const lines = [
      header.map(escapeCsvCell).join(','),
      ...rowsToCompare.map((item) =>
        [
          projectLabel,
          dateRange,
          `@${item.username}`,
          item.displayName,
          item.followersCount ?? 'Unavailable',
          item.estimatedEngagementRate ?? 'Unavailable',
          item.deltaErVsComparableAvg ?? 'Unavailable',
          item.postingCadencePerWeek ?? 'Unavailable',
          item.followerGrowthDelta ?? 'Unavailable',
          item.completenessPercent,
          item.dataClass,
          item.providerLabel,
          item.capturedAt,
          exportedAt,
        ]
          .map(escapeCsvCell)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viewora-comparison-${projectLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="viewora-card space-y-5 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Competitor Comparison Projects ({workspace.comparisons.length})
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Compatibility-checked side-by-side benchmarking across saved profiles. Missing fields stay explicitly unavailable and are excluded from averages.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {rowsToCompare.length >= 2 ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void generateCompetitorReport()}
                  className="inline-flex items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-[#6941EF] hover:bg-violet-100 disabled:opacity-60 dark:border-[#263047] dark:bg-violet-950/50 dark:text-[#A99AFF]"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  Generate Competitor Report
                </button>
                <button
                  type="button"
                  onClick={downloadComparisonCsv}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A] dark:text-slate-200"
                >
                  <Download className="h-3.5 w-3.5 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
                  Export Matrix CSV
                </button>
              </>
            ) : null}
            <ProvenanceBadge
              dataClass={isDemoPreview ? 'demo' : rowsToCompare[0]?.dataClass ?? 'unavailable'}
              labels={dict.provenance}
            />
          </div>
        </div>

        {banner ? (
          <StatusBanner
            tone={banner.tone}
            message={banner.message}
            onDismiss={() => setBanner(null)}
          />
        ) : null}

        {activeProfiles.length < 2 ? (
          <EmptyState
            title="Save at least 2 profiles to run side-by-side comparisons"
            description={
              demoPreviewAvailable
                ? 'Add two or more eligible public profiles in Saved Profiles (or enable Demo Preview Mode) to build persistent comparison projects.'
                : 'Add two or more eligible public profiles in Saved Profiles to build persistent comparison projects.'
            }
          />
        ) : (
          <>
            {/* Compatibility Warnings Banner (Stage 45) */}
            {benchmark.compatibilityWarnings.length > 0 ? (
              <div
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  Data Compatibility Notice
                </div>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[11px]">
                  {benchmark.compatibilityWarnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Saved Comparison Tabs + Date Range & Column Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {workspace.comparisons.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveProjectId(null);
                      setEditingProjectId(null);
                    }}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                      activeProjectId === null
                        ? 'bg-[#7957FF] text-white'
                        : 'bg-slate-100 text-[#64748B] dark:bg-[#0F172A] dark:text-[#94A3B8]'
                    }`}
                  >
                    All Active Profiles ({activeProfiles.length})
                  </button>
                  {workspace.comparisons.map((proj) => (
                    <span key={proj.id} className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveProjectId(proj.id);
                          setEditingProjectId(null);
                        }}
                        className={`rounded-l-xl px-3 py-1.5 text-xs font-semibold ${
                          activeProjectId === proj.id
                            ? 'bg-[#7957FF] text-white'
                            : 'bg-slate-100 text-[#64748B] dark:bg-[#0F172A] dark:text-[#94A3B8]'
                        }`}
                      >
                        {proj.name} ({proj.usernames.length})
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit project ${proj.name}`}
                        onClick={() => {
                          setActiveProjectId(proj.id);
                          startEditingProject(proj);
                        }}
                        className="bg-slate-100 px-1.5 py-1.5 text-xs text-slate-400 hover:text-[#6941EF] dark:bg-[#0F172A]"
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete project ${proj.name}`}
                        onClick={() => setDeleteTarget(proj)}
                        className="rounded-r-xl bg-slate-100 px-2 py-1.5 text-xs text-slate-400 hover:text-rose-500 dark:bg-[#0F172A]"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold dark:border-[#263047] dark:bg-[#0F172A]">
                  {(['30d', '90d', 'all'] as const).map((win) => (
                    <button
                      key={win}
                      type="button"
                      onClick={() => setDateRange(win)}
                      className={`rounded-lg px-2.5 py-1 uppercase transition ${
                        dateRange === win
                          ? 'bg-[#7957FF] text-white'
                          : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]'
                      }`}
                    >
                      {win}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Metric Column Selector */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">Columns:</span>
              {(
                [
                  ['followers', 'Followers'],
                  ['er', 'Est. ER'],
                  ['delta', 'Delta vs Avg'],
                  ['cadence', 'Posts / wk'],
                  ['growth', 'Observed Growth'],
                  ['completeness', 'Completeness'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={visibleCols[key]}
                  onClick={() =>
                    setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  className={`rounded-full px-2.5 py-0.5 font-semibold transition ${
                    visibleCols[key]
                      ? 'bg-violet-100 text-[#6941EF] dark:bg-violet-950/70 dark:text-[#A99AFF]'
                      : 'bg-slate-100 text-[#64748B] dark:bg-[#0F172A] dark:text-[#94A3B8]'
                  }`}
                >
                  {visibleCols[key] ? '✓ ' : '+ '}
                  {label}
                </button>
              ))}
            </div>

            {/* Inline Edit Active Comparison Project */}
            {editingProjectId ? (
              <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 dark:border-[#263047] dark:bg-[#192337]/60">
                <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Edit Comparison Project
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    aria-label="Edit project name"
                    className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                  />
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    aria-label="Edit project notes"
                    placeholder="Benchmarking goal or notes"
                    className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeProfiles.map((p) => {
                    const picked = editHandles.includes(p.username.toLowerCase());
                    return (
                      <button
                        key={p.username}
                        type="button"
                        aria-pressed={picked}
                        onClick={() => toggleEditHandle(p.username.toLowerCase())}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs font-semibold transition ${
                          picked
                            ? 'bg-[#7957FF] text-white'
                            : 'border border-slate-200 bg-white text-[#64748B] dark:border-[#263047] dark:bg-[#0F172A] dark:text-slate-300'
                        }`}
                      >
                        {picked ? '✓ ' : '+ '}@{p.username}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveEditedProject()}
                    className="viewora-btn-primary rounded-xl px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
                  >
                    {busy ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProjectId(null)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#64748B] dark:border-[#263047]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {/* Sortable Compatibility-Checked Comparison Matrix Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-[#263047]">
              <table className="w-full min-w-[660px] text-left text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[#64748B] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]">
                    <th className="px-4 py-3 font-semibold">Profile</th>
                    {visibleCols.followers ? (
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleSort('followers')}
                          className="inline-flex items-center gap-1 hover:text-[#6941EF] dark:hover:text-[#A99AFF]"
                        >
                          Followers
                          <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </th>
                    ) : null}
                    {visibleCols.er ? (
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleSort('er')}
                          className="inline-flex items-center gap-1 hover:text-[#6941EF] dark:hover:text-[#A99AFF]"
                        >
                          Est. ER
                          <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </th>
                    ) : null}
                    {visibleCols.delta ? (
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleSort('delta')}
                          className="inline-flex items-center gap-1 hover:text-[#6941EF] dark:hover:text-[#A99AFF]"
                        >
                          Delta vs Avg ({benchmark.comparableAvgEr !== null ? `${avgEr}%` : 'N/A'})
                          <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </th>
                    ) : null}
                    {visibleCols.cadence ? (
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleSort('cadence')}
                          className="inline-flex items-center gap-1 hover:text-[#6941EF] dark:hover:text-[#A99AFF]"
                        >
                          Posts / wk
                          <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </th>
                    ) : null}
                    {visibleCols.growth ? (
                      <th className="px-4 py-3 font-semibold">Observed Growth</th>
                    ) : null}
                    {visibleCols.completeness ? (
                      <th className="px-4 py-3 font-semibold">Completeness</th>
                    ) : null}
                    <th className="px-4 py-3 font-semibold">Source &amp; Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#263047]">
                  {rowsToCompare.map((item) => (
                    <tr key={item.username}>
                      <td className="px-4 py-3">
                        <span className="block font-mono font-bold text-[#0F172A] dark:text-white">
                          @{item.username}
                        </span>
                        <span className="text-[11px] text-[#64748B]">{item.displayName}</span>
                      </td>
                      {visibleCols.followers ? (
                        <td className="px-4 py-3 font-semibold text-[#0F172A] dark:text-slate-200">
                          {item.followersCount !== null ? (
                            item.followersCount.toLocaleString()
                          ) : (
                            <span className="font-normal text-[#64748B]">Unavailable</span>
                          )}
                        </td>
                      ) : null}
                      {visibleCols.er ? (
                        <td className="px-4 py-3 font-bold text-[#6941EF] dark:text-[#A99AFF]">
                          {item.estimatedEngagementRate !== null ? (
                            `${item.estimatedEngagementRate}%`
                          ) : (
                            <span className="font-normal text-[#64748B]">Unavailable</span>
                          )}
                        </td>
                      ) : null}
                      {visibleCols.delta ? (
                        <td className="px-4 py-3 font-bold">
                          {item.deltaErVsComparableAvg !== null ? (
                            <span
                              className={
                                item.deltaErVsComparableAvg >= 0
                                  ? 'text-emerald-600 dark:text-[#34D399]'
                                  : 'text-rose-600 dark:text-[#F87171]'
                              }
                            >
                              {item.deltaErVsComparableAvg >= 0 ? '+' : ''}
                              {item.deltaErVsComparableAvg} pts
                            </span>
                          ) : (
                            <span className="font-normal text-[#64748B]">Unavailable</span>
                          )}
                        </td>
                      ) : null}
                      {visibleCols.cadence ? (
                        <td className="px-4 py-3 text-[#0F172A] dark:text-slate-200">
                          {item.postingCadencePerWeek !== null ? (
                            item.postingCadencePerWeek
                          ) : (
                            <span className="text-[#64748B]">Unavailable</span>
                          )}
                        </td>
                      ) : null}
                      {visibleCols.growth ? (
                        <td className="px-4 py-3">
                          {item.followerGrowthDelta !== null ? (
                            <span
                              className={`font-semibold ${
                                item.followerGrowthDelta >= 0
                                  ? 'text-emerald-600 dark:text-[#34D399]'
                                  : 'text-rose-600 dark:text-[#F87171]'
                              }`}
                            >
                              {item.followerGrowthDelta >= 0 ? '+' : ''}
                              {item.followerGrowthDelta.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[#64748B]">Insufficient history</span>
                          )}
                        </td>
                      ) : null}
                      {visibleCols.completeness ? (
                        <td className="px-4 py-3 font-mono text-[11px] font-semibold text-[#0F172A] dark:text-slate-200">
                          {item.completenessPercent}%
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <ProvenanceBadge dataClass={item.dataClass} labels={dict.provenance} />
                        <span className="mt-0.5 block font-mono text-[10px] text-[#64748B]">
                          {new Date(item.capturedAt).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              <strong className="text-[#0F172A] dark:text-white">Methodology:</strong>{' '}
              {benchmark.methodologyNote}
            </p>

            {activeProject?.notes && editingProjectId !== activeProject.id ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-[#64748B] dark:border-[#263047] dark:bg-[#0F172A] dark:text-slate-300">
                <strong className="text-[#0F172A] dark:text-white">Project Notes:</strong>{' '}
                {activeProject.notes}
              </div>
            ) : null}

            {/* Create New Persistent Comparison Project */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                <GitCompare className="h-4 w-4 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
                Save New Comparison Project
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name (e.g. Specialty Coffee Peers)"
                  aria-label="Comparison project name"
                  className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                />
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional benchmarking goal or takeaway"
                  aria-label="Comparison project notes"
                  className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeProfiles.map((p) => {
                  const picked = selectedHandles.includes(p.username);
                  return (
                    <button
                      key={p.username}
                      type="button"
                      aria-pressed={picked}
                      onClick={() => toggleHandle(p.username)}
                      className={`rounded-lg px-2.5 py-1 font-mono text-xs font-semibold transition ${
                        picked
                          ? 'bg-[#7957FF] text-white'
                          : 'border border-slate-200 bg-white text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-300'
                      }`}
                    >
                      {picked ? '✓ ' : '+ '}@{p.username}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createProject()}
                className="viewora-btn-primary mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Save Comparison Project
              </button>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        destructive
        busy={busy}
        title={`Delete comparison project "${deleteTarget?.name ?? ''}"?`}
        description="This permanently deletes the comparison project and its notes. Your underlying saved profiles will not be affected."
        confirmLabel="Delete Project"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
