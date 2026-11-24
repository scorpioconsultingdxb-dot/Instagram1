import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type Locale,
} from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { getDemoFixtureUsernames } from '@/lib/providers';
import { getAllToolSlugs, getToolBySlug } from '@/lib/tools/catalog';
import { getAllInfoPageSlugs, getInfoPageBySlug } from '@/lib/public/info-pages';
import { ToolPageView } from '@/components/tools/ToolPageView';
import { ContactForm } from '@/components/public/ContactForm';

export function generateStaticParams() {
  const slugs = [...getAllToolSlugs(), ...getAllInfoPageSlugs()];
  const params: Array<{ locale: Locale; slug: string }> = [];
  for (const locale of SUPPORTED_LOCALES) {
    for (const slug of slugs) {
      params.push({ locale, slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  const tool = getToolBySlug(slug);
  if (tool) {
    return buildPageMetadata({
      locale: safeLocale,
      path: `/${tool.slug}`,
      title: tool.seoTitle,
      description: tool.seoDescription,
    });
  }

  const info = getInfoPageBySlug(slug);
  if (info) {
    return buildPageMetadata({
      locale: safeLocale,
      path: `/${info.slug}`,
      title: info.title,
      description: info.description,
    });
  }

  return { title: 'Not Found' };
}

export default async function PublicSlugPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const dict = getDictionary(safeLocale);

  const tool = getToolBySlug(slug);
  if (tool) {
    return (
      <ToolPageView
        tool={tool}
        locale={safeLocale}
        dict={dict}
        sampleHandles={getDemoFixtureUsernames()}
      />
    );
  }

  const info = getInfoPageBySlug(slug);
  if (!info) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <span className="inline-block rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-[#7957FF] dark:bg-violet-950 dark:text-[#A99AFF]">
        {info.badge}
      </span>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
        {info.title}
      </h1>
      <p className="mt-2 text-base text-[#64748B] dark:text-slate-300">{info.description}</p>

      {info.isLegalDraft ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>Draft Notice:</strong> This legal document is a structured template prepared for
            commercial launch and requires review by qualified legal counsel before production
            enforcement.
          </p>
        </div>
      ) : null}

      <div className="mt-8 space-y-6">
        {info.sections.map((section) => (
          <section
            key={section.heading}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]"
          >
            <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">{section.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#64748B] dark:text-slate-300">
              {section.body}
            </p>
          </section>
        ))}

        {info.slug === 'contact' ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
            <ContactForm />
          </section>
        ) : null}
      </div>
    </div>
  );
}
