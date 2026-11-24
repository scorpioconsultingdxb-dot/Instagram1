export const SUPPORTED_LOCALES = ['en', 'pt-BR', 'es', 'de', 'fr'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_METADATA: Record<
  Locale,
  {
    code: Locale;
    hreflang: string;
    label: string;
    nativeLabel: string;
    dir: 'ltr';
  }
> = {
  en: {
    code: 'en',
    hreflang: 'en',
    label: 'English',
    nativeLabel: 'English',
    dir: 'ltr',
  },
  'pt-BR': {
    code: 'pt-BR',
    hreflang: 'pt-BR',
    label: 'Portuguese (Brazil)',
    nativeLabel: 'Português (BR)',
    dir: 'ltr',
  },
  es: {
    code: 'es',
    hreflang: 'es',
    label: 'Spanish',
    nativeLabel: 'Español',
    dir: 'ltr',
  },
  de: {
    code: 'de',
    hreflang: 'de',
    label: 'German',
    nativeLabel: 'Deutsch',
    dir: 'ltr',
  },
  fr: {
    code: 'fr',
    hreflang: 'fr',
    label: 'French',
    nativeLabel: 'Français',
    dir: 'ltr',
  },
};

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function matchLocaleFromAcceptLanguage(headerValue: string | null): Locale {
  if (!headerValue) return DEFAULT_LOCALE;
  const candidates = headerValue
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase() ?? '')
    .filter(Boolean);

  for (const tag of candidates) {
    if (tag === 'pt-br' || tag.startsWith('pt')) return 'pt-BR';
    if (tag.startsWith('es')) return 'es';
    if (tag.startsWith('de')) return 'de';
    if (tag.startsWith('fr')) return 'fr';
    if (tag.startsWith('en')) return 'en';
  }

  return DEFAULT_LOCALE;
}
