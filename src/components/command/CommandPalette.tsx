'use client';

import {
  BarChart3,
  Clock,
  CreditCard,
  FileText,
  FolderKanban,
  Home,
  Moon,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { FREE_TOOLS } from '@/lib/tools/catalog';
import { useTheme } from '@/components/theme/ThemeProvider';

export const OPEN_COMMAND_PALETTE_EVENT = 'viewora:open-command-palette';
const RECENT_STORAGE_KEY = 'viewora:command-recent:v1';

export function triggerCommandPalette(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
  }
}

interface CommandItem {
  id: string;
  group: 'Recent' | 'My Workspace' | 'Navigation' | 'Workspace' | 'Free Tools' | 'Preferences';
  label: string;
  hint: string;
  icon: typeof Home;
  run: () => void;
}

interface RecentEntry {
  id: string;
  label: string;
  hint: string;
  path: string;
}

interface WorkspaceSearchHit {
  id: string;
  kind: 'profile' | 'folder' | 'project' | 'report';
  title: string;
  subtitle: string;
  href: string;
}

function loadRecentEntries(): RecentEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is RecentEntry =>
          Boolean(x && typeof x === 'object' && typeof (x as RecentEntry).path === 'string')
      )
      .slice(0, 4);
  } catch {
    return [];
  }
}

function recordRecentEntry(entry: RecentEntry): RecentEntry[] {
  const existing = loadRecentEntries().filter((e) => e.id !== entry.id);
  const next = [entry, ...existing].slice(0, 4);
  try {
    window.sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore private mode storage limits
  }
  return next;
}

