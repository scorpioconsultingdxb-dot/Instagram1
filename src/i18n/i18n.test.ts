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
});
