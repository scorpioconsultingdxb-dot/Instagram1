import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  matchLocaleFromAcceptLanguage,
} from './config';
import { getDictionary } from './get-dictionary';
import { buildHreflangAlternates } from '@/lib/seo/metadata';

describe('i18n configuration & dictionaries', () => {
  it('supports all 5 required initial markets', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'pt-BR', 'es', 'de', 'fr']);
    for (const locale of SUPPORTED_LOCALES) {
      expect(isSupportedLocale(locale)).toBe(true);
      const dict = getDictionary(locale);
      expect(dict.brand.name).toBe('Viewora');
      expect(dict.provenance.demo.length).toBeGreaterThan(0);
      expect(dict.trust.noPrivateAccess.length).toBeGreaterThan(0);
    }
  });

  it('matches Accept-Language headers accurately', () => {
    expect(matchLocaleFromAcceptLanguage('pt-BR,pt;q=0.9,en;q=0.8')).toBe('pt-BR');
    expect(matchLocaleFromAcceptLanguage('es-MX,es;q=0.9')).toBe('es');
    expect(matchLocaleFromAcceptLanguage('de-DE,de;q=0.9')).toBe('de');
    expect(matchLocaleFromAcceptLanguage('fr-FR,fr;q=0.9')).toBe('fr');
    expect(matchLocaleFromAcceptLanguage('ja-JP,ja;q=0.9')).toBe(DEFAULT_LOCALE);
    expect(matchLocaleFromAcceptLanguage(null)).toBe(DEFAULT_LOCALE);
  });

  it('generates hreflang alternates for every locale plus x-default', () => {
    const alternates = buildHreflangAlternates('/pricing');
    expect(Object.keys(alternates)).toEqual(
      expect.arrayContaining(['en', 'pt-BR', 'es', 'de', 'fr', 'x-default'])
    );
    expect(alternates['pt-BR']).toContain('/pt-BR/pricing');
    expect(alternates['x-default']).toContain('/en/pricing');
  });

  it('covers pricing, auth, tools, dashboard, and profileHq across all 5 locales with real translations', () => {
    const en = getDictionary('en');
    const sections = [
      'brand',
      'nav',
      'provenance',
      'trust',
      'home',
      'footer',
      'pricing',
      'auth',
      'tools',
      'dashboard',
      'profileHq',
    ] as const;

    for (const locale of SUPPORTED_LOCALES) {
      const dict = getDictionary(locale);
      for (const section of sections) {
        const record = dict[section] as Record<string, string>;
        for (const [key, val] of Object.entries(record)) {
          expect(val.trim().length, `${locale}.${section}.${key} must be non-empty`).toBeGreaterThan(
            0
          );
        }
      }
      if (locale !== 'en') {
        expect(dict.pricing.title).not.toBe(en.pricing.title);
        expect(dict.auth.loginTitle).not.toBe(en.auth.loginTitle);
        expect(dict.auth.registerTitle).not.toBe(en.auth.registerTitle);
        expect(dict.tools.directoryBadge).not.toBe(en.tools.directoryBadge);
        expect(dict.dashboard.tabProfiles).not.toBe(en.dashboard.tabProfiles);
        expect(dict.profileHq.breadcrumbTitle).not.toBe(en.profileHq.breadcrumbTitle);
      }
    }
  });
});
