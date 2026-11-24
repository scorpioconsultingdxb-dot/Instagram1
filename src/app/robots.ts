import type { MetadataRoute } from 'next';
import { getEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/*/dashboard', '/*/admin', '/*/auth'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
