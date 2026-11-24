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

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: buildHreflangAlternates(path),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Viewora',
      locale: locale.replace('-', '_'),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}
