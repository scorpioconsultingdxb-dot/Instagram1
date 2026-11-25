'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ChevronDown,
  Command,
  LayoutDashboard,
  Menu,
  Search,
  Shield,
  User,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { PlanCode } from '@/lib/entitlements/types';
import { FREE_TOOLS } from '@/lib/tools/catalog';
import { VieworaLogo } from '@/components/brand/VieworaLogo';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { triggerCommandPalette } from '@/components/command/CommandPalette';
import { MembershipBadge } from '@/components/ui/Primitives';

interface HeaderSessionSummary {
  fullName: string;
  planCode: PlanCode;
  isAdmin: boolean;
}

export function SiteHeader({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const pathname = usePathname() || `/${locale}`;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<'tools' | 'solutions' | null>(null);
  const [session, setSession] = useState<HeaderSessionSummary | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { authenticated?: boolean; user?: HeaderSessionSummary } | null) => {
        if (!active) return;
        if (data?.authenticated && data.user) {
          setSession(data.user);
        } else {
          setSession(null);
        }
      })
      .catch(() => {
        // Non-blocking session probe
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href || pathname === `${href}/`;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const navLinkClass = (active: boolean) =>
    `whitespace-nowrap rounded-lg px-2 py-2 text-[13px] xl:px-2.5 xl:text-sm font-medium transition ${
      active
        ? 'bg-violet-50 font-semibold text-[#6941EF] dark:bg-[#192337] dark:text-[#A99AFF]'
        : 'text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#131C2E] dark:hover:text-[#F8FAFC]'
    }`;

  const initials = session?.fullName
    ? session.fullName
        .split(/\s+/)
        .map((s) => s[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'VW';

  return (
    <header
      onMouseLeave={() => setOpenMenu(null)}
      className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-[#263047]/80 dark:bg-[#080D19]/90"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} aria-label="Viewora home" className="shrink-0">
          <VieworaLogo size={32} />
        </Link>

        {/* Desktop Primary Navigation */}
        <nav aria-label="Primary navigation" className="hidden items-center gap-0.5 lg:flex">
          <Link
            href={`/${locale}`}
            aria-current={isActive(`/${locale}`, true) ? 'page' : undefined}
            className={navLinkClass(isActive(`/${locale}`, true))}
          >
            {dict.nav.home}
          </Link>

          {/* Free Tools Mega Dropdown */}
          <div className="relative">
            <button
              type="button"
              aria-expanded={openMenu === 'tools'}
              aria-haspopup="true"
              onMouseEnter={() => setOpenMenu('tools')}
              onClick={() => setOpenMenu((m) => (m === 'tools' ? null : 'tools'))}
              className={`inline-flex items-center gap-1 ${navLinkClass(
                isActive(`/${locale}/tools`) || pathname.includes('/instagram-')
              )}`}
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
                    View all 12 →
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
          <div className="relative hidden xl:block">
            <button
              type="button"
              aria-expanded={openMenu === 'solutions'}
              aria-haspopup="true"
              onMouseEnter={() => setOpenMenu('solutions')}
              onClick={() => setOpenMenu((m) => (m === 'solutions' ? null : 'solutions'))}
              className={`inline-flex items-center gap-1 ${navLinkClass(false)}`}
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
                    title: dict.home.personalTitle,
                    desc: dict.home.personalDesc,
                    href: `/${locale}/register?segment=personal`,
                  },
                  {
                    icon: Building2,
                    title: dict.home.businessTitle,
                    desc: dict.home.businessDesc,
                    href: `/${locale}/pricing`,
                  },
                  {
                    icon: Users,
                    title: dict.home.agencyTitle,
                    desc: dict.home.agencyDesc,
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
                        <span className="mt-0.5 line-clamp-2 block text-[11px] text-[#64748B] dark:text-[#94A3B8]">
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
            aria-current={isActive(`/${locale}/pricing`) ? 'page' : undefined}
            className={navLinkClass(isActive(`/${locale}/pricing`))}
          >
            {dict.nav.pricing}
          </Link>
          <Link
            href={`/${locale}/data-transparency`}
            aria-current={isActive(`/${locale}/data-transparency`) ? 'page' : undefined}
            className={`hidden xl:inline-flex ${navLinkClass(isActive(`/${locale}/data-transparency`))}`}
          >
            {dict.footer.dataTransparency}
          </Link>
          <Link
            href={`/${locale}/dashboard`}
            aria-current={isActive(`/${locale}/dashboard`) ? 'page' : undefined}
            className={navLinkClass(isActive(`/${locale}/dashboard`))}
          >
            {dict.nav.dashboard}
          </Link>
        </nav>

        {/* Right Controls */}
        <div className="hidden shrink-0 items-center gap-1.5 xl:gap-2 lg:flex">
          <button
            type="button"
            onClick={triggerCommandPalette}
            aria-label="Open command palette (Ctrl+K)"
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-[#64748B] transition hover:border-[#7957FF]/50 hover:text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden 2xl:inline">Quick jump</span>
            <kbd className="hidden items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 xl:inline-flex dark:border-[#263047] dark:bg-[#080D19] dark:text-slate-400">
              <Command className="h-2.5 w-2.5" aria-hidden="true" />K
            </kbd>
          </button>
          <LocaleSwitcher currentLocale={locale} label={dict.nav.language} />
          <ThemeToggle label={dict.nav.theme} />

          {session ? (
            <div className="flex items-center gap-1.5">
              {session.isAdmin ? (
                <Link
                  href={`/${locale}/admin`}
                  aria-current={isActive(`/${locale}/admin`) ? 'page' : undefined}
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-2.5 text-xs font-semibold text-[#6941EF] hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/60 dark:text-[#A99AFF]"
                >
                  <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{dict.nav.admin}</span>
                </Link>
              ) : null}
              <Link
                href={`/${locale}/dashboard/profile`}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white pr-2.5 pl-1.5 text-xs font-semibold text-[#0F172A] transition hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#F8FAFC]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[#7957FF] to-[#22D3EE] text-[10px] font-extrabold text-white">
                  {initials}
                </span>
                <span className="max-w-24 truncate">{session.fullName.split(' ')[0]}</span>
                <MembershipBadge planCode={session.planCode} className="hidden xl:inline-flex" />
              </Link>
            </div>
          ) : (
            <>
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
                {dict.nav.getStarted}
              </Link>
            </>
          )}
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
              { href: `/${locale}`, label: dict.nav.home, exact: true },
              { href: `/${locale}/tools`, label: `12 ${dict.nav.tools}` },
              { href: `/${locale}/pricing`, label: dict.nav.pricing },
              { href: `/${locale}/data-transparency`, label: dict.footer.dataTransparency },
              { href: `/${locale}/dashboard`, label: dict.nav.dashboard },
              { href: `/${locale}/dashboard/profile`, label: 'My Profile HQ' },
            ].map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold ${
                    active
                      ? 'bg-violet-50 text-[#6941EF] dark:bg-[#192337] dark:text-[#A99AFF]'
                      : 'text-[#0F172A] hover:bg-slate-100 dark:text-[#F8FAFC] dark:hover:bg-[#131C2E]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-[#263047]">
            <LocaleSwitcher currentLocale={locale} label={dict.nav.language} />
            {session ? (
              <Link
                href={`/${locale}/dashboard`}
                onClick={() => setMobileOpen(false)}
                className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                {session.fullName.split(' ')[0]}&apos;s Workspace
              </Link>
            ) : (
              <>
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
                  {dict.nav.getStarted}
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
