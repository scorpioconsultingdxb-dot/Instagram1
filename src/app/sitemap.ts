import type { MetadataRoute } from 'next';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { buildHreflangAlternates, buildLocalizedUrl } from '@/lib/seo/metadata';
import { getAllToolSlugs } from '@/lib/tools/catalog';
import { getAllInfoPageSlugs } from '@/lib/public/info-pages';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [
    '',
    '/tools',
    '/pricing',
    ...getAllToolSlugs().map((s) => `/${s}`),
    ...getAllInfoPageSlugs().map((s) => `/${s}`),
  ];
  const entries: MetadataRoute.Sitemap = [];
  const lastModified = new Date();

  for (const path of staticPaths) {
    const alternates = buildHreflangAlternates(path);
    for (const locale of SUPPORTED_LOCALES) {
      entries.push({
        url: buildLocalizedUrl(locale, path),
        lastModified,
        changeFrequency: path === '' ? 'daily' : 'weekly',
        priority: path === '' ? 1.0 : path === '/tools' || path === '/pricing' ? 0.9 : 0.8,
        alternates: {
          languages: alternates,
        },
      });
    }
  }

  return entries;
}
