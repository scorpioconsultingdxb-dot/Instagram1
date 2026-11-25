'use client';

import {
  Archive,
  Bookmark,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Filter,
  FolderKanban,
  Loader2,
  Pin,
  Plus,
  RotateCcw,
  Star,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SavedProfileRecord, UserWorkspaceState } from '@/lib/dashboard/store';
import type {
  CsvImportValidationResult,
  ResearchProjectRecord,
  ResearchProjectStatus,
  UserResearchProState,
} from '@/lib/research/workspace-pro';
import { StatusBanner } from '@/components/layout/PageShell';

const SAMPLE_CSV = `username,display_name,category,followers,following,posts,engagement_rate,tags,notes
studio.meridian,Meridian Creative,Design Studio,42800,610,214,4.2,design;benchmark,Quarterly campaign reference
craft.roasters,Craft Roasters Co,Specialty Coffee,19400,320,168,5.1,coffee;local,Strong carousel save rate`;

export function ResearchProModule({
  workspace,
  onWorkspaceChange,
}: {
  workspace: UserWorkspaceState;
  onWorkspaceChange: (next: UserWorkspaceState) => void;
}) {
  const [state, setState] = useState<UserResearchProState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  // Project composer
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [parentProjectId, setParentProjectId] = useState<string>('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [attachedProfiles, setAttachedProfiles] = useState<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ResearchProjectStatus>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [filterName, setFilterName] = useState('');

  // Bulk tagging
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkTag, setBulkTag] = useState('');

  // CSV importer
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<CsvImportValidationResult | null>(null);
  const [csvTargetProjectId, setCsvTargetProjectId] = useState<string>('');

  useEffect(() => {
    let active = true;
    fetch('/api/dashboard/research')
      .then((res) => res.json())
      .then((json: { ok?: boolean; research?: UserResearchProState }) => {
        if (active && json?.ok && json.research) setState(json.research);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const runAction = async (payload: Record<string, unknown>, successMsg?: string) => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/dashboard/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        research?: UserResearchProState;
        workspace?: UserWorkspaceState;
        preview?: CsvImportValidationResult;
        importedCount?: number;
        duplicatesSkipped?: number;
      } | null;
      if (!res.ok || !json?.ok) {
        setBanner({ tone: 'error', message: json?.error ?? 'Research action failed.' });
        return null;
      }
      if (json.research) setState(json.research);
      if (json.workspace) onWorkspaceChange(json.workspace);
      if (successMsg) setBanner({ tone: 'success', message: successMsg });
      return json;
    } catch {
      setBanner({ tone: 'error', message: 'Network error communicating with research workspace.' });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const projects = useMemo(() => state?.projects ?? [], [state?.projects]);
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        if (statusFilter === 'all' && p.status === 'archived') return false;
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (tagFilter && !p.tags.includes(tagFilter.toLowerCase())) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          return (
            p.title.toLowerCase().includes(q) ||
            p.objective.toLowerCase().includes(q) ||
            p.tags.some((t) => t.includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.favorite) - Number(a.favorite));
  }, [projects, statusFilter, tagFilter, searchQuery]);

  const handleCreateProject = async () => {
    if (title.trim().length < 2) {
      setBanner({ tone: 'error', message: 'Project title must be at least 2 characters.' });
      return;
    }
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const res = await runAction(
      {
        type: 'create_project',
        title: title.trim(),
        objective: objective.trim(),
        parentProjectId: parentProjectId || null,
        tags,
        profileUsernames: attachedProfiles,
      },
      `Created research project "${title.trim()}".`
    );
    if (res) {
      setTitle('');
      setObjective('');
      setTagsRaw('');
      setParentProjectId('');
      setAttachedProfiles([]);
    }
  };

  const handlePreviewCsv = async () => {
    if (!csvText.trim()) return;
    const res = await runAction({ type: 'preview_csv', csvText });
    if (res?.preview) setCsvPreview(res.preview);
  };

  const handleCommitCsv = async () => {
    if (!csvText.trim()) return;
    const res = await runAction({
      type: 'commit_csv',
      csvText,
      projectId: csvTargetProjectId || null,
    });
    if (res) {
      setBanner({
        tone: 'success',
        message: `Imported ${res.importedCount ?? 0} user-provided profile(s) (${res.duplicatesSkipped ?? 0} duplicate(s) skipped).`,
      });
      setCsvPreview(null);
      setCsvText('');
      setShowCsvPanel(false);
    }
  };

  const handleCsvFileUpload = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    const res = await runAction({ type: 'preview_csv', csvText: text });
    if (res?.preview) setCsvPreview(res.preview);
  };

  if (loading) {
    return (
      <div className="viewora-card flex items-center justify-center gap-2 rounded-2xl p-10 text-xs text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin text-[#7957FF]" aria-hidden="true" />
        Loading Research Workspace Pro…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
            Research Workspace Pro
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Organize nested research projects, saved filters, bulk profile tags, and user-provided CSV datasets.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCsvPanel((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-[#7957FF]" aria-hidden="true" />
          {showCsvPanel ? 'Hide CSV Importer' : 'Import User-Provided CSV'}
        </button>
      </div>

      {banner ? <StatusBanner tone={banner.tone} message={banner.message} /> : null}

      {/* User-Provided CSV Import Panel */}
      {showCsvPanel ? (
        <section className="viewora-card rounded-2xl border-violet-200/70 p-5 dark:border-violet-900/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
                <Upload className="h-4 w-4 text-[#7957FF]" aria-hidden="true" />
                User-Provided CSV Research Importer
              </h3>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Imported rows are validated, deduplicated, neutralized against CSV formulas, and labeled{' '}
                <strong>User-Provided CSV Import</strong> (never labeled live Instagram API data). Max 512 KB / 250 rows.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCsvText(SAMPLE_CSV)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-[#6941EF] hover:border-[#7957FF] dark:border-[#263047] dark:text-[#A99AFF]"
            >
              Load Sample CSV Template
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Upload .csv file
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void handleCsvFileUpload(e.target.files?.[0] ?? null)}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#263047] dark:bg-[#080D19]"
              />
            </label>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Attach imported profiles to project (optional)
              <select
                value={csvTargetProjectId}
                onChange={(e) => setCsvTargetProjectId(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              >
                <option value="">Workspace only (no project link)</option>
                {projects
                  .filter((p) => p.status !== 'archived')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <textarea
            rows={4}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="username,display_name,category,followers,following,posts,engagement_rate,tags,notes"
            aria-label="CSV rows input"
            className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-slate-100"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || !csvText.trim()}
              onClick={() => void handlePreviewCsv()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] disabled:opacity-50 dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
            >
              Validate &amp; Preview Rows
            </button>
            {csvPreview?.ok && csvPreview.validRows.length > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCommitCsv()}
                className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Commit {csvPreview.validRows.length} Valid Row(s)
              </button>
            ) : null}
          </div>

          {csvPreview ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
              <p className="font-semibold text-[#0F172A] dark:text-white">
                Validation Summary: {csvPreview.validRows.length} new · {csvPreview.duplicateRows.length} duplicate(s) ·{' '}
                {csvPreview.issues.length} issue(s)
              </p>
              {csvPreview.issues.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-600 dark:text-rose-300">
                  {csvPreview.issues.slice(0, 5).map((iss) => (
                    <li key={`${iss.rowNumber}-${iss.message}`}>
                      Row {iss.rowNumber}: {iss.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {csvPreview.validRows.length > 0 ? (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-[11px] tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 text-[#64748B] dark:border-[#263047]">
                        <th className="py-1.5 pr-3">Username</th>
                        <th className="py-1.5 pr-3">Category</th>
                        <th className="py-1.5 pr-3">Followers</th>
                        <th className="py-1.5 pr-3">Est. ER</th>
                        <th className="py-1.5">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.validRows.slice(0, 8).map((row) => (
                        <tr key={row.username} className="border-b border-slate-100 dark:border-[#1E293B]">
                          <td className="py-1.5 pr-3 font-semibold">@{row.username}</td>
                          <td className="py-1.5 pr-3">{row.category}</td>
                          <td className="py-1.5 pr-3">
                            {row.followersCount !== null ? row.followersCount.toLocaleString() : '—'}
                          </td>
                          <td className="py-1.5 pr-3">
                            {row.estimatedEngagementRate !== null ? `${row.estimatedEngagementRate}%` : '—'}
                          </td>
                          <td className="py-1.5">{row.tags.join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Create Project + Saved Filters Grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="viewora-card rounded-2xl p-5 lg:col-span-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
            <FolderKanban className="h-4 w-4 text-[#7957FF]" aria-hidden="true" />
            New Research Project / Nested Collection
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project title (e.g. Q4 D2C Competitor Audit)"
              aria-label="Research project title"
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <select
              value={parentProjectId}
              onChange={(e) => setParentProjectId(e.target.value)}
              aria-label="Parent collection"
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            >
              <option value="">Top-level project</option>
              {projects
                .filter((p) => p.status !== 'archived')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    Nested under: {p.title}
                  </option>
                ))}
            </select>
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Research objective or scope note"
              aria-label="Project objective"
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:col-span-2 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="Comma-separated tags (e.g. q4, benchmark, reels)"
              aria-label="Project tags"
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:col-span-2 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
          </div>

          {workspace.savedProfiles.length > 0 ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                Link saved profiles to this project:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {workspace.savedProfiles.map((p: SavedProfileRecord) => {
                  const selected = attachedProfiles.includes(p.username);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setAttachedProfiles((prev) =>
                          prev.includes(p.username)
                            ? prev.filter((u) => u !== p.username)
                            : [...prev, p.username]
                        )
                      }
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                        selected
                          ? 'border-[#7957FF] bg-[#7957FF] text-white'
                          : 'border-slate-200 bg-white text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#94A3B8]'
                      }`}
                    >
                      @{p.username}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCreateProject()}
              className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Create Research Project
            </button>
          </div>
        </section>

        {/* Saved Searches & Filters */}
        <section className="viewora-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
            <Bookmark className="h-4 w-4 text-[#22D3EE]" aria-hidden="true" />
            Saved Filters
          </h3>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Filter preset name"
              aria-label="Filter preset name"
              className="h-9 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <button
              type="button"
              disabled={busy || filterName.trim().length < 2}
              onClick={() => {
                void runAction(
                  {
                    type: 'save_filter',
                    name: filterName.trim(),
                    query: searchQuery,
                    tag: tagFilter,
                    status: statusFilter,
                  },
                  `Saved filter "${filterName.trim()}".`
                ).then((ok) => {
                  if (ok) setFilterName('');
                });
              }}
              className="rounded-xl bg-[#7957FF] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {(state?.savedFilters ?? []).length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                No saved filters yet. Set a search or status filter below and save it here for 1-click recall.
              </p>
            ) : (
              state!.savedFilters.map((flt) => (
                <div
                  key={flt.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(flt.query);
                      setTagFilter(flt.tag);
                      setStatusFilter(flt.status);
                    }}
                    className="truncate font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                  >
                    {flt.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete saved filter ${flt.name}`}
                    onClick={() => void runAction({ type: 'delete_filter', id: flt.id })}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Filter Bar + Projects List */}
      <section className="viewora-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects, objectives, tags…"
              aria-label="Search research projects"
              className="h-9 w-56 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | ResearchProjectStatus)}
              aria-label="Filter projects by status"
              className="h-9 rounded-xl border border-slate-300 bg-white px-2.5 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            >
              <option value="all">Active &amp; Open</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
            {tagFilter ? (
              <button
                type="button"
                onClick={() => setTagFilter('')}
                className="rounded-lg bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]"
              >
                #{tagFilter} ×
              </button>
            ) : null}
          </div>
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {filteredProjects.length} project(s)
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filteredProjects.length === 0 ? (
            <p className="col-span-full py-6 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
              No research projects match the current filter. Create your first project above.
            </p>
          ) : (
            filteredProjects.map((project: ResearchProjectRecord) => {
              const parent = project.parentProjectId
                ? projects.find((p) => p.id === project.parentProjectId)
                : null;
              return (
                <article
                  key={project.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {parent ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                          Collection: {parent.title}
                        </span>
                      ) : null}
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">
                        {project.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={project.pinned ? 'Unpin project' : 'Pin project'}
                        onClick={() =>
                          void runAction({
                            type: 'update_project',
                            id: project.id,
                            pinned: !project.pinned,
                          })
                        }
                        className={`rounded-lg p-1.5 ${
                          project.pinned
                            ? 'bg-violet-100 text-[#6941EF] dark:bg-violet-950/70 dark:text-[#A99AFF]'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={project.favorite ? 'Remove favorite' : 'Mark favorite'}
                        onClick={() =>
                          void runAction({
                            type: 'update_project',
                            id: project.id,
                            favorite: !project.favorite,
                          })
                        }
                        className={`rounded-lg p-1.5 ${
                          project.favorite ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <Star className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      {project.status === 'archived' ? (
                        <button
                          type="button"
                          aria-label="Restore project"
                          onClick={() =>
                            void runAction(
                              { type: 'update_project', id: project.id, status: 'active' },
                              `Restored "${project.title}".`
                            )
                          }
                          className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label="Archive project"
                          onClick={() =>
                            void runAction(
                              { type: 'update_project', id: project.id, status: 'archived' },
                              `Archived "${project.title}".`
                            )
                          }
                          className="rounded-lg p-1.5 text-slate-400 hover:text-amber-600"
                        >
                          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  {project.objective ? (
                    <p className="mt-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {project.objective}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold uppercase text-[#0F172A] dark:bg-[#192337] dark:text-slate-200">
                      {project.status}
                    </span>
                    {project.tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTagFilter(t)}
                        className="rounded-md bg-violet-100/70 px-2 py-0.5 text-[10px] font-semibold text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]"
                      >
                        #{t}
                      </button>
                    ))}
                    {project.profileUsernames.map((u) => (
                      <span
                        key={u}
                        className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
                      >
                        @{u}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* Bulk Organization + Recent Research History */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="viewora-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
            <Tag className="h-4 w-4 text-[#7957FF]" aria-hidden="true" />
            Bulk Profile Tagging
          </h3>
          {workspace.savedProfiles.length === 0 ? (
            <p className="mt-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Save profiles or import a CSV above to apply bulk tags across multiple accounts at once.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {workspace.savedProfiles.map((p) => {
                  const checked = bulkSelected.includes(p.username);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setBulkSelected((prev) =>
                          prev.includes(p.username)
                            ? prev.filter((x) => x !== p.username)
                            : [...prev, p.username]
                        )
                      }
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                        checked
                          ? 'border-[#7957FF] bg-[#7957FF] text-white'
                          : 'border-slate-200 bg-white text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-300'
                      }`}
                    >
                      @{p.username}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={bulkTag}
                  onChange={(e) => setBulkTag(e.target.value)}
                  placeholder="Tag to apply (e.g. priority)"
                  aria-label="Bulk tag name"
                  className="h-9 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
                />
                <button
                  type="button"
                  disabled={busy || bulkSelected.length === 0 || !bulkTag.trim()}
                  onClick={() => {
                    void runAction(
                      { type: 'bulk_tag_profiles', usernames: bulkSelected, tag: bulkTag.trim() },
                      `Applied "#${bulkTag.trim()}" to ${bulkSelected.length} profile(s).`
                    ).then((ok) => {
                      if (ok) {
                        setBulkTag('');
                        setBulkSelected([]);
                      }
                    });
                  }}
                  className="viewora-btn-primary rounded-xl px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  Apply Tag
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="viewora-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
            <Clock className="h-4 w-4 text-[#22D3EE]" aria-hidden="true" />
            Recent Research Activity
          </h3>
          {(state?.history ?? []).length === 0 ? (
            <p className="mt-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Real recorded workspace actions (project creation, CSV imports, saved filters, bulk tags) appear here.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-xs">
              {state!.history.slice(0, 6).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <span className="text-[#0F172A] dark:text-slate-200">{item.label}</span>
                  <span className="shrink-0 font-mono text-[10px] text-[#64748B]">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
