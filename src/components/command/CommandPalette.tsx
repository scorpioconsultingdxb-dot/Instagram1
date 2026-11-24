'use client';

import {
  BarChart3,
  CreditCard,
  Home,
  Moon,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { FREE_TOOLS } from '@/lib/tools/catalog';
import { useTheme } from '@/components/theme/ThemeProvider';

export const OPEN_COMMAND_PALETTE_EVENT = 'viewora:open-command-palette';

export function triggerCommandPalette(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
  }
}

interface CommandItem {
  id: string;
  group: 'Navigation' | 'Workspace' | 'Free Tools' | 'Preferences';
  label: string;
  hint: string;
  icon: typeof Home;
  run: () => void;
}

export function CommandPalette({ locale }: { locale: Locale }) {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
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
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const items: CommandItem[] = useMemo(() => {
    const go = (path: string) => {
      setOpen(false);
      router.push(`/${locale}${path}`);
    };

    return [
      { id: 'nav-home', group: 'Navigation', label: 'Homepage & Profile Search', hint: 'Explore public Instagram profiles', icon: Home, run: () => go('') },
      { id: 'nav-tools', group: 'Navigation', label: 'All 12 Free Tools', hint: 'Calculators, generators & viewers', icon: Wrench, run: () => go('/tools') },
      { id: 'nav-pricing', group: 'Navigation', label: 'Pricing & Plan Matrix', hint: 'Compare Free through Agency tiers', icon: CreditCard, run: () => go('/pricing') },
      { id: 'nav-transparency', group: 'Navigation', label: 'Data Transparency Policy', hint: 'LIVE, CACHED, ESTIMATED & DEMO rules', icon: Shield, run: () => go('/data-transparency') },
      { id: 'ws-dash', group: 'Workspace', label: 'Customer Dashboard', hint: 'Overview, charts, saved profiles', icon: BarChart3, run: () => go('/dashboard') },
      { id: 'ws-profile', group: 'Workspace', label: 'My Profile — Personal Digital HQ', hint: 'Cover, avatar, membership & personalization', icon: User, run: () => go('/dashboard/profile') },
      { id: 'ws-ai', group: 'Workspace', label: 'AI Intelligence Studio', hint: 'Generate structured Gemini profile reports', icon: Sparkles, run: () => go('/dashboard/ai-insights') },
      { id: 'ws-settings', group: 'Workspace', label: 'Privacy & Account Settings', hint: 'Data export, security & preferences', icon: Settings, run: () => go('/dashboard/settings') },
      { id: 'ws-admin', group: 'Workspace', label: 'Super Admin Control Center', hint: 'RBAC-protected operations console', icon: Shield, run: () => go('/admin') },
      ...FREE_TOOLS.map((tool) => ({
        id: `tool-${tool.slug}`,
        group: 'Free Tools' as const,
        label: tool.name,
        hint: tool.category,
        icon: Wrench,
        run: () => go(`/${tool.slug}`),
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
  }, [locale, resolvedTheme, router, toggleTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.hint.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q)
    );
  }, [items, query]);

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
            placeholder="Jump to a tool, dashboard view, profile HQ, or action…"
            className="flex-1 bg-transparent text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none dark:text-[#F8FAFC] dark:placeholder:text-[#94A3B8]"
          />
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
              No matching commands for &ldquo;{query}&rdquo;.
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
