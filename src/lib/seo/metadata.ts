import type { Metadata } from 'next';
import {
  DEFAULT_LOCALE,
  LOCALE_METADATA,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/i18n/config';
import { getEnv } from '@/lib/env';

export function buildLocalizedUrl(locale: Locale, path = ''): string {
  const base = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : path ? `/${path}` : '';
  return `${base}/${locale}${cleanPath}`;
}

export function buildHreflangAlternates(path = ''): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const loc of SUPPORTED_LOCALES) {
    languages[LOCALE_METADATA[loc].hreflang] = buildLocalizedUrl(loc, path);
  }
  languages['x-default'] = buildLocalizedUrl(DEFAULT_LOCALE, path);
  return languages;
}

export function buildPageMetadata(params: {
  locale: Locale;
  path?: string;
  title: string;
  description: string;
  noIndex?: boolean;
}): Metadata {
  const { locale, path = '', title, description, noIndex = false } = params;
  const canonical = buildLocalizedUrl(locale, path);

  const normalizedTitle = title.replace(/\s*[—|-]\s*Viewora\s*$/i, '').trim() || 'Viewora';

  return {
    title: normalizedTitle === 'Viewora' ? { absolute: 'Viewora' } : normalizedTitle,
    description,
    alternates: {
      canonical,
      languages: buildHreflangAlternates(path),
    },
    openGraph: {
      title: normalizedTitle === 'Viewora' ? 'Viewora' : `${normalizedTitle} | Viewora`,
      description,
      url: canonical,
      siteName: 'Viewora',
      locale: locale.replace('-', '_'),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: normalizedTitle === 'Viewora' ? 'Viewora' : `${normalizedTitle} | Viewora`,
      description,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export function buildSoftwareApplicationJsonLd(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Viewora',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: buildLocalizedUrl(locale, ''),
    description:
      'Transparent public social profile research, engagement calculation, competitor benchmarking, and client reporting platform. No Instagram password required; private accounts are never accessed.',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: '0',
      highPrice: '99.99',
      offerCount: '5',
    },
  };
}

export function buildBreadcrumbJsonLd(
  locale: Locale,
  items: Array<{ name: string; path: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: buildLocalizedUrl(locale, item.path),
    })),
  };
}
