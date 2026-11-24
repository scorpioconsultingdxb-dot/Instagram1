import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  GitCompare,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import { isSupportedLocale, DEFAULT_LOCALE, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { defaultProviderRegistry, getDemoFixtureUsernames } from '@/lib/providers';
import { FREE_TOOLS } from '@/lib/tools/catalog';
import { INITIAL_PLANS, formatUsdCents } from '@/lib/entitlements/catalog';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { ProfileSearchExperience } from '@/components/search/ProfileSearchExperience';

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
    path: '',
    title: `${dict.brand.name} — Explore More. Discover More.`,
    description: dict.home.heroSubtitle,
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const dict = getDictionary(safeLocale);
  const providerHealth = await defaultProviderRegistry.checkAllHealth();
  const sampleHandles = getDemoFixtureUsernames();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* 1 & 2. Hero + Prominent Username Search */}
      <section className="mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3.5 py-1 text-xs font-semibold text-[#7957FF] dark:border-violet-900 dark:bg-violet-950/70 dark:text-[#A99AFF]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {dict.home.badge}
        </span>

        <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-5xl lg:text-6xl dark:text-white">
          Explore More.{' '}
          <span className="bg-gradient-to-r from-[#7957FF] to-[#22D3EE] bg-clip-text text-transparent">
            Discover More.
          </span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-base text-[#64748B] sm:text-lg dark:text-slate-300">
          {dict.home.heroSubtitle}
        </p>

        <div className="mt-8">
          <ProfileSearchExperience
            locale={safeLocale}
            dict={dict}
            sampleHandles={sampleHandles}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/${safeLocale}/tools`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:border-[#7957FF] dark:border-slate-700 dark:bg-[#131C2E] dark:text-slate-100"
          >
            Explore Free Tools
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link
            href={`/${safeLocale}/data-transparency`}
            className="text-xs font-semibold text-[#64748B] hover:text-[#7957FF] dark:text-slate-400"
          >
            Read our Data Transparency Standard →
          </Link>
        </div>

        {/* Trust strip */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[#64748B] dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            No Instagram password required
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            Privacy-first design
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            12 free tools available
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            Public and authorized data only
          </span>
        </div>

        {/* Provenance Legend */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <ProvenanceBadge dataClass="live" labels={dict.provenance} />
          <ProvenanceBadge dataClass="cached" labels={dict.provenance} />
          <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
          <ProvenanceBadge dataClass="demo" labels={dict.provenance} />
          <ProvenanceBadge dataClass="unavailable" labels={dict.provenance} />
        </div>
      </section>

      {/* 3. Interactive Product Preview */}
      <section className="mt-16 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold tracking-wider text-[#7957FF] uppercase">
              Product Preview
            </span>
            <h2 className="mt-1 text-2xl font-bold text-[#0F172A] dark:text-white">
              Structured 6-Tab Profile Intelligence
            </h2>
          </div>
          <ProvenanceBadge dataClass="demo" labels={dict.provenance} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ['Overview', 'Public bio, verified status & follower balance'],
            ['Public Content', 'Recent posts, Reels & format mix'],
            ['Growth', 'Recorded snapshot velocity & lookback charts'],
            ['Engagement', 'ER by followers, reach & tier benchmarks'],
            ['AI Insights', 'Structured Gemini reports with citations'],
            ['Reports', 'Viewora-branded PDF & CSV exports'],
          ].map(([tab, desc]) => (
            <div
              key={tab}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-[#080D19]"
            >
              <p className="text-xs font-bold text-[#7957FF]">{tab}</p>
              <p className="mt-1 text-[11px] text-[#64748B] dark:text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. 12 Free Tools Grid */}
      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wider text-[#7957FF] uppercase">
              <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
              12 Free Tools
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#0F172A] dark:text-white">
              Actionable Free Instagram Tools — No Login Needed
            </h2>
          </div>
          <Link
            href={`/${safeLocale}/tools`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#7957FF] hover:underline"
          >
            View all 12 tools
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FREE_TOOLS.map((tool) => (
            <Link
              key={tool.slug}
              href={`/${safeLocale}/${tool.slug}`}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#7957FF] dark:border-slate-800 dark:bg-[#131C2E]"
            >
              <div>
                <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-[#080D19] dark:text-slate-300">
                  {tool.category}
                </span>
                <h3 className="mt-2.5 text-sm font-bold text-[#0F172A] group-hover:text-[#7957FF] dark:text-white dark:group-hover:text-[#A99AFF]">
                  {tool.name}
                </h3>
                <p className="mt-1.5 text-xs text-[#64748B] dark:text-slate-400">
                  {tool.shortDescription}
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#7957FF] dark:text-[#A99AFF]">
                Open tool
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 5 & 6. Premium Features + How It Works */}
      <section className="mt-16 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
          <span className="text-xs font-semibold tracking-wider text-[#7957FF] uppercase">
            How Viewora Works
          </span>
          <h2 className="mt-1 text-xl font-bold text-[#0F172A] dark:text-white">
            From Free Lookup to Verified Intelligence
          </h2>
          <ol className="mt-4 space-y-3 text-sm text-[#64748B] dark:text-slate-300">
            <li>
              <strong className="text-[#0F172A] dark:text-white">1. Search or Calculate Free:</strong>{' '}
              Enter any public handle, Instagram URL, or run one of 12 calculators immediately.
            </li>
            <li>
              <strong className="text-[#0F172A] dark:text-white">2. Inspect Provenance:</strong>{' '}
              Review source, timestamp, and confidence labels on every single metric.
            </li>
            <li>
              <strong className="text-[#0F172A] dark:text-white">3. Save &amp; Automate:</strong>{' '}
              Track eligible accounts in your dashboard with scheduled refreshes, AI reports, and PDF/CSV exports.
            </li>
          </ol>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
          <span className="text-xs font-semibold tracking-wider text-cyan-600 uppercase dark:text-[#22D3EE]">
            Premium Capabilities
          </span>
          <h2 className="mt-1 text-xl font-bold text-[#0F172A] dark:text-white">
            Built for Serious Social Intelligence
          </h2>
          <ul className="mt-4 grid gap-2.5 text-sm text-[#64748B] sm:grid-cols-2 dark:text-slate-300">
            <li>• Historical lookback (30–365 days)</li>
            <li>• Multi-profile competitor sets</li>
            <li>• 7 Gemini AI report types</li>
            <li>• Branded PDF &amp; CSV exports</li>
            <li>• Activity timeline &amp; calendar</li>
            <li>• Multi-workspace agency teams</li>
          </ul>
        </div>
      </section>

      {/* 7. Personal & Professional Use Cases */}
      <section className="mt-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-[#0F172A] dark:text-white">
            {dict.home.segmentsTitle}
          </h2>
          <p className="mt-2 text-sm text-[#64748B] dark:text-slate-400">
            {dict.home.segmentsSubtitle}
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            { icon: User, title: dict.home.personalTitle, desc: dict.home.personalDesc },
            { icon: Building2, title: dict.home.businessTitle, desc: dict.home.businessDesc },
            { icon: Users, title: dict.home.agencyTitle, desc: dict.home.agencyDesc },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-[#7957FF] dark:bg-violet-950 dark:text-[#A99AFF]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#0F172A] dark:text-white">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">{card.desc}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* 8 & 9. AI Intelligence Preview + Competitor Analytics Preview */}
      <section className="mt-16 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm dark:border-violet-900/50 dark:bg-[#131C2E]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#7957FF]" aria-hidden="true" />
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">
                AI Intelligence Preview
              </h2>
            </div>
            <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
          </div>
          <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
            Generate structured Profile Performance, Growth Opportunity, Competitor Comparison,
            Influencer Evaluation, Content Strategy, Audit, and Weekly Executive reports backed by
            schema validation, budget caps, and prompt-injection isolation.
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-200 bg-white p-6 shadow-sm dark:border-cyan-900/50 dark:bg-[#131C2E]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-cyan-600 dark:text-[#22D3EE]" aria-hidden="true" />
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">
                Competitor Analytics Preview
              </h2>
            </div>
            <ProvenanceBadge dataClass="demo" labels={dict.provenance} />
          </div>
          <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
            Benchmark up to 30 saved profiles side by side across follower growth, engagement rate
            deltas, and posting cadence — without ever fabricating missing historical rows.
          </p>
        </div>
      </section>

      {/* 10. Pricing Teaser */}
      <section className="mt-16 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold tracking-wider text-[#7957FF] uppercase">
              Flexible Plans (Demo Pricing)
            </span>
            <h2 className="mt-1 text-2xl font-bold text-[#0F172A] dark:text-white">
              Start Free, Scale When Ready
            </h2>
          </div>
          <Link
            href={`/${safeLocale}/pricing`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#7957FF] hover:underline"
          >
            Full comparison matrix
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {INITIAL_PLANS.map((p) => (
            <div
              key={p.code}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#080D19]"
            >
              <p className="text-sm font-bold text-[#0F172A] dark:text-white">{p.name}</p>
              <p className="mt-1 text-2xl font-extrabold text-[#7957FF]">
                {formatUsdCents(p.monthlyPriceCents)}
                <span className="text-xs font-normal text-slate-500">/mo</span>
              </p>
              <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-slate-400">
                {p.entitlements.tracked_profiles.numericLimit} saved profiles ·{' '}
                {p.entitlements.ai_profile_reports.numericLimit} AI reports/mo
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 11. Privacy, Data Transparency & Provider Status */}
      <section className="mt-16 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#7957FF]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">
              Privacy &amp; Modular Provider Transparency
            </h2>
          </div>
          <Link
            href={`/${safeLocale}/data-transparency`}
            className="text-xs font-semibold text-[#7957FF] hover:underline"
          >
            Inspect Provider Policy →
          </Link>
        </div>
        <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
          {dict.trust.publicOnlyBody}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {providerHealth.map((item) => (
            <div
              key={item.providerId}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#080D19]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {item.providerLabel}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    item.status === 'healthy'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-slate-400">
                {item.message}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 12. FAQ */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white">
          Frequently Asked Questions
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[
            [
              'Do I need to enter my Instagram password?',
              'No. Viewora never asks for Instagram passwords or session cookies. Connecting your own professional account uses official Meta OAuth.',
            ],
            [
              'Can Viewora unlock private Instagram accounts?',
              'No. We strictly respect Instagram privacy controls and never claim access to private accounts.',
            ],
            [
              'Are demo numbers ever shown as live data?',
              'Never. Every card and export displays explicit provenance badges: LIVE, CACHED, ESTIMATED, DEMO, or UNAVAILABLE.',
            ],
            [
              'Can I try Viewora without a credit card?',
              'Yes. All 12 free tools and your free Viewora account require no credit card. Live payments are currently disabled.',
            ],
          ].map(([q, a]) => (
            <div
              key={q}
              className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#131C2E]"
            >
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">{q}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-slate-300">
                {a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 13. Final CTA */}
      <section className="mt-16 rounded-2xl bg-gradient-to-r from-[#080D19] via-[#131C2E] to-[#1e1b4b] p-8 text-center text-white shadow-lg">
        <h2 className="text-2xl font-extrabold sm:text-3xl">
          Ready to explore Instagram performance transparently?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">
          Start with our 12 free tools or create a free Viewora workspace in seconds.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/${safeLocale}/register`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#7957FF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6441f5]"
          >
            Create Free Account
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/${safeLocale}/tools`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20"
          >
            Explore 12 Free Tools
          </Link>
        </div>
      </section>

      {/* Unused icon import safeguard check */}
      <span className="sr-only">
        <BarChart3 aria-hidden="true" />
        <Layers aria-hidden="true" />
        <Lock aria-hidden="true" />
      </span>
    </div>
  );
}
