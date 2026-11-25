import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Crown,
  GitCompare,
  Layers,
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
import { calculateIntervalPrice } from '@/lib/entitlements/catalog';
import { getConfiguredPlans } from '@/lib/entitlements/service';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { MembershipBadge } from '@/components/ui/Primitives';
import { ProfileSearchExperience } from '@/components/search/ProfileSearchExperience';
import { WorkspaceAnalyticsPreview } from '@/components/home/WorkspaceAnalyticsPreview';

export const dynamic = 'force-dynamic';

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
    title: dict.brand.tagline,
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
  const plans = getConfiguredPlans().filter((p) => p.isActive);

  return (
    <div className="viewora-hero-glow">
      <div className="mx-auto max-w-7xl px-4 pt-10 pb-20 sm:px-6 lg:px-8">
        {/* HERO — Immediate Above-the-Fold Profile Search */}
        <section className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/85 px-3.5 py-1 text-xs font-semibold text-[#6941EF] shadow-2xs backdrop-blur dark:border-[#263047] dark:bg-[#131C2E]/90 dark:text-[#A99AFF]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {dict.home.badge}
          </span>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-5xl lg:text-6xl dark:text-[#F8FAFC]">
            {dict.home.heroTitle}{' '}
            <span className="bg-gradient-to-r from-[#7957FF] via-[#A99AFF] to-[#22D3EE] bg-clip-text text-transparent">
              See Beyond the Profile.
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#64748B] sm:text-lg dark:text-[#94A3B8]">
            {dict.home.heroSubtitle}
          </p>

          {/* Primary Profile Search Bar (Immediately Visible) */}
          <div className="mt-8">
            <ProfileSearchExperience
              locale={safeLocale}
              dict={dict}
              sampleHandles={sampleHandles}
            />
          </div>

          <p className="mt-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
            {dict.home.firstSearchNote}
          </p>

          {/* Clear Three-Tier Product Ladder Anchors */}
          <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
            <a
              href="#free-tools"
              className="viewora-card group rounded-2xl p-4 transition hover:border-[#7957FF]/60"
            >
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-emerald-700 uppercase dark:text-[#34D399]">
                <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                1. Free Forever
              </span>
              <p className="mt-1.5 font-display text-sm font-bold text-[#0F172A] group-hover:text-[#6941EF] dark:text-[#F8FAFC] dark:group-hover:text-[#A99AFF]">
                Public Lookups &amp; 12 Free Tools
              </p>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Deterministic engagement, growth, bio, hashtag, and content calculators with zero sign-up.
              </p>
            </a>

            <a
              href="#professional-analytics"
              className="viewora-card group rounded-2xl p-4 transition hover:border-[#7957FF]/60"
            >
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#0891B2] uppercase dark:text-[#22D3EE]">
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                2. Professional Analytics
              </span>
              <p className="mt-1.5 font-display text-sm font-bold text-[#0F172A] group-hover:text-[#6941EF] dark:text-[#F8FAFC] dark:group-hover:text-[#A99AFF]">
                Persistent Research Workspace
              </p>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Save eligible profiles into folders, inspect interactive trends, and compare peers side by side.
              </p>
            </a>

            <a
              href="#membership-tiers"
              className="viewora-card group rounded-2xl p-4 transition hover:border-[#7957FF]/60"
            >
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
                <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                3. Premium Membership
              </span>
              <p className="mt-1.5 font-display text-sm font-bold text-[#0F172A] group-hover:text-[#6941EF] dark:text-[#F8FAFC] dark:group-hover:text-[#A99AFF]">
                AI Studio, Exports &amp; Agency Teams
              </p>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Up to 365-day lookback, 7 structured AI report types, PDF/CSV exports, and 25 client workspaces.
              </p>
            </a>
          </div>

          {/* Verifiable Product Standards (No fabricated testimonials or fake counts) */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
            {[
              'No Instagram password required',
              dict.trust.noPrivateAccess,
              '12 deterministic & public tools',
              'Explicit data provenance on every card',
            ].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#34D399]" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <ProvenanceBadge dataClass="live" labels={dict.provenance} />
            <ProvenanceBadge dataClass="cached" labels={dict.provenance} />
            <ProvenanceBadge dataClass="estimate" labels={dict.provenance} />
            <ProvenanceBadge dataClass="demo" labels={dict.provenance} />
            <ProvenanceBadge dataClass="unavailable" labels={dict.provenance} />
          </div>
        </section>

        {/* TIER 2 — Interactive Professional Analytics Preview */}
        <div id="professional-analytics" className="scroll-mt-24">
          <WorkspaceAnalyticsPreview locale={safeLocale} dict={dict} />
        </div>

        {/* TIER 1 — 12 Free Tools Grid */}
        <section id="free-tools" className="mt-20 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-emerald-700 uppercase dark:text-[#34D399]">
                <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                Tier 1 · Free Utility Suite (No Sign-Up Required)
              </div>
              <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl dark:text-[#F8FAFC]">
                12 transparent Instagram calculators, analyzers &amp; planners
              </h2>
            </div>
            <Link
              href={`/${safeLocale}/tools`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
            >
              Browse all 12 tools
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FREE_TOOLS.map((tool) => (
              <Link
                key={tool.slug}
                href={`/${safeLocale}/${tool.slug}`}
                className="viewora-card group flex flex-col justify-between rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-[#7957FF]/60"
              >
                <div>
                  <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#64748B] uppercase dark:bg-[#0F172A] dark:text-[#94A3B8]">
                    {tool.category}
                  </span>
                  <h3 className="mt-3 font-display text-sm font-bold text-[#0F172A] group-hover:text-[#6941EF] dark:text-[#F8FAFC] dark:group-hover:text-[#A99AFF]">
                    {tool.name}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                    {tool.shortDescription}
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#6941EF] dark:text-[#A99AFF]">
                  Open tool
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Workflow Architecture & Core Capabilities */}
        <section className="mt-20 grid gap-6 lg:grid-cols-3">
          <div className="viewora-card rounded-2xl p-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              How Viewora Works
            </h2>
            <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
              <li>
                <strong className="text-[#0F172A] dark:text-[#F8FAFC]">1. Normalize &amp; Query:</strong>{' '}
                Paste any handle or profile URL — routed strictly to authorized providers or clearly
                labeled demo fixtures.
              </li>
              <li>
                <strong className="text-[#0F172A] dark:text-[#F8FAFC]">2. Verify Provenance:</strong>{' '}
                Inspect source label, freshness timestamp, and calculation formulas on every card.
              </li>
              <li>
                <strong className="text-[#0F172A] dark:text-[#F8FAFC]">3. Organize &amp; Export:</strong>{' '}
                Save eligible profiles into research folders with private notes and export PDF/CSV
                reports.
              </li>
            </ol>
          </div>

          <div className="viewora-card rounded-2xl p-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              AI Intelligence Studio
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
              Generate 7 structured report types backed by Zod schema validation, prompt-injection
              sandboxing, and cost budgets — always distinguishing Live Gemini outputs from
              Deterministic Template briefs.
            </p>
          </div>

          <div className="viewora-card rounded-2xl p-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-[#22D3EE]">
              <GitCompare className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Competitor &amp; Creator Research
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
              Build persistent comparison projects to evaluate engagement deltas, posting cadence,
              and audience ratios without invented historical rows.
            </p>
          </div>
        </section>

        {/* Customer Segments */}
        <section className="mt-20">
          <div className="text-center">
            <h2 className="font-display text-2xl font-extrabold text-[#0F172A] sm:text-3xl dark:text-[#F8FAFC]">
              {dict.home.segmentsTitle}
            </h2>
            <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
              {dict.home.segmentsSubtitle}
            </p>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: User,
                title: dict.home.personalTitle,
                desc: dict.home.personalDesc,
                tier: 'Free & Starter',
                href: `/${safeLocale}/register?segment=personal`,
              },
              {
                icon: Building2,
                title: dict.home.businessTitle,
                desc: dict.home.businessDesc,
                tier: 'Premium & Pro',
                href: `/${safeLocale}/register?segment=business`,
              },
              {
                icon: Users,
                title: dict.home.agencyTitle,
                desc: dict.home.agencyDesc,
                tier: 'Agency',
                href: `/${safeLocale}/register?segment=agency`,
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className="viewora-card flex flex-col justify-between rounded-2xl p-6"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-[#64748B] dark:bg-[#0F172A] dark:text-[#94A3B8]">
                        {card.tier}
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                      {card.desc}
                    </p>
                  </div>
                  <Link
                    href={card.href}
                    className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                  >
                    Start {card.title.split(' ')[0]} workflow
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {/* TIER 3 — Synchronized 5-Tier Premium Membership Teaser */}
        <section
          id="membership-tiers"
          className="viewora-card mt-20 scroll-mt-24 rounded-3xl p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
                <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                Tier 3 · Membership Ladder (Demo Pricing Only — Payments Disabled)
              </span>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                Start free, scale entitlements when your research grows
              </h2>
            </div>
            <Link
              href={`/${safeLocale}/pricing`}
              className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
            >
              Full comparison &amp; 15% / 30% savings
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {plans.map((p) => {
              const monthly = calculateIntervalPrice(p, 'monthly');
              const annual = calculateIntervalPrice(p, 'annual');
              return (
                <div
                  key={p.code}
                  className={`flex flex-col justify-between rounded-2xl border p-4 ${
                    p.highlighted
                      ? 'border-[#7957FF] bg-violet-50/50 ring-1 ring-[#7957FF]/30 dark:bg-[#192337]'
                      : 'border-slate-200 bg-slate-50/80 dark:border-[#263047] dark:bg-[#0F172A]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <MembershipBadge planCode={p.code} />
                      {p.highlighted ? (
                        <span className="text-[10px] font-bold text-[#6941EF] uppercase dark:text-[#22D3EE]">
                          Popular
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                      {monthly.formattedMonthly}
                      <span className="text-xs font-normal text-[#64748B]">/mo</span>
                    </p>
                    {p.monthlyPriceCents > 0 ? (
                      <p className="mt-0.5 text-[11px] font-medium text-emerald-700 dark:text-[#34D399]">
                        {annual.formattedMonthly}/mo billed annually ({annual.discountPercent}% off)
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        No credit card required
                      </p>
                    )}
                    <ul className="mt-3 space-y-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      <li>• {p.entitlements.tracked_profiles.numericLimit} saved profiles</li>
                      <li>
                        •{' '}
                        {p.entitlements.historical_analytics_days.enabled
                          ? `${p.entitlements.historical_analytics_days.numericLimit}d history`
                          : 'Current snapshot'}
                      </li>
                      <li>• {p.entitlements.ai_profile_reports.numericLimit} AI reports/mo</li>
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
            {dict.trust.demoPricingNotice}
          </p>
        </section>

        {/* Data Transparency & Live Provider Architecture */}
        <section className="viewora-card mt-16 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {dict.home.foundationStatusTitle}
              </h2>
            </div>
            <Link
              href={`/${safeLocale}/data-transparency`}
              className="text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
            >
              Read Data Transparency Policy →
            </Link>
          </div>
          <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
            {dict.trust.publicOnlyBody}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {providerHealth.map((item) => (
              <div
                key={item.providerId}
                className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#263047] dark:bg-[#0F172A]"
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {item.providerLabel}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      item.status === 'healthy'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-[#34D399]'
                        : 'bg-slate-200 text-slate-700 dark:bg-[#192337] dark:text-[#94A3B8]'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  {item.message}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Honest FAQ */}
        <section className="mt-16">
          <h2 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
            Frequently Asked Questions
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              [
                'Do I need to enter my Instagram password?',
                'Never. Viewora never requests Instagram passwords or session cookies. Connecting your own professional account uses official Meta OAuth.',
              ],
              [
                'Can Viewora view private Instagram accounts?',
                'No. We strictly respect Instagram privacy settings and never access or bypass private accounts.',
              ],
              [
                'How are live data, estimates, and demos distinguished?',
                'Every result card, chart, and export is stamped with an explicit provenance badge (LIVE, CACHED, ESTIMATED, DEMO, or UNAVAILABLE) and source timestamp.',
              ],
              [
                'Are subscription payments enabled right now?',
                'No. All plans are shown for demonstration only while server-side payments remain strictly disabled (PAYMENTS_ENABLED=false).',
              ],
            ].map(([q, a]) => (
              <div key={q} className="viewora-card rounded-2xl p-5">
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">{q}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                  {a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Final Conversion Banner */}
        <section className="mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-[#080D19] via-[#131C2E] to-[#1E1B4B] p-8 text-center text-white shadow-xl sm:p-12">
          <h2 className="font-display text-2xl font-extrabold sm:text-4xl">
            See beyond surface metrics.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
            Start with 12 free Instagram calculators and analyzers today or create your personal
            Viewora workspace — zero credit card required.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/${safeLocale}/register`}
              className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-6 py-3 text-sm font-semibold shadow-md"
            >
              {dict.nav.getStarted}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={`/${safeLocale}/tools`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Explore 12 Free Tools
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
