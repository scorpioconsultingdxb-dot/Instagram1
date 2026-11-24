import Link from 'next/link';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { FREE_TOOLS, type ToolDefinition } from '@/lib/tools/catalog';
import { ToolWorkspace } from '@/components/tools/ToolWorkspace';

export function ToolPageView({
  tool,
  locale,
  dict,
  sampleHandles,
}: {
  tool: ToolDefinition;
  locale: Locale;
  dict: Dictionary;
  sampleHandles: string[];
}) {
  const relatedTools = FREE_TOOLS.filter((t) => t.slug !== tool.slug).slice(0, 4);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    description: tool.seoDescription,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href={`/${locale}/tools`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#7957FF] dark:text-slate-400 dark:hover:text-[#A99AFF]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        All 12 Free Tools
      </Link>

      <header className="mt-4">
        <span className="inline-block rounded-full bg-violet-50 px-3 py-0.5 text-xs font-semibold text-[#7957FF] dark:bg-violet-950 dark:text-[#A99AFF]">
          {tool.category}
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
          {tool.name}
        </h1>
        <p className="mt-2 text-base text-[#64748B] dark:text-slate-300">
          {tool.shortDescription}
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
        <ToolWorkspace
          slug={tool.slug}
          locale={locale}
          dict={dict}
          sampleHandles={sampleHandles}
        />
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-[#131C2E]/70 dark:text-slate-400">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#7957FF]" aria-hidden="true" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">
              Methodology &amp; Data Limitations
            </p>
            <p className="mt-1">{tool.dataDisclosure}</p>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#131C2E]">
        <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">How to get the most from this tool</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#64748B] dark:text-slate-300">
          {tool.educationalBody}
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-6 dark:border-violet-900/60 dark:from-violet-950/30 dark:to-[#131C2E]">
        <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">
          Unlock historical snapshots, competitor sets &amp; Gemini AI reports
        </h2>
        <p className="mt-1.5 text-sm text-[#64748B] dark:text-slate-300">
          Create a free Viewora account to save eligible public profiles and explore Starter,
          Premium, Pro, and Agency capabilities.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/${locale}/register`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7957FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6441f5]"
          >
            Create Free Account
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#080D19] dark:text-slate-200"
          >
            Compare Plans
          </Link>
        </div>
      </section>

      {tool.faqs.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-bold text-[#0F172A] dark:text-white">
            Frequently Asked Questions
          </h2>
          <dl className="mt-4 space-y-3">
            {tool.faqs.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#131C2E]"
              >
                <dt className="text-sm font-semibold text-slate-900 dark:text-white">{item.q}</dt>
                <dd className="mt-1.5 text-sm text-[#64748B] dark:text-slate-300">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          Related Free Tools
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {relatedTools.map((rel) => (
            <Link
              key={rel.slug}
              href={`/${locale}/${rel.slug}`}
              className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs font-semibold text-slate-800 hover:border-[#7957FF] hover:text-[#7957FF] dark:border-slate-800 dark:bg-[#131C2E] dark:text-slate-200"
            >
              {rel.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
