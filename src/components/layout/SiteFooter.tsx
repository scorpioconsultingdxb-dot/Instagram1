import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { VieworaLogo } from '@/components/brand/VieworaLogo';

export function SiteFooter({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-[#263047] dark:bg-[#080D19]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-5">
          <div className="md:col-span-2">
            <VieworaLogo size={32} showTagline />
            <p className="mt-3 max-w-md text-sm text-[#64748B] dark:text-[#94A3B8]">
              {dict.footer.description}
            </p>
            <p className="mt-3 max-w-md rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#94A3B8]">
              {dict.footer.transparencyNote}
            </p>
          </div>

          <div>
            <h2 className="text-xs font-bold tracking-wider text-[#0F172A] uppercase dark:text-[#F8FAFC]">
              {dict.footer.productHeading}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
              <li>
                <Link href={`/${locale}/tools`} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
                  12 Free Tools
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/pricing`} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
                  {dict.nav.pricing}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/dashboard`} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
                  {dict.nav.dashboard}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/blog`} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
                  Resources &amp; Guides
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold tracking-wider text-[#0F172A] uppercase dark:text-[#F8FAFC]">
              Company
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
              <li>
                <Link href={`/${locale}/about`} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
                  About Viewora
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/faq`} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/contact`} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
                  Contact
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/responsible-use`} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
                  Responsible Use
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-bold tracking-wider text-[#0F172A] uppercase dark:text-[#F8FAFC]">
              {dict.footer.legalHeading}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
              <li>
                <Link href={`/${locale}/data-transparency`} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
                  {dict.footer.dataTransparency}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/privacy`} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
                  {dict.footer.privacyPolicy}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
                  {dict.footer.termsOfService}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/cookies`} className="hover:text-[#6941EF] dark:hover:text-[#A99AFF]">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-slate-200 pt-6 text-xs text-[#64748B] dark:border-[#263047] dark:text-[#94A3B8] sm:flex-row sm:items-center">
          <p>{dict.footer.copyright}</p>
          <p>{dict.trust.demoPricingNotice}</p>
        </div>
      </div>
    </footer>
  );
}
