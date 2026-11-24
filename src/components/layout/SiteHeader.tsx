'use client';

import Link from 'next/link';
import {
  Building2,
  ChevronDown,
  Command,
  Menu,
  Search,
  User,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { FREE_TOOLS } from '@/lib/tools/catalog';
import { VieworaLogo } from '@/components/brand/VieworaLogo';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { triggerCommandPalette } from '@/components/command/CommandPalette';

export function SiteHeader({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<'tools' | 'solutions' | null>(null);

  return (
    <header
      onMouseLeave={() => setOpenMenu(null)}
      className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-[#263047]/80 dark:bg-[#080D19]/85"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} aria-label="Viewora home" className="shrink-0">
          <VieworaLogo size={32} />
        </Link>

        {/* Desktop Primary Navigation with Organized Dropdowns */}
        <nav aria-label="Primary navigation" className="hidden items-center gap-0.5 lg:flex">
          <Link
            href={`/${locale}`}
            className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#131C2E] dark:hover:text-[#F8FAFC]"
          >
            Explore
          </Link>

          {/* Free Tools Mega Dropdown */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={openMenu === 'tools'}
              onMouseEnter={() => setOpenMenu('tools')}
              onClick={() => setOpenMenu((m) => (m === 'tools' ? null : 'tools'))}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#131C2E] dark:hover:text-[#F8FAFC]"
            >
              <span>{dict.nav.tools}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${openMenu === 'tools' ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {openMenu === 'tools' ? (
              <div className="viewora-card-elevated animate-viewora-enter absolute top-full left-0 mt-1.5 w-[560px] rounded-2xl p-4">
                <div className="mb-2.5 flex items-center justify-between px-2">
                  <span className="text-[11px] font-bold tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
                    12 Free Instagram Tools
                  </span>
                  <Link
                    href={`/${locale}/tools`}
                    onClick={() => setOpenMenu(null)}
                    className="text-xs font-semibold text-[#64748B] hover:text-[#6941EF] dark:text-[#94A3B8]"
                  >
                    View directory →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {FREE_TOOLS.map((tool) => (
                    <Link
                      key={tool.slug}
                      href={`/${locale}/${tool.slug}`}
                      onClick={() => setOpenMenu(null)}
                      className="rounded-xl p-2.5 transition hover:bg-slate-100 dark:hover:bg-[#192337]"
                    >
                      <span className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                        {tool.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {tool.category}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Solutions Dropdown */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={openMenu === 'solutions'}
              onMouseEnter={() => setOpenMenu('solutions')}
              onClick={() => setOpenMenu((m) => (m === 'solutions' ? null : 'solutions'))}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#131C2E] dark:hover:text-[#F8FAFC]"
            >
              <span>Solutions</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${openMenu === 'solutions' ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {openMenu === 'solutions' ? (
              <div className="viewora-card-elevated animate-viewora-enter absolute top-full left-0 mt-1.5 w-80 rounded-2xl p-3">
                {[
                  {
                    icon: User,
                    title: 'Personal Users',
                    desc: 'Privacy-first public profile viewing & quick calculators',
                    href: `/${locale}/register`,
                  },
                  {
                    icon: Building2,
                    title: 'Business & Creators',
                    desc: 'Competitor benchmarking, growth trends & Gemini AI reports',
                    href: `/${locale}/pricing`,
                  },
                  {
                    icon: Users,
                    title: 'Marketing Agencies',
                    desc: 'Multi-client workspaces, team seats & branded reports',
                    href: `/${locale}/dashboard`,
                  },
                ].map((sol) => {
                  const Icon = sol.icon;
                  return (
                    <Link
                      key={sol.title}
                      href={sol.href}
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-slate-100 dark:hover:bg-[#192337]"
                    >
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                          {sol.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          {sol.desc}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          <Link
            href={`/${locale}/pricing`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#131C2E] dark:hover:text-[#F8FAFC]"
          >
            {dict.nav.pricing}
          </Link>
          <Link
            href={`/${locale}/blog`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#131C2E] dark:hover:text-[#F8FAFC]"
          >
            Resources
          </Link>
          <Link
            href={`/${locale}/dashboard`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#131C2E] dark:hover:text-[#F8FAFC]"
          >
            {dict.nav.dashboard}
          </Link>
        </nav>

        {/* Right Controls */}
        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <button
            type="button"
            onClick={triggerCommandPalette}
            aria-label="Open command palette (Ctrl+K)"
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-[#64748B] transition hover:border-[#7957FF]/50 hover:text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden 2xl:inline">Quick jump</span>
            <kbd className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:border-[#263047] dark:bg-[#080D19] dark:text-slate-400">
              <Command className="h-2.5 w-2.5" aria-hidden="true" />K
            </kbd>
          </button>
          <LocaleSwitcher currentLocale={locale} label={dict.nav.language} />
          <ThemeToggle label={dict.nav.theme} />
          <Link
            href={`/${locale}/login`}
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-[#0F172A] transition hover:bg-slate-100 dark:text-[#F8FAFC] dark:hover:bg-[#131C2E]"
          >
            {dict.nav.signIn}
          </Link>
          <Link
            href={`/${locale}/register`}
            className="viewora-btn-primary whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold shadow-sm"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Actions */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={triggerCommandPalette}
            aria-label="Open quick search"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
          <ThemeToggle label={dict.nav.theme} />
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
          >
            {mobileOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Accessible Mobile Drawer */}
      {mobileOpen ? (
        <div className="animate-viewora-enter border-t border-slate-200 bg-white px-4 py-5 shadow-lg dark:border-[#263047] dark:bg-[#080D19] lg:hidden">
          <nav aria-label="Mobile navigation" className="grid gap-1">
            {[
              { href: `/${locale}`, label: 'Explore' },
              { href: `/${locale}/tools`, label: `12 ${dict.nav.tools}` },
              { href: `/${locale}/pricing`, label: dict.nav.pricing },
              { href: `/${locale}/blog`, label: 'Resources' },
              { href: `/${locale}/dashboard`, label: dict.nav.dashboard },
              { href: `/${locale}/dashboard/profile`, label: 'My Profile HQ' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#0F172A] hover:bg-slate-100 dark:text-[#F8FAFC] dark:hover:bg-[#131C2E]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-[#263047]">
            <LocaleSwitcher currentLocale={locale} label={dict.nav.language} />
            <Link
              href={`/${locale}/login`}
              onClick={() => setMobileOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-[#263047] dark:text-slate-200"
            >
              {dict.nav.signIn}
            </Link>
            <Link
              href={`/${locale}/register`}
              onClick={() => setMobileOpen(false)}
              className="viewora-btn-primary rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Get Started
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
