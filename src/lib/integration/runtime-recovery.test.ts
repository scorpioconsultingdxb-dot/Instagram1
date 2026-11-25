import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { readJsonStore } from '@/lib/storage/persistence';
import { loadConfiguredPlans } from '@/lib/entitlements/service';
import { loadPublishedCmsBySlug } from '@/lib/admin/store';
import { getAllInfoPageSlugs, PUBLIC_INFO_PAGES } from '@/lib/public/info-pages';
import { FREE_TOOLS } from '@/lib/tools/catalog';

describe('Runtime Recovery — Read-Only FS Safety & Customer-Facing Hygiene', () => {
  const savedEnv = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    VIEWORA_DATA_DIR: process.env.VIEWORA_DATA_DIR,
    DEMO_MODE_ENABLED: process.env.DEMO_MODE_ENABLED,
  };

  afterEach(() => {
    const env = process.env as Record<string, string | undefined>;
    env.NODE_ENV = savedEnv.NODE_ENV;
    if (savedEnv.DATABASE_URL !== undefined) env.DATABASE_URL = savedEnv.DATABASE_URL;
    else delete env.DATABASE_URL;
    if (savedEnv.VIEWORA_DATA_DIR !== undefined) env.VIEWORA_DATA_DIR = savedEnv.VIEWORA_DATA_DIR;
    else delete env.VIEWORA_DATA_DIR;
    if (savedEnv.DEMO_MODE_ENABLED !== undefined) env.DEMO_MODE_ENABLED = savedEnv.DEMO_MODE_ENABLED;
    else delete env.DEMO_MODE_ENABLED;
  });

  it('never throws or creates directories on readJsonStore when filesystem is unwritable', () => {
    process.env.VIEWORA_DATA_DIR = 'Z:\\nonexistent-readonly-sim\\.viewora-data';
    const result = readJsonStore('plans-config.json', () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });

  it('loads reviewed plans and public CMS content safely in production without DB or writable disk', async () => {
    const env = process.env as Record<string, string | undefined>;
    env.NODE_ENV = 'production';
    delete env.DATABASE_URL;
    env.DEMO_MODE_ENABLED = 'false';
    env.VIEWORA_DATA_DIR = 'Z:\\nonexistent-readonly-sim\\.viewora-data';

    const plans = await loadConfiguredPlans();
    expect(plans.length).toBe(5);
    expect(plans.map((p) => p.code)).toEqual(['free', 'starter', 'premium', 'pro', 'agency']);

    const cmsEn = await loadPublishedCmsBySlug('data-transparency', 'en');
    expect(cmsEn).not.toBeNull();
    expect(cmsEn?.title).toContain('Data Transparency');

    const cmsPt = await loadPublishedCmsBySlug('data-transparency', 'pt-BR');
    expect(cmsPt).not.toBeNull();
    expect(cmsPt?.locale).toBe('pt-BR');
  });

  it('has complete reviewed static content for all 11 public info pages and all 12 free tools', () => {
    const slugs = getAllInfoPageSlugs();
    expect(slugs).toEqual(
      expect.arrayContaining([
        'data-transparency',
        'about',
        'faq',
        'contact',
        'privacy',
        'terms',
        'responsible-use',
        'cookies',
        'resources',
        'glossary',
        'blog',
      ])
    );
    for (const slug of slugs) {
      const def = PUBLIC_INFO_PAGES[slug];
      expect(def.title.length).toBeGreaterThan(2);
      expect(def.sections.length).toBeGreaterThanOrEqual(1);
    }
    expect(FREE_TOOLS).toHaveLength(12);
  });

  it('does not expose internal environment variable names in customer-facing auth, checkout, or i18n files', () => {
    const forbidden = ['DATABASE_URL', 'AUTH_SECRET', 'DEMO_MODE_ENABLED', 'PAYMENTS_ENABLED'];
    const filesToCheck = [
      'src/components/auth/LoginForm.tsx',
      'src/components/auth/SignupForm.tsx',
      'src/components/auth/ForgotPasswordForm.tsx',
      'src/app/[locale]/checkout/page.tsx',
      'src/app/[locale]/page.tsx',
      'src/i18n/dictionaries/en.ts',
      'src/i18n/dictionaries/pt-BR.ts',
      'src/i18n/dictionaries/es.ts',
      'src/i18n/dictionaries/de.ts',
      'src/i18n/dictionaries/fr.ts',
    ];

    for (const rel of filesToCheck) {
      const content = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      for (const token of forbidden) {
        expect(content, `${rel} must not expose ${token}`).not.toContain(token);
      }
    }
  });
});