export function CommandPalette({ locale }: { locale: Locale }) {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [workspaceHits, setWorkspaceHits] = useState<WorkspaceSearchHit[]>([]);
  const [searchingWorkspace, setSearchingWorkspace] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const onCustomOpen = () => setOpen(true);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onCustomOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onCustomOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setWorkspaceHits([]);
      setRecent(loadRecentEntries());
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  // Debounced authorized workspace search (profiles, folders, projects, reports belonging to current user)
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setWorkspaceHits([]);
      setSearchingWorkspace(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearchingWorkspace(true);
      fetch(`/api/dashboard/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((json: { ok?: boolean; results?: WorkspaceSearchHit[] } | null) => {
          if (json?.ok && Array.isArray(json.results)) {
            setWorkspaceHits(json.results);
          } else {
            setWorkspaceHits([]);
          }
        })
        .catch(() => undefined)
        .finally(() => setSearchingWorkspace(false));
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const navigateWithRecent = useCallback(
    (id: string, label: string, hint: string, path: string) => {
      setRecent(recordRecentEntry({ id, label, hint, path }));
      setOpen(false);
      router.push(`/${locale}${path}`);
    },
    [locale, router]
  );

  const items: CommandItem[] = useMemo(() => {
    const go = (id: string, label: string, hint: string, path: string) => () =>
      navigateWithRecent(id, label, hint, path);

    return [
      { id: 'nav-home', group: 'Navigation', label: 'Homepage & Profile Search', hint: 'Explore public Instagram profiles', icon: Home, run: go('nav-home', 'Homepage & Profile Search', 'Explore public Instagram profiles', '') },
      { id: 'nav-tools', group: 'Navigation', label: 'All 12 Free Tools', hint: 'Calculators, generators & viewers', icon: Wrench, run: go('nav-tools', 'All 12 Free Tools', 'Calculators, generators & viewers', '/tools') },
      { id: 'nav-pricing', group: 'Navigation', label: 'Pricing & Plan Matrix', hint: 'Compare Free through Agency tiers', icon: CreditCard, run: go('nav-pricing', 'Pricing & Plan Matrix', 'Compare Free through Agency tiers', '/pricing') },
      { id: 'nav-transparency', group: 'Navigation', label: 'Data Transparency Policy', hint: 'LIVE, CACHED, ESTIMATED & DEMO rules', icon: Shield, run: go('nav-transparency', 'Data Transparency Policy', 'LIVE, CACHED, ESTIMATED & DEMO rules', '/data-transparency') },
      { id: 'ws-dash', group: 'Workspace', label: 'Customer Dashboard', hint: 'Overview, charts, saved profiles', icon: BarChart3, run: go('ws-dash', 'Customer Dashboard', 'Overview, charts, saved profiles', '/dashboard') },
      { id: 'ws-projects', group: 'Workspace', label: 'Research Workspace Pro', hint: 'Nested projects, CSV imports & bulk tags', icon: FolderKanban, run: go('ws-projects', 'Research Workspace Pro', 'Nested projects, CSV imports & bulk tags', '/dashboard/projects') },
      { id: 'ws-reports', group: 'Workspace', label: 'Report Studio', hint: 'Template-generated PDF, CSV & Markdown briefs', icon: FileText, run: go('ws-reports', 'Report Studio', 'Template-generated PDF, CSV & Markdown briefs', '/dashboard/reports') },
      { id: 'ws-profile', group: 'Workspace', label: 'My Profile — Personal Digital HQ', hint: 'Cover, avatar, membership & personalization', icon: User, run: go('ws-profile', 'My Profile — Personal Digital HQ', 'Cover, avatar, membership & personalization', '/dashboard/profile') },
      { id: 'ws-ai', group: 'Workspace', label: 'AI Intelligence Studio', hint: 'Generate structured Gemini profile reports', icon: Sparkles, run: go('ws-ai', 'AI Intelligence Studio', 'Generate structured Gemini profile reports', '/dashboard/ai-insights') },
      { id: 'ws-settings', group: 'Workspace', label: 'Privacy & Account Settings', hint: 'Data export, security & preferences', icon: Settings, run: go('ws-settings', 'Privacy & Account Settings', 'Data export, security & preferences', '/dashboard/settings') },
      { id: 'ws-admin', group: 'Workspace', label: 'Super Admin Control Center', hint: 'RBAC-protected operations console', icon: Shield, run: go('ws-admin', 'Super Admin Control Center', 'RBAC-protected operations console', '/admin') },
      ...FREE_TOOLS.map((tool) => ({
        id: `tool-${tool.slug}`,
        group: 'Free Tools' as const,
        label: tool.name,
        hint: tool.category,
        icon: Wrench,
        run: go(`tool-${tool.slug}`, tool.name, tool.category, `/${tool.slug}`),
      })),
      {
        id: 'pref-theme',
        group: 'Preferences',
        label: `Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`,
        hint: 'Toggle theme immediately',
        icon: resolvedTheme === 'dark' ? Sun : Moon,
        run: () => {
          toggleTheme();
          setOpen(false);
        },
      },
    ];
  }, [navigateWithRecent, resolvedTheme, toggleTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const recentItems: CommandItem[] = recent.map((r) => ({
        id: `recent-${r.id}`,
        group: 'Recent',
        label: r.label,
        hint: r.hint,
        icon: Clock,
        run: () => navigateWithRecent(r.id, r.label, r.hint, r.path),
      }));
      return [...recentItems, ...items.slice(0, 12)];
    }

    const dynamicWorkspaceItems: CommandItem[] = workspaceHits.map((hit) => ({
      id: hit.id,
      group: 'My Workspace',
      label: hit.title,
      hint: hit.subtitle,
      icon:
        hit.kind === 'profile'
          ? Users
          : hit.kind === 'project'
            ? FolderKanban
            : hit.kind === 'report'
              ? FileText
              : BarChart3,
      run: () => navigateWithRecent(hit.id, hit.title, hit.subtitle, hit.href),
    }));

    const staticMatches = items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.hint.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q)
    );

    return [...dynamicWorkspaceItems, ...staticMatches];
  }, [items, navigateWithRecent, query, recent, workspaceHits]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Viewora Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="viewora-card-elevated animate-viewora-enter w-full max-w-xl overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-[#263047]">
          <Search className="h-4 w-4 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter' && filtered[selectedIndex]) {
                e.preventDefault();
                filtered[selectedIndex]!.run();
              }
            }}
            placeholder="Search saved profiles, projects, reports, tools, or commands…"
            className="flex-1 bg-transparent text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none dark:text-[#F8FAFC] dark:placeholder:text-[#94A3B8]"
          />
          {searchingWorkspace ? (
            <span className="text-[10px] font-semibold text-[#6941EF] dark:text-[#A99AFF]">
              Searching…
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close command palette"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#192337] dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
              No matching commands or workspace items for &ldquo;{query}&rdquo;.
            </p>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const active = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={item.run}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    active
                      ? 'bg-violet-50 text-[#6941EF] dark:bg-[#192337] dark:text-[#F8FAFC]'
                      : 'text-[#0F172A] hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#192337]/60'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? 'bg-[#7957FF] text-white'
                          : 'bg-slate-100 text-slate-500 dark:bg-[#0F172A] dark:text-slate-400'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{item.label}</p>
                      <p className="truncate text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {item.hint}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-[#080D19] dark:text-slate-400">
                    {item.group}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-2 text-[11px] text-[#64748B] dark:border-[#263047] dark:bg-[#080D19]/80 dark:text-[#94A3B8]">
          <span>↑↓ Navigate · ↵ Open · Esc Close</span>
          <span className="font-mono">Ctrl K / ⌘K</span>
        </div>
      </div>
    </div>
  );
}
