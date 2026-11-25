'use client';

import { GitCompare, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type {
  ComparisonProjectRecord,
  SavedProfileRecord,
  UserWorkspaceState,
} from '@/lib/dashboard/store';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { EmptyState, UpgradePreviewCard } from '@/components/ui/Primitives';
import { ConfirmDialog, StatusBanner } from '@/components/layout/PageShell';

export function CompetitorStudio({
  locale,
  dict,
  canCompetitors,
  workspace,
  activeProfiles,
  isDemoPreview,
  onWorkspaceChange,
}: {
  locale: Locale;
  dict: Dictionary;
  canCompetitors: boolean;
  workspace: UserWorkspaceState;
  activeProfiles: SavedProfileRecord[];
  isDemoPreview: boolean;
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
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<ComparisonProjectRecord | null>(null);

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

  const toggleHandle = (username: string) => {
    setSelectedHandles((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
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
      setBanner({ tone: 'success', message: `Deleted comparison project "${deleteTarget.name}".` });
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  const activeProject = workspace.comparisons.find((c) => c.id === activeProjectId) ?? null;
  const rowsToCompare = activeProject
    ? activeProfiles.filter((p) =>
        activeProject.usernames.includes(p.username.toLowerCase())
      )
    : activeProfiles;

  const avgEr =
    rowsToCompare.length > 0
      ? Number(
          (
            rowsToCompare.reduce((sum, p) => sum + (p.profile.estimatedEngagementRate ?? 0), 0) /
            rowsToCompare.length
          ).toFixed(2)
        )
      : 0;

  return (
    <div className="space-y-5">
      <div className="viewora-card space-y-5 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Competitor Comparison Projects ({workspace.comparisons.length})
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Create persistent comparison sets across saved profiles and benchmark engagement
              deltas against the group average.
            </p>
          </div>
          <ProvenanceBadge
            dataClass={isDemoPreview ? 'demo' : rowsToCompare[0]?.dataClass ?? 'unavailable'}
            labels={dict.provenance}
          />
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
            description="Add two or more eligible public profiles in Saved Profiles (or enable Demo Preview Mode) to build persistent comparison projects."
          />
        ) : (
          <>
            {/* Saved Comparison Tabs */}
            {workspace.comparisons.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveProjectId(null)}
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
                      onClick={() => setActiveProjectId(proj.id)}
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
                      aria-label={`Delete project ${proj.name}`}
                      onClick={() => setDeleteTarget(proj)}
                      className="rounded-r-xl bg-slate-100 px-2 py-1.5 text-xs text-slate-400 hover:text-rose-500 dark:bg-[#0F172A]"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            {/* Comparison Matrix Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-[#263047]">
              <table className="w-full min-w-[600px] text-left text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[#64748B] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]">
                    <th className="px-4 py-3 font-semibold">Profile</th>
                    <th className="px-4 py-3 font-semibold">Followers</th>
                    <th className="px-4 py-3 font-semibold">Est. ER</th>
                    <th className="px-4 py-3 font-semibold">Delta vs Group ({avgEr}%)</th>
                    <th className="px-4 py-3 font-semibold">Posts / wk</th>
                    <th className="px-4 py-3 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#263047]">
                  {rowsToCompare.map((item) => {
                    const er = item.profile.estimatedEngagementRate ?? 0;
                    const delta = Number((er - avgEr).toFixed(2));
                    return (
                      <tr key={item.username}>
                        <td className="px-4 py-3">
                          <span className="block font-mono font-bold text-[#0F172A] dark:text-white">
                            @{item.username}
                          </span>
                          <span className="text-[11px] text-[#64748B]">
                            {item.profile.displayName}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#0F172A] dark:text-slate-200">
                          {(item.profile.followersCount ?? 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-bold text-[#6941EF] dark:text-[#A99AFF]">
                          {item.profile.estimatedEngagementRate ?? '—'}%
                        </td>
                        <td
                          className={`px-4 py-3 font-bold ${
                            delta >= 0
                              ? 'text-emerald-600 dark:text-[#34D399]'
                              : 'text-rose-600 dark:text-[#F87171]'
                          }`}
                        >
                          {delta >= 0 ? '+' : ''}
                          {delta} pts
                        </td>
                        <td className="px-4 py-3 text-[#0F172A] dark:text-slate-200">
                          {item.profile.postingCadencePerWeek ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <ProvenanceBadge dataClass={item.dataClass} labels={dict.provenance} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {activeProject?.notes ? (
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
