import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { FREE_TOOLS } from '@/lib/tools/catalog';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const dict = getDictionary(safeLocale);

  return buildPageMetadata({
    locale: safeLocale,
    path: '/tools',
    title: `${dict.nav.tools} — Viewora`,
    description:
      'Explore 10 free Instagram analytics, profile lookup, bio optimization, hashtag, and benchmarking tools built with transparent data standards.',
  });
}

export default async function ToolsDirectoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const dict = getDictionary(safeLocale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-[#7957FF] dark:bg-violet-950 dark:text-[#A99AFF]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          12 Free SEO Tools
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {dict.nav.tools}
        </h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
          Every Viewora tool runs transparent formulas or queries authorized public/demo providers —
          never fabricating live Instagram metrics or claiming private-account access.
        </p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FREE_TOOLS.map((tool, index) => (
          <Link
            key={tool.slug}
            href={`/${safeLocale}/${tool.slug}`}
            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {tool.category}
                </span>
                <span className="font-mono text-xs text-slate-400">#{index + 1}</span>
              </div>
              <h2 className="mt-3 text-lg font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                {tool.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {tool.shortDescription}
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              Launch tool
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
