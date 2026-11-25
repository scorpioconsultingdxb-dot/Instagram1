'use client';

import Link from 'next/link';
import {
  FolderPlus,
  Loader2,
  NotebookPen,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type {
  ResearchFolderRecord,
  SavedProfileRecord,
  UserWorkspaceState,
} from '@/lib/dashboard/store';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { EmptyState } from '@/components/ui/Primitives';
import { ConfirmDialog, StatusBanner } from '@/components/layout/PageShell';

const FOLDER_DOTS: Record<ResearchFolderRecord['color'], string> = {
  violet: 'bg-[#7957FF]',
  cyan: 'bg-[#22D3EE]',
  emerald: 'bg-[#34D399]',
  amber: 'bg-[#FBBF24]',
  slate: 'bg-slate-400',
};

export function SavedProfilesModule({
  locale,
  dict,
  workspace,
  trackedLimit,
  initialHandle,
  onWorkspaceChange,
  onInspectProfile,
  onEnableDemoPreview,
}: {
  locale: Locale;
  dict: Dictionary;
  workspace: UserWorkspaceState;
  trackedLimit: number | string;
  initialHandle?: string;
  onWorkspaceChange: (next: UserWorkspaceState) => void;
  onInspectProfile: (username: string) => void;
  onEnableDemoPreview: () => void;
}) {
  const [addInput, setAddInput] = useState(initialHandle ? `@${initialHandle}` : '');
  const [scopeToActiveWorkspace, setScopeToActiveWorkspace] = useState(false);
  const [selectedFolderForAdd, setSelectedFolderForAdd] = useState<string>(
    workspace.folders[0]?.id ?? ''
  );
  const [filterFolder, setFilterFolder] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'followers_desc' | 'er_desc' | 'alpha'>(
    workspace.settings.defaultSort
  );

  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] =
    useState<ResearchFolderRecord['color']>('violet');
  const [showNewFolder, setShowNewFolder] = useState(false);

  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [draftFolderId, setDraftFolderId] = useState<string>('');

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: 'profile'; username: string }
    | { kind: 'folder'; folderId: string; name: string }
    | null
  >(null);

  const runWorkspaceMutation = async (
    payload: Record<string, unknown>,
    successMsg: string
  ): Promise<boolean> => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        workspace?: UserWorkspaceState;
      } | null;

      if (!res.ok || !json?.ok || !json.workspace) {
        setBanner({
          tone: 'error',
          message: json?.error ?? `Workspace action failed (HTTP ${res.status}).`,
        });
        return false;
      }
      onWorkspaceChange(json.workspace);
      setBanner({ tone: 'success', message: successMsg });
      return true;
    } catch {
      setBanner({ tone: 'error', message: 'Network error while updating workspace.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async (rawHandle?: string) => {
    const target = (rawHandle ?? addInput).trim();
    if (!target) {
      setBanner({ tone: 'error', message: 'Enter an Instagram @username or profile URL.' });
      return;
    }
    const ok = await runWorkspaceMutation(
      {
        type: 'save_profile',
        input: target,
        folderId: selectedFolderForAdd || null,
        workspace: workspace.settings.activeWorkspace,
        allowDemoFallback: true,
      },
      `Saved ${target.startsWith('@') ? target : `@${target}`} to your persistent workspace.`
    );
    if (ok) {
      setAddInput('');
    }
  };

  const handleCreateFolder = async () => {
    if (newFolderName.trim().length < 2) {
      setBanner({ tone: 'error', message: 'Folder name must be at least 2 characters.' });
      return;
    }
    const ok = await runWorkspaceMutation(
      {
        type: 'create_folder',
        name: newFolderName.trim(),
        color: newFolderColor,
      },
      `Created research folder "${newFolderName.trim()}".`
    );
    if (ok) {
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  const openEditor = (item: SavedProfileRecord) => {
    setEditingNoteFor(item.username);
    setDraftNote(item.privateNote);
    setDraftTags(item.tags.join(', '));
    setDraftFolderId(item.folderId ?? '');
  };

  const saveMeta = async (username: string) => {
    const tags = draftTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);

    const ok = await runWorkspaceMutation(
      {
        type: 'update_profile_meta',
        username,
        folderId: draftFolderId || null,
        privateNote: draftNote,
        tags,
      },
      `Saved private note and folder assignment for @${username}.`
    );
    if (ok) {
      setEditingNoteFor(null);
    }
  };

  const executeConfirmedDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.kind === 'profile') {
      await runWorkspaceMutation(
        { type: 'remove_profile', username: confirmDelete.username },
        `Removed @${confirmDelete.username} from your saved profiles.`
      );
    } else {
      await runWorkspaceMutation(
        { type: 'delete_folder', folderId: confirmDelete.folderId },
        `Deleted research folder "${confirmDelete.name}". Profiles were kept as Unassigned.`
      );
      if (filterFolder === confirmDelete.folderId) {
        setFilterFolder('all');
      }
    }
    setConfirmDelete(null);
  };

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const p of workspace.savedProfiles) {
      for (const t of p.tags) tagSet.add(t);
    }
    return Array.from(tagSet).sort();
  }, [workspace.savedProfiles]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = workspace.savedProfiles.filter((item) => {
      if (scopeToActiveWorkspace && item.workspace !== workspace.settings.activeWorkspace) {
        return false;
      }
      if (filterFolder === 'unassigned' && item.folderId !== null) return false;
      if (filterFolder !== 'all' && filterFolder !== 'unassigned' && item.folderId !== filterFolder) {
        return false;
      }
      if (filterTag !== 'all' && !item.tags.includes(filterTag)) {
        return false;
      }
      if (!q) return true;
      return (
        item.username.toLowerCase().includes(q) ||
        item.profile.displayName.toLowerCase().includes(q) ||
        item.privateNote.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'followers_desc') {
        return (b.profile.followersCount ?? 0) - (a.profile.followersCount ?? 0);
      }
      if (sortBy === 'er_desc') {
        return (b.profile.estimatedEngagementRate ?? 0) - (a.profile.estimatedEngagementRate ?? 0);
      }
      if (sortBy === 'alpha') {
        return a.username.localeCompare(b.username);
      }
      return b.savedAt.localeCompare(a.savedAt);
    });
  }, [
    workspace.savedProfiles,
    workspace.settings.activeWorkspace,
    scopeToActiveWorkspace,
    filterFolder,
    filterTag,
    searchQuery,
    sortBy,
  ]);

  return (
    <div className="space-y-5">
      {/* Add Profile & Quota Header */}
      <div className="viewora-card space-y-4 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Saved Eligible Profiles ({workspace.savedProfiles.length} / {trackedLimit})
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Records persist across refreshes and sessions. Save an authorized public handle or
              test with labeled demo handles (<span className="font-mono">@viewora.studio</span>,{' '}
              <span className="font-mono">@aurora.coffee</span>,{' '}
              <span className="font-mono">@nordic.design</span>).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewFolder((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A] dark:text-slate-200"
          >
            <FolderPlus className="h-3.5 w-3.5 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
            New Folder
          </button>
        </div>

        {/* Save Profile Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSaveProfile();
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="text"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            aria-label="Instagram username to save"
            placeholder="Enter @username or instagram.com/username"
            className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 text-xs text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          />
          <select
            aria-label="Assign folder"
            value={selectedFolderForAdd}
            onChange={(e) => setSelectedFolderForAdd(e.target.value)}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs text-[#0F172A] dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
          >
            <option value="">Unassigned folder</option>
            {workspace.folders.map((f) => (
              <option key={f.id} value={f.id}>
                Folder: {f.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="viewora-btn-primary inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Save Profile
          </button>
        </form>

        {/* Quick Create Folder Form */}
        {showNewFolder ? (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3.5 dark:border-[#263047] dark:bg-[#0F172A]">
            <label className="min-w-44 flex-1 text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Research Folder Name
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Q4 Competitors"
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-normal dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
              />
            </label>
            <label className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Color
              <select
                value={newFolderColor}
                onChange={(e) =>
                  setNewFolderColor(e.target.value as ResearchFolderRecord['color'])
                }
                className="mt-1 block h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-normal dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
              >
                <option value="violet">Violet</option>
                <option value="cyan">Cyan</option>
                <option value="emerald">Emerald</option>
                <option value="amber">Amber</option>
                <option value="slate">Slate</option>
              </select>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCreateFolder()}
              className="viewora-btn-primary h-9 rounded-lg px-4 text-xs font-semibold disabled:opacity-60"
            >
              Create
            </button>
          </div>
        ) : null}

        {banner ? (
          <StatusBanner
            tone={banner.tone}
            message={banner.message}
            onDismiss={() => setBanner(null)}
          />
        ) : null}

        {/* Folder Filter Chips + Search + Sort */}
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 lg:flex-row lg:items-center lg:justify-between dark:border-[#263047]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterFolder('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                filterFolder === 'all'
                  ? 'bg-[#7957FF] text-white'
                  : 'bg-slate-100 text-[#64748B] hover:text-[#0F172A] dark:bg-[#0F172A] dark:text-[#94A3B8]'
              }`}
            >
              All ({workspace.savedProfiles.length})
            </button>
            {workspace.folders.map((folder) => {
              const count = workspace.savedProfiles.filter((p) => p.folderId === folder.id).length;
              return (
                <span key={folder.id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => setFilterFolder(folder.id)}
                    className={`inline-flex items-center gap-1.5 rounded-l-lg px-2.5 py-1 text-xs font-semibold ${
                      filterFolder === folder.id
                        ? 'bg-[#7957FF] text-white'
                        : 'bg-slate-100 text-[#64748B] hover:text-[#0F172A] dark:bg-[#0F172A] dark:text-[#94A3B8]'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${FOLDER_DOTS[folder.color]}`} />
                    {folder.name} ({count})
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete folder ${folder.name}`}
                    onClick={() =>
                      setConfirmDelete({ kind: 'folder', folderId: folder.id, name: folder.name })
                    }
                    className="rounded-r-lg bg-slate-100 px-1.5 py-1 text-xs text-slate-400 hover:text-rose-500 dark:bg-[#0F172A]"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {workspace.workspaces.length > 1 ? (
              <button
                type="button"
                aria-pressed={scopeToActiveWorkspace}
                onClick={() => setScopeToActiveWorkspace((prev) => !prev)}
                className={`h-9 rounded-xl border px-2.5 text-xs font-semibold transition ${
                  scopeToActiveWorkspace
                    ? 'border-[#7957FF] bg-violet-50 text-[#6941EF] dark:bg-violet-950/50 dark:text-[#A99AFF]'
                    : 'border-slate-200 bg-slate-50 text-[#64748B] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]'
                }`}
              >
                {scopeToActiveWorkspace ? `Only: ${workspace.settings.activeWorkspace}` : 'All Workspaces'}
              </button>
            ) : null}
            <label className="relative flex-1 sm:w-52 sm:flex-none">
              <span className="sr-only">Search saved profiles and notes</span>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search handle, tag, note…"
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pr-3 pl-8 text-xs dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
              />
            </label>
            <select
              aria-label="Sort saved profiles"
              value={sortBy}
              onChange={(e) => {
                const nextSort = e.target.value as typeof sortBy;
                setSortBy(nextSort);
                void runWorkspaceMutation(
                  { type: 'update_settings', defaultSort: nextSort },
                  `Default sort preference saved (${nextSort}).`
                );
              }}
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-[#0F172A] dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
            >
              <option value="newest">Sort: Recently Saved</option>
              <option value="followers_desc">Sort: Most Followers</option>
              <option value="er_desc">Sort: Highest Est. ER</option>
              <option value="alpha">Sort: A → Z</option>
            </select>
          </div>
        </div>

        {/* Empty State vs Saved Grid */}
        {workspace.savedProfiles.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              title="Your real workspace starts clean"
              description="Viewora never pre-populates fake or demo profiles into your account automatically. Save an eligible public profile above, or turn on explicit Demo Preview Mode to explore sample analytics."
              actionLabel="Enable Explicit Demo Preview Mode"
              onAction={onEnableDemoPreview}
            />
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#64748B]">
              <span>Or explicitly save a labeled demo fixture:</span>
              {['viewora.studio', 'aurora.coffee', 'nordic.design'].map((h) => (
                <button
                  key={h}
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSaveProfile(h)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs font-semibold hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A] dark:text-slate-200"
                >
                  <Sparkles className="h-3 w-3 text-[#7957FF]" aria-hidden="true" />
                  Save @{h}
                </button>
              ))}
            </div>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <EmptyState
            title="No saved profiles match your search or folder filter"
            description="Reset your filter or switch back to All folders to view your saved profiles."
            actionLabel="Show all saved profiles"
            onAction={() => {
              setFilterFolder('all');
              setFilterTag('all');
              setSearchQuery('');
            }}
          />
        ) : (
          <div className="space-y-3">
            {allTags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">Filter by tag:</span>
                <button
                  type="button"
                  onClick={() => setFilterTag('all')}
                  className={`rounded-full px-2.5 py-0.5 font-semibold transition ${
                    filterTag === 'all'
                      ? 'bg-[#7957FF] text-white'
                      : 'bg-slate-100 text-[#64748B] hover:text-[#0F172A] dark:bg-[#0F172A] dark:text-[#94A3B8]'
                  }`}
                >
                  All tags
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setFilterTag(filterTag === tag ? 'all' : tag)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold transition ${
                      filterTag === tag
                        ? 'bg-[#7957FF] text-white'
                        : 'bg-violet-50 text-[#6941EF] hover:bg-violet-100 dark:bg-violet-950/60 dark:text-[#A99AFF]'
                    }`}
                  >
                    <Tag className="h-2.5 w-2.5" aria-hidden="true" />
                    {tag}
                  </button>
                ))}
              </div>
            ) : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProfiles.map((item) => {
              const folder = workspace.folders.find((f) => f.id === item.folderId);
              const isEditing = editingNoteFor === item.username;
              return (
                <article
                  key={item.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/${locale}/dashboard/profiles/${encodeURIComponent(item.username)}`}
                          className="font-mono text-sm font-bold text-[#0F172A] hover:text-[#6941EF] dark:text-[#F8FAFC] dark:hover:text-[#A99AFF]"
                        >
                          @{item.username}
                        </Link>
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {item.profile.displayName}
                        </p>
                      </div>
                      <ProvenanceBadge dataClass={item.dataClass} labels={dict.provenance} />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-xs tabular-nums dark:border-[#263047] dark:bg-[#131C2E]">
                      <div>
                        <span className="text-[10px] text-[#64748B]">Followers</span>
                        <p className="font-bold text-[#0F172A] dark:text-white">
                          {(item.profile.followersCount ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#64748B]">Est. ER</span>
                        <p className="font-bold text-[#6941EF] dark:text-[#A99AFF]">
                          {item.profile.estimatedEngagementRate ?? '—'}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {folder ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-[#0F172A] ring-1 ring-slate-200 dark:bg-[#131C2E] dark:text-slate-200 dark:ring-[#263047]">
                          <span className={`h-1.5 w-1.5 rounded-full ${FOLDER_DOTS[folder.color]}`} />
                          {folder.name}
                        </span>
                      ) : null}
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]"
                        >
                          <Tag className="h-2.5 w-2.5" aria-hidden="true" />
                          {tag}
                        </span>
                      ))}
                    </div>

                    {item.privateNote && !isEditing ? (
                      <p className="mt-2.5 rounded-lg border border-slate-200 bg-white/80 p-2.5 text-[11px] leading-relaxed text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-300">
                        {item.privateNote}
                      </p>
                    ) : null}

                    {isEditing ? (
                      <div className="mt-3 space-y-2 rounded-xl border border-violet-200 bg-white p-3 dark:border-[#263047] dark:bg-[#131C2E]">
                        <label className="block text-[11px] font-semibold text-[#0F172A] dark:text-slate-200">
                          Research Folder
                          <select
                            value={draftFolderId}
                            onChange={(e) => setDraftFolderId(e.target.value)}
                            className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                          >
                            <option value="">Unassigned</option>
                            {workspace.folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-[11px] font-semibold text-[#0F172A] dark:text-slate-200">
                          Tags (comma-separated)
                          <input
                            type="text"
                            value={draftTags}
                            onChange={(e) => setDraftTags(e.target.value)}
                            placeholder="competitor, reels, q4"
                            className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                          />
                        </label>
                        <label className="block text-[11px] font-semibold text-[#0F172A] dark:text-slate-200">
                          <span className="flex items-center justify-between">
                            <span>Private Note (account-only)</span>
                            <span className="font-mono text-[10px] font-normal text-[#64748B]">
                              {draftNote.length} / 2000
                            </span>
                          </span>
                          <textarea
                            rows={2}
                            maxLength={2000}
                            value={draftNote}
                            onChange={(e) => setDraftNote(e.target.value)}
                            placeholder="Add private research takeaways…"
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                          />
                        </label>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingNoteFor(null)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold dark:border-[#263047]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void saveMeta(item.username)}
                            className="viewora-btn-primary rounded-lg px-3 py-1 text-[11px] font-semibold disabled:opacity-60"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-[#263047]">
                    <button
                      type="button"
                      onClick={() => onInspectProfile(item.username)}
                      className="text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                    >
                      Open analytics →
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditor(item)}
                        aria-label={`Edit private note for @${item.username}`}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#64748B] hover:bg-slate-200/70 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337]"
                      >
                        <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
                        Note
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({ kind: 'profile', username: item.username })
                        }
                        aria-label={`Remove @${item.username}`}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        destructive
        busy={busy}
        title={
          confirmDelete?.kind === 'profile'
            ? `Remove @${confirmDelete.username}?`
            : `Delete folder "${confirmDelete?.name ?? ''}"?`
        }
        description={
          confirmDelete?.kind === 'profile'
            ? 'This permanently deletes the saved profile and its private research note from your workspace.'
            : 'Profiles inside this folder will remain saved as Unassigned, while the folder itself is permanently deleted.'
        }
        confirmLabel={confirmDelete?.kind === 'profile' ? 'Remove Profile' : 'Delete Folder'}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void executeConfirmedDelete()}
      />
    </div>
  );
}
