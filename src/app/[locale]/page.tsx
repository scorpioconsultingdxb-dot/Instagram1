import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  GitCompare,
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
import { MembershipBadge } from '@/components/ui/Primitives';
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
    title: `${dict.brand.name} — See Beyond the Profile`,
    description:
      'Discover public content, understand performance and unlock meaningful social intelligence with Viewora.',
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
    <div className="viewora-hero-glow">
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:px-8">
        {/* Hero — "See Beyond the Profile." */}
        <section className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3.5 py-1 text-xs font-semibold text-[#6941EF] shadow-xs backdrop-blur dark:border-[#263047] dark:bg-[#131C2E]/90 dark:text-[#A99AFF]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Explore More. Discover More. · Privacy-First Social Intelligence
          </span>

          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-5xl lg:text-6xl dark:text-[#F8FAFC]">
            See Beyond{' '}
            <span className="bg-gradient-to-r from-[#7957FF] via-[#A99AFF] to-[#22D3EE] bg-clip-text text-transparent">
              the Profile.
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[#64748B] sm:text-lg dark:text-[#94A3B8]">
            Discover public content, understand performance and unlock meaningful social
            intelligence — without signing into Instagram.
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0F172A] shadow-xs transition hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#F8FAFC]"
            >
              Explore 12 Free Tools
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link
              href={`/${safeLocale}/data-transparency`}
              className="text-xs font-semibold text-[#64748B] hover:text-[#6941EF] dark:text-[#94A3B8] dark:hover:text-[#A99AFF]"
            >
              Data Provenance Standard →
            </Link>
          </div>

          {/* Trust Signals */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
            {[
              'No Instagram password required',
              'Privacy-first design',
              '12 free tools included',
              'Public & authorized data only',
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

        {/* Interactive Workspace Showcase Preview */}
        <section className="viewora-card-elevated mt-16 overflow-hidden rounded-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-[#263047] dark:bg-[#0F172A]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
              <span className="ml-2 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                viewora.app / workspace / intelligence
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ProvenanceBadge dataClass="demo" labels={dict.provenance} />
              <MembershipBadge planCode="premium" />
            </div>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
                    Personal Intelligence Workspace
                  </p>
                  <h2 className="mt-1 font-display text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    One calm workspace for public research, trends &amp; Gemini AI reports
                  </h2>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['@viewora.studio', '48.2K', '4.18% ER', '+17.0% (6m demo)'],
                  ['@aurora.coffee', '19.5K', '5.12% ER', '+20.1% (6m demo)'],
                  ['@nordic.design', '128.4K', '2.94% ER', '+8.4% (6m demo)'],
                ].map(([handle, followers, er, growth]) => (
                  <div
                    key={handle}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]"
                  >
                    <p className="font-mono text-xs font-bold text-[#6941EF] dark:text-[#A99AFF]">
                      {handle}
                    </p>
                    <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                      {followers}
                    </p>
                    <p className="mt-1 text-[11px] font-medium tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                      {er} · <span className="text-emerald-600 dark:text-[#34D399]">{growth}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-cyan-50/40 p-5 dark:border-[#263047] dark:from-[#192337] dark:to-[#0F172A]">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6941EF] dark:text-[#22D3EE]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Personal Digital Headquarters
                </span>
                <p className="mt-2 text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Make Viewora your own research studio
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                  Customize your cover banner, avatar, accent palette, default date range, and
                  private research folders — plus press <kbd className="font-mono">Ctrl+K</kbd>{' '}
                  anywhere to jump instantaneously.
                </p>
              </div>
              <Link
                href={`/${safeLocale}/register`}
                className="viewora-btn-primary mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold"
              >
                Claim Your Free Workspace
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* 12 Free Tools Grid */}
        <section className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
                <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                12 Free SEO Tools
              </div>
              <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl dark:text-[#F8FAFC]">
                Start with useful tools — zero sign-up friction
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
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* How Viewora Works + AI & Competitor Highlights */}
        <section className="mt-20 grid gap-6 lg:grid-cols-3">
          <div className="viewora-card rounded-2xl p-6">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              How Viewora Works
            </h2>
            <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
              <li>
                <strong className="text-[#0F172A] dark:text-[#F8FAFC]">1. Normalize &amp; Query:</strong>{' '}
                Paste any handle or Instagram profile URL — routed only to authorized or demo providers.
              </li>
              <li>
                <strong className="text-[#0F172A] dark:text-[#F8FAFC]">2. Verify Provenance:</strong>{' '}
                Inspect live source, freshness timestamp, and confidence on every metric card.
              </li>
              <li>
                <strong className="text-[#0F172A] dark:text-[#F8FAFC]">3. Organize &amp; Export:</strong>{' '}
                Save eligible profiles into workspaces, track trends, and export branded PDF/CSV reports.
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
              data sandboxing, and USD cost budgets — clearly distinguishing Live Gemini vs.
              Deterministic Template outputs.
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
              Compare engagement deltas, posting cadence, and follower ratios side by side across
              saved accounts without fabricated historical rows.
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
              { icon: User, title: dict.home.personalTitle, desc: dict.home.personalDesc },
              { icon: Building2, title: dict.home.businessTitle, desc: dict.home.businessDesc },
              { icon: Users, title: dict.home.agencyTitle, desc: dict.home.agencyDesc },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="viewora-card rounded-2xl p-6">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                    {card.desc}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Pricing Teaser */}
        <section className="viewora-card mt-20 rounded-3xl p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
                Transparent Membership Tiers (Demo Pricing)
              </span>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                Start free, upgrade only when your team grows
              </h2>
            </div>
            <Link
              href={`/${safeLocale}/pricing`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
            >
              Full comparison &amp; annual savings
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {INITIAL_PLANS.map((p) => (
              <div
                key={p.code}
                className={`rounded-2xl border p-4 ${
                  p.highlighted
                    ? 'border-[#7957FF] bg-violet-50/40 dark:bg-[#192337]'
                    : 'border-slate-200 bg-slate-50 dark:border-[#263047] dark:bg-[#0F172A]'
                }`}
              >
                <MembershipBadge planCode={p.code} />
                <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
                  {formatUsdCents(p.monthlyPriceCents)}
                  <span className="text-xs font-normal text-[#64748B]">/mo</span>
                </p>
                <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  {p.entitlements.tracked_profiles.numericLimit} saved profiles ·{' '}
                  {p.entitlements.ai_profile_reports.numericLimit} AI reports/mo
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Data Transparency & Provider Health */}
        <section className="viewora-card mt-16 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Privacy &amp; Modular Provider Status
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
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#263047] dark:bg-[#0F172A]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
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

        {/* FAQ */}
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
                'No. All plans are shown for demonstration only while payments remain strictly disabled (PAYMENTS_ENABLED=false).',
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
            Explore 12 free Instagram tools today or personalize your Viewora workspace with zero
            credit card required.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/${safeLocale}/register`}
              className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-6 py-3 text-sm font-semibold shadow-md"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={`/${safeLocale}/tools`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Explore Free Tools
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
