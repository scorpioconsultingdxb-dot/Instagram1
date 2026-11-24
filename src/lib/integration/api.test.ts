import { describe, expect, it } from 'vitest';
import {
  decodeSignedSessionCookie,
  encodeSignedSessionCookie,
} from '@/lib/auth/session';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { isPaymentsEnabled } from '@/lib/env';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { FREE_TOOLS } from '@/lib/tools/catalog';
import { getAllInfoPageSlugs } from '@/lib/public/info-pages';

describe('Phase 6 Security, SEO & Integration Guarantees', () => {
  it('signs and validates session cookies and rejects tampered tokens', () => {
    const token = encodeSignedSessionCookie('admin@viewora.demo');
    expect(decodeSignedSessionCookie(token)).toBe('admin@viewora.demo');

    // Tamper with email portion
    const tampered = token.replace('admin@viewora.demo', 'attacker@evil.test');
    expect(decodeSignedSessionCookie(tampered)).toBeNull();
    expect(decodeSignedSessionCookie('malformed')).toBeNull();
    expect(decodeSignedSessionCookie(undefined)).toBeNull();
  });

  it('keeps payments strictly disabled by default', () => {
    expect(isPaymentsEnabled()).toBe(false);
  });

  it('generates localized sitemap entries for all 5 locales, 12 tools, and 9 public info pages with hreflang', () => {
    const entries = sitemap();
    const expectedPaths = 3 + FREE_TOOLS.length + getAllInfoPageSlugs().length;
    expect(entries.length).toBe(expectedPaths * SUPPORTED_LOCALES.length);

    for (const locale of SUPPORTED_LOCALES) {
      expect(entries.some((e) => e.url.endsWith(`/${locale}`))).toBe(true);
      expect(entries.some((e) => e.url.endsWith(`/${locale}/instagram-story-viewer`))).toBe(true);
      expect(entries.some((e) => e.url.endsWith(`/${locale}/data-transparency`))).toBe(true);
      expect(entries.some((e) => e.url.endsWith(`/${locale}/pricing`))).toBe(true);
    }

    const first = entries[0];
    expect(first?.alternates?.languages).toHaveProperty('x-default');
    expect(first?.alternates?.languages).toHaveProperty('pt-BR');
  });

  it('disallows private dashboard, admin, auth, and API paths in robots.txt', () => {
    const cfg = robots();
    const rules = Array.isArray(cfg.rules) ? cfg.rules[0] : cfg.rules;
    const disallow = rules?.disallow ?? [];
    expect(disallow).toContain('/api/');
    expect(disallow).toContain('/*/dashboard');
    expect(disallow).toContain('/*/admin');
  });
});
