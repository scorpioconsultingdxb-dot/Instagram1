import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import { buildPageMetadata, buildSoftwareApplicationJsonLd } from '@/lib/seo/metadata';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  return buildPageMetadata({
    locale: safeLocale,
    path: '/launch',
    title: 'See Beyond the Profile — Viewora Social Intelligence Launch',
    description:
      'Explore More. Discover More. Viewora is a privacy-first social intelligence workspace for creators, marketers, businesses, and agencies — zero scraping, zero private account access.',
  });
}

const SEGMENTS = [
  {
    name: 'Personal & Curious',
    icon: Users,
    value: 'Explore eligible public profiles and 12 deterministic engagement, cadence, and bio tools with zero Instagram sign-in.',
  },
  {
    name: 'Content Creators',
    icon: Sparkles,
    value: 'Track Reel/Carousel/Image balance, public bio CTA signals, and observed checkpoint trends in one Personal Digital HQ.',
  },
  {
    name: 'Marketing Professionals',
    icon: BarChart3,
    value: 'Run compatibility-checked competitor comparisons that flag mixed sources and never distort averages with missing metrics.',
  },
  {
    name: 'Businesses & Brands',
    icon: ShieldCheck,
    value: 'Organize research folders, private account-isolated notes, and executive briefs backed by independent PostgreSQL RLS.',
  },
  {
    name: 'Agencies & Teams',
    icon: Briefcase,
    value: 'Manage multi-workspace client hubs, export clean binary PDF/CSV reports, and scale with transparent role governance.',
  },
] as const;

export default async function LaunchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const jsonLd = buildSoftwareApplicationJsonLd(safeLocale);

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Campaign Hero */}
      <section className="viewora-card relative overflow-hidden rounded-3xl p-8 sm:p-12">
        <div className="max-w-3xl space-y-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#6941EF] dark:bg-violet-950/70 dark:text-[#A99AFF]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Viewora · Explore More. Discover More.
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-5xl dark:text-white">
            See Beyond the Profile.
          </h1>
          <p className="text-base leading-relaxed text-[#475569] dark:text-[#94A3B8]">
            Viewora is a privacy-first Instagram research, benchmarking, and reporting platform
            engineered for transparent commercial workflows. Zero Instagram password collection.
            Zero private-account scraping. Every metric clearly discloses its provenance and
            capture date.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={`/${safeLocale}/tools`}
              className="viewora-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
            >
              Explore 12 Free Tools
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={`/${safeLocale}/beta`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
            >
              <Lock className="h-4 w-4 text-[#6941EF]" aria-hidden="true" />
              Controlled Beta Access
            </Link>
            <Link
              href={`/${safeLocale}/pricing`}
              className="text-sm font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
            >
              View Membership Plans →
            </Link>
          </div>
        </div>
      </section>

      {/* Honest Availability Matrix */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="viewora-card rounded-2xl p-6">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#0F172A] dark:text-white">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
            Available &amp; Locally Verified Today
          </h2>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#475569] dark:text-[#94A3B8]">
            <li>• 12 deterministic public analytics &amp; calculation tools across 5 languages</li>
            <li>• Personal Digital HQ 3.0, Dashboard 3.0 &amp; Research Workspace Pro</li>
            <li>• Compatibility-checked Competitor Studio &amp; Report Studio 3.0 (<code className="font-mono text-[11px]">%PDF-1.4</code> &amp; CSV)</li>
            <li>• AI Intelligence Studio conversational workspace with transparent deterministic templates</li>
            <li>• Independent PostgreSQL persistence with 24 Row-Level Security isolation policies</li>
          </ul>
        </div>

        <div className="viewora-card rounded-2xl p-6">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#0F172A] dark:text-white">
            <Clock className="h-5 w-5 text-amber-500" aria-hidden="true" />
            Awaiting Explicit Owner Activation (Currently Disabled)
          </h2>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[#475569] dark:text-[#94A3B8]">
            <li>• Live Meta Business Discovery &amp; first-party connected-account OAuth insights</li>
            <li>• Live Google Gemini AI synthesis (deterministic templates clearly labeled today)</li>
            <li>• Live Resend transactional email dispatch (19×5 templates ready)</li>
            <li>• Scheduled external background job runner &amp; paid subscription billing (<code className="font-mono text-[11px]">PAYMENTS_ENABLED=false</code>)</li>
          </ul>
        </div>
      </section>

      {/* 5 Customer Segments */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-white">
          Built for Five Distinct Social Research Workflows
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SEGMENTS.map((seg) => {
            const Icon = seg.icon;
            return (
              <div key={seg.name} className="viewora-card rounded-2xl p-5">
                <Icon className="h-5 w-5 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
                <h3 className="mt-3 font-display text-sm font-bold text-[#0F172A] dark:text-white">
                  {seg.name}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                  {seg.value}
                </p>
              </div>
            );
          })}
          <div className="viewora-card flex flex-col justify-between rounded-2xl border-violet-200 bg-violet-50/50 p-5 dark:border-[#263047] dark:bg-violet-950/20">
            <div>
              <FileText className="h-5 w-5 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
              <h3 className="mt-3 font-display text-sm font-bold text-[#0F172A] dark:text-white">
                Radical Provenance Transparency
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                Zero fabricated reviews, zero fake logos, zero invented follower history. Inspect
                our public Data Transparency policy anytime.
              </p>
            </div>
            <Link
              href={`/${safeLocale}/data-transparency`}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
            >
              Read Data Transparency Policy →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
