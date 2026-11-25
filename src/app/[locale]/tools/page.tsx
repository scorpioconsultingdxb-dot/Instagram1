import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { ToolsDirectoryClient } from '@/components/tools/ToolsDirectoryClient';

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
    title: `12 ${dict.nav.tools}`,
    description: dict.tools.directorySubtitle,
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
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" data-page-ready="tools-directory">
      <div className="max-w-3xl">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-[#6941EF] dark:border-violet-800/60 dark:bg-violet-950/60 dark:text-[#A99AFF]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {dict.tools.directoryBadge}
        </span>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl dark:text-[#F8FAFC]">
          {dict.nav.tools}
        </h1>
        <p className="mt-2.5 text-base leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
          {dict.tools.directorySubtitle}
        </p>
      </div>

      <div className="mt-8">
        <ToolsDirectoryClient locale={safeLocale} dict={dict} />
      </div>
    </div>
  );
}
