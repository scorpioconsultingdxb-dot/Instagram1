'use client';

import Link from 'next/link';
import { Menu, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function SiteHeader({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: `/${locale}`, label: dict.nav.home },
    { href: `/${locale}/tools`, label: dict.nav.tools },
    { href: `/${locale}/pricing`, label: dict.nav.pricing },
    { href: `/${locale}/blog`, label: 'Resources' },
    { href: `/${locale}/dashboard`, label: dict.nav.dashboard },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800/80 dark:bg-[#080D19]/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2.5 font-bold tracking-tight text-[#0F172A] dark:text-white"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#7957FF] to-[#22D3EE] text-white shadow-sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-lg">{dict.brand.name}</span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-6 md:flex">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[#64748B] transition hover:text-[#7957FF] dark:text-slate-300 dark:hover:text-[#A99AFF]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          <LocaleSwitcher currentLocale={locale} label={dict.nav.language} />
          <ThemeToggle label={dict.nav.theme} />
          <Link
            href={`/${locale}/login`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#131C2E]"
          >
            {dict.nav.signIn}
          </Link>
          <Link
            href={`/${locale}/register`}
            className="rounded-xl bg-[#7957FF] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6441f5]"
          >
            {dict.nav.getStarted}
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle label={dict.nav.theme} />
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-[#131C2E] dark:text-slate-200"
          >
            {mobileOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-[#080D19] md:hidden">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1.5">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#131C2E]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <LocaleSwitcher currentLocale={locale} label={dict.nav.language} />
            <Link
              href={`/${locale}/login`}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              {dict.nav.signIn}
            </Link>
            <Link
              href={`/${locale}/register`}
              onClick={() => setMobileOpen(false)}
              className="rounded-xl bg-[#7957FF] px-3.5 py-2 text-sm font-semibold text-white"
            >
              {dict.nav.getStarted}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
