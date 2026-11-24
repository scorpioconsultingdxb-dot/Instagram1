import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from './config';
import { de } from './dictionaries/de';
import { en } from './dictionaries/en';
import { es } from './dictionaries/es';
import { fr } from './dictionaries/fr';
import { ptBR } from './dictionaries/pt-BR';
import type { Dictionary } from './types';

const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  'pt-BR': ptBR,
  es,
  de,
  fr,
};

export function getDictionary(locale: string): Dictionary {
  if (isSupportedLocale(locale)) {
    return DICTIONARIES[locale];
  }
  return DICTIONARIES[DEFAULT_LOCALE];
}
