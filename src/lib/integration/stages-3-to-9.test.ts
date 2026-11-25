import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { checkAuthRateLimit, clearAllAuthRateLimits } from '@/lib/auth/rate-limit';
import { hasAdminCapability } from '@/lib/admin/rbac';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { isPaymentsEnabled } from '@/lib/env';

describe('Stages 3–9 Security Hardening, RBAC, Multi-Locale & Architecture Invariants', () => {
  beforeEach(() => {
    clearAllAuthRateLimits();
  });

  it('rejects cross-origin requests across mutating workspace, admin, AI, billing, support, and contact endpoints', () => {
    const endpoints = [
      '/api/dashboard/workspace',
      '/api/admin/actions',
      '/api/support',
      '/api/ai/report',
      '/api/billing/checkout',
      '/api/contact',
      '/api/auth/sessions',
      '/api/auth/resend-verification',
    ];

    for (const ep of endpoints) {
      const evilReq = new Request(`https://viewora.app${ep}`, {
        method: 'POST',
        headers: { origin: 'https://attacker.example', host: 'viewora.app' },
      });
      expect(isAllowedCsrfOrigin(evilReq, { AUTH_URL: 'https://viewora.app' })).toBe(false);

      const safeReq = new Request(`https://viewora.app${ep}`, {
        method: 'POST',
        headers: { origin: 'https://viewora.app', host: 'viewora.app' },
      });
      expect(isAllowedCsrfOrigin(safeReq, { AUTH_URL: 'https://viewora.app' })).toBe(true);
    }
  });

  it('enforces sliding-window rate limits on public contact and verification resend scopes', () => {
    for (let i = 0; i < 8; i += 1) {
      expect(
        checkAuthRateLimit({ scope: 'contact', identifier: 'ip:198.51.100.7', maxAttempts: 8 }).allowed
      ).toBe(true);
    }
    const blockedContact = checkAuthRateLimit({
      scope: 'contact',
      identifier: 'ip:198.51.100.7',
      maxAttempts: 8,
    });
    expect(blockedContact.allowed).toBe(false);
    expect(blockedContact.retryAfterSeconds).toBeGreaterThan(0);

    for (let i = 0; i < 5; i += 1) {
      expect(
        checkAuthRateLimit({
          scope: 'resend_verification',
          identifier: 'user:u-1:198.51.100.7',
          maxAttempts: 5,
        }).allowed
      ).toBe(true);
    }
    expect(
      checkAuthRateLimit({
        scope: 'resend_verification',
        identifier: 'user:u-1:198.51.100.7',
        maxAttempts: 5,
      }).allowed
    ).toBe(false);
  });

  it('enforces least-privilege RBAC for account suspension (manage_users) and user entitlement overrides (manage_entitlements)', () => {
    expect(hasAdminCapability('analyst', 'manage_users')).toBe(false);
    expect(hasAdminCapability('analyst', 'manage_entitlements')).toBe(false);
    expect(hasAdminCapability('content_manager', 'manage_users')).toBe(false);
    expect(hasAdminCapability('content_manager', 'manage_entitlements')).toBe(false);
    expect(hasAdminCapability('support_agent', 'manage_users')).toBe(false);
    expect(hasAdminCapability('support_agent', 'manage_entitlements')).toBe(false);

    expect(hasAdminCapability('operations_admin', 'manage_users')).toBe(true);
    expect(hasAdminCapability('admin', 'manage_users')).toBe(true);
    expect(hasAdminCapability('admin', 'manage_entitlements')).toBe(true);
    expect(hasAdminCapability('super_admin', 'manage_users')).toBe(true);
    expect(hasAdminCapability('super_admin', 'manage_entitlements')).toBe(true);
  });

  it('maintains 5-locale dictionary integrity with zero Supabase branding leakage', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'pt-BR', 'es', 'de', 'fr']);
    const enKeys = Object.keys(getDictionary('en')).sort();

    for (const locale of SUPPORTED_LOCALES) {
      const dict = getDictionary(locale);
      expect(Object.keys(dict).sort()).toEqual(enKeys);
      expect(JSON.stringify(dict).toLowerCase()).not.toContain('supabase');
    }
  });

  it('keeps Supabase dependencies removed and payments disabled', () => {
    expect(isPaymentsEnabled()).toBe(false);
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const allDeps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    expect(allDeps.some((d) => d.includes('supabase'))).toBe(false);
  });
});
