import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';

export function SiteFooter({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-[#080D19]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-bold text-[#0F172A] dark:text-white">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#7957FF] to-[#22D3EE] text-white">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span>{dict.brand.name}</span>
              <span className="text-xs font-normal text-[#64748B] dark:text-slate-400">
                · Explore More. Discover More.
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm text-[#64748B] dark:text-slate-400">
              {dict.footer.description}
            </p>
            <p className="mt-3 max-w-md rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-[#131C2E] dark:text-slate-400">
              {dict.footer.transparencyNote}
            </p>
          </div>

          <div>
            <h2 className="text-xs font-semibold tracking-wider text-slate-900 uppercase dark:text-slate-100">
              {dict.footer.productHeading}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[#64748B] dark:text-slate-400">
              <li>
                <Link href={`/${locale}/tools`} className="hover:text-[#7957FF] dark:hover:text-[#A99AFF]">
                  12 Free Tools
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/pricing`} className="hover:text-[#7957FF] dark:hover:text-[#A99AFF]">
                  {dict.nav.pricing}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/dashboard`} className="hover:text-[#7957FF] dark:hover:text-[#A99AFF]">
                  {dict.nav.dashboard}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/blog`} className="hover:text-[#7957FF] dark:hover:text-[#A99AFF]">
                  Blog &amp; Guides
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold tracking-wider text-slate-900 uppercase dark:text-slate-100">
              Company
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[#64748B] dark:text-slate-400">
              <li>
                <Link href={`/${locale}/about`} className="hover:text-[#7957FF] dark:hover:text-[#A99AFF]">
                  About Viewora
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/faq`} className="hover:text-[#7957FF] dark:hover:text-[#A99AFF]">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/contact`} className="hover:text-[#7957FF] dark:hover:text-[#A99AFF]">
                  Contact
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/responsible-use`} className="hover:text-[#7957FF] dark:hover:text-[#A99AFF]">
                  Responsible Use
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold tracking-wider text-slate-900 uppercase dark:text-slate-100">
              {dict.footer.legalHeading}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[#64748B] dark:text-slate-400">
              <li>
                <Link href={`/${locale}/data-transparency`} className="hover:text-[#7957FF] dark:hover:text-[#A99AFF]">
                  {dict.footer.dataTransparency}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/privacy`} className="hover:text-[#7957FF] dark:hover:text-[#A99AFF]">
                  {dict.footer.privacyPolicy}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="hover:text-[#7957FF] dark:hover:text-[#A99AFF]">
                  {dict.footer.termsOfService}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/cookies`} className="hover:text-[#7957FF] dark:hover:text-[#A99AFF]">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center">
          <p>{dict.footer.copyright}</p>
          <p>{dict.trust.demoPricingNotice}</p>
        </div>
      </div>
    </footer>
  );
}
