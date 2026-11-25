import Link from 'next/link';
import { ArrowRight, Calculator, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { FREE_TOOLS, type ToolDefinition } from '@/lib/tools/catalog';
import { Breadcrumbs, UpgradePreviewCard } from '@/components/ui/Primitives';
import { ToolWorkspace } from '@/components/tools/ToolWorkspace';

const PREMIUM_PREVIEWS: Record<
  ToolDefinition['category'],
  { title: string; description: string; tier: string }
> = {
  Viewer: {
    title: 'Save eligible profiles & track longitudinal checkpoints',
    description:
      'Move beyond one-off lookups: organize saved accounts into research folders, add private strategy notes, and review historical snapshots inside your workspace.',
    tier: 'Starter+ Plan',
  },
  Analytics: {
    title: 'Automated historical charts, 7 AI reports & PDF/CSV exports',
    description:
      'Pair your manual calculations with multi-checkpoint growth curves, engagement rate trendlines, and provenance-stamped PDF or CSV exports.',
    tier: 'Premium+ Plan',
  },
  Optimization: {
    title: 'Turn bio and hashtag audits into a repeatable AI content audit',
    description:
      'Run structured Social Media Audit and Content Strategy reports inside the AI Intelligence Studio and save notes per client workspace.',
    tier: 'Starter+ Plan',
  },
  Research: {
    title: 'Persistent multi-account competitor projects & team sharing',
    description:
      'Save competitor comparison projects across up to 30 tracked profiles with side-by-side engagement deltas, cadence tracking, and executive summaries.',
    tier: 'Premium / Pro / Agency',
  },
  Creation: {
    title: 'Pair content planning with structured AI Content Strategy briefs',
    description:
      'Generate full weekly executive summaries and audience-aligned publishing roadmaps inside the Viewora workspace.',
    tier: 'Starter+ Plan',
  },
};

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
  const sameCategory = FREE_TOOLS.filter(
    (t) => t.slug !== tool.slug && t.category === tool.category
  );
  const otherCategory = FREE_TOOLS.filter(
    (t) => t.slug !== tool.slug && t.category !== tool.category
  );
  const relatedTools = [...sameCategory, ...otherCategory].slice(0, 4);

  const preview = PREMIUM_PREVIEWS[tool.category];
  const tt = dict.tools;

  const categoryLabel = (cat: ToolDefinition['category']) => {
    switch (cat) {
      case 'Viewer':
        return tt.categoryViewer;
      case 'Analytics':
        return tt.categoryAnalytics;
      case 'Optimization':
        return tt.categoryOptimization;
      case 'Research':
        return tt.categoryResearch;
      case 'Creation':
        return tt.categoryCreation;
    }
  };

  const modeBadge =
    tool.mode === 'functional_calculator'
      ? { label: tt.modeCalculator, icon: Calculator }
      : tool.mode === 'authorized_status_check'
        ? { label: tt.modeStatusCheck, icon: Lock }
        : { label: tt.modeProvider, icon: Sparkles };
  const ModeIcon = modeBadge.icon;

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

      <Breadcrumbs
        items={[
          { label: dict.nav.home, href: `/${locale}` },
          { label: `12 ${dict.nav.tools}`, href: `/${locale}/tools` },
          { label: tool.name },
        ]}
      />

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-block rounded-full bg-violet-50 px-3 py-0.5 text-xs font-bold text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
            {categoryLabel(tool.category)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-0.5 text-xs font-semibold text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#94A3B8]">
            <ModeIcon className="h-3 w-3 text-[#22D3EE]" aria-hidden="true" />
            {modeBadge.label}
          </span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl dark:text-[#F8FAFC]">
          {tool.name}
        </h1>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
          {tool.shortDescription}
        </p>
      </header>

      <section className="viewora-card-elevated mt-8 rounded-3xl p-5 sm:p-7">
        <ToolWorkspace
          slug={tool.slug}
          locale={locale}
          dict={dict}
          sampleHandles={sampleHandles}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E]/80 dark:text-[#94A3B8]">
        <div className="flex items-start gap-2.5">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-[#6941EF] dark:text-[#A99AFF]"
            aria-hidden="true"
          />
          <div>
            <p className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">{tt.disclosureTitle}</p>
            <p className="mt-1 leading-relaxed">{tool.dataDisclosure}</p>
          </div>
        </div>
      </section>

      <section className="viewora-card mt-8 rounded-2xl p-6">
        <h2 className="font-display text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
          {tt.howToTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
          {tool.educationalBody}
        </p>
      </section>

      <div className="mt-8">
        <UpgradePreviewCard
          title={preview.title}
          description={preview.description}
          requiredTier={preview.tier}
          ctaHref={`/${locale}/pricing`}
          ctaLabel={tt.comparePlansCta}
        />
      </div>

      {tool.faqs.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            {tt.faqTitle}
          </h2>
          <dl className="mt-4 space-y-3">
            {tool.faqs.map((item) => (
              <div key={item.q} className="viewora-card rounded-2xl p-5">
                <dt className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">{item.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="mt-10">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold tracking-wider text-[#64748B] uppercase dark:text-[#94A3B8]">
            {tt.relatedTitle}
          </h2>
          <Link
            href={`/${locale}/tools`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
          >
            {tt.allTwelveTools}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {relatedTools.map((rel) => (
            <Link
              key={rel.slug}
              href={`/${locale}/${rel.slug}`}
              className="viewora-card group flex flex-col justify-between rounded-2xl p-4 transition hover:border-[#7957FF]/60"
            >
              <div>
                <span className="text-[10px] font-bold tracking-wide text-[#64748B] uppercase dark:text-[#94A3B8]">
                  {categoryLabel(rel.category)}
                </span>
                <p className="mt-1 text-xs font-bold text-[#0F172A] group-hover:text-[#6941EF] dark:text-[#F8FAFC] dark:group-hover:text-[#A99AFF]">
                  {rel.name}
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#6941EF] dark:text-[#A99AFF]">
                {tt.openShort} <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
