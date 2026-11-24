'use client';

import { Globe } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LOCALE_METADATA,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type Locale,
} from '@/i18n/config';

export function LocaleSwitcher({
  currentLocale,
  label,
}: {
  currentLocale: Locale;
  label: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleChange = (nextLocale: Locale) => {
    document.cookie = `viewora_locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    const segments = pathname.split('/');
    if (segments[1] && isSupportedLocale(segments[1])) {
      segments[1] = nextLocale;
      router.push(segments.join('/') || `/${nextLocale}`);
    } else {
      router.push(`/${nextLocale}${pathname}`);
    }
  };

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <Globe
        className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-500 dark:text-slate-400"
        aria-hidden="true"
      />
      <select
        aria-label={label}
        value={currentLocale}
        onChange={(e) => handleChange(e.target.value as Locale)}
        className="h-9 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-1 pr-7 pl-8 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {SUPPORTED_LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_METADATA[loc].nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
