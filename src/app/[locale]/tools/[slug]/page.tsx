import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
import { ToolPageView } from '@/components/tools/ToolPageView';

export function generateStaticParams() {
  const params: Array<{ locale: Locale; slug: string }> = [];
  for (const locale of SUPPORTED_LOCALES) {
    for (const slug of getAllToolSlugs()) {
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
  if (!tool) return { title: 'Tool Not Found' };

  return buildPageMetadata({
    locale: safeLocale,
    path: `/${tool.slug}`,
    title: tool.seoTitle,
    description: tool.seoDescription,
  });
}

export default async function LegacyToolDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  const dict = getDictionary(safeLocale);
  return (
    <ToolPageView
      tool={tool}
      locale={safeLocale}
      dict={dict}
      sampleHandles={getDemoFixtureUsernames()}
    />
  );
}
