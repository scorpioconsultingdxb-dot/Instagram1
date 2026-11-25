import { describe, expect, it, beforeEach } from 'vitest';
import {
  checkAuthRateLimit,
  clearAllAuthRateLimits,
  resetAuthRateLimit,
} from '@/lib/auth/rate-limit';
import {
  assertValidProductionAuthConfig,
  AuthConfigurationError,
  getRequiredAuthSecret,
  isAllowedCsrfOrigin,
  isStrongAuthSecret,
} from '@/lib/auth/secret';
import { sanitizeRedirectPath } from '@/lib/auth/session';
import {
  BCRYPT_COST_FACTOR,
  hashPassword,
  verifyPassword,
} from '@/lib/db/repositories/users.repo';
import {
  isDatabaseConfigured,
  isDemoModeEnabled,
  isLocalDevFallbackAllowed,
  isPaymentsEnabled,
} from '@/lib/env';

describe('Independent Authentication Security & Production Secret Controls', () => {
  beforeEach(() => {
    clearAllAuthRateLimits();
  });

  it('rejects missing, weak, or placeholder AUTH_SECRET in production and accepts strong random secrets', () => {
    expect(isStrongAuthSecret('')).toBe(false);
    expect(isStrongAuthSecret('short-secret')).toBe(false);
    expect(isStrongAuthSecret('REPLACE_WITH_64_CHAR_HEX_SECRET_000000000000')).toBe(false);
    expect(isStrongAuthSecret('missing-auth-secret-configure-AUTH_SECRET-in-env')).toBe(false);
    expect(isStrongAuthSecret('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(false);

    const strongSecret = '9f2c8e1d7a4b6053c2e9f8a1d4b7e6c5a8f1d2b3c4e5f6a7b8c9d0e1f2a3b4c5';
    expect(isStrongAuthSecret(strongSecret)).toBe(true);

    // Production MUST throw AuthConfigurationError when secret is missing or placeholder
    expect(() =>
      getRequiredAuthSecret({ NODE_ENV: 'production', AUTH_SECRET: '' })
    ).toThrow(AuthConfigurationError);
    expect(() =>
      getRequiredAuthSecret({
        NODE_ENV: 'production',
        AUTH_SECRET: 'viewora-local-dev-session-secret-only-123456',
      })
    ).toThrow(AuthConfigurationError);
    expect(() =>
      assertValidProductionAuthConfig({
        NODE_ENV: 'production',
        AUTH_SECRET: strongSecret,
        AUTH_URL: 'http://viewora.example.com', // insecure HTTP for non-local prod host
      })
    ).toThrow(AuthConfigurationError);

    // Valid production config passes
    expect(
      getRequiredAuthSecret({ NODE_ENV: 'production', AUTH_SECRET: strongSecret })
    ).toBe(strongSecret);
    expect(() =>
      assertValidProductionAuthConfig({
        NODE_ENV: 'production',
        AUTH_SECRET: strongSecret,
        AUTH_URL: 'https://viewora.app',
      })
    ).not.toThrow();

    // Development uses isolated non-production fallback cleanly
    const devSecret = getRequiredAuthSecret({ NODE_ENV: 'development', AUTH_SECRET: '' });
    expect(devSecret.length).toBeGreaterThanOrEqual(32);
  });

  it('strictly disables demo mode and local file storage fallback in production', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevDemo = process.env.DEMO_MODE_ENABLED;
    const prevDb = process.env.DATABASE_URL;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.DEMO_MODE_ENABLED = 'true';
      process.env.DATABASE_URL = '';

      expect(isDemoModeEnabled()).toBe(false);
      expect(isLocalDevFallbackAllowed()).toBe(false);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
      if (prevDemo === undefined) delete process.env.DEMO_MODE_ENABLED;
      else process.env.DEMO_MODE_ENABLED = prevDemo;
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
    }
  });

  it('enforces CSRF origin validation for mutating auth requests', () => {
    const sameOriginReq = new Request('https://viewora.app/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://viewora.app', host: 'viewora.app' },
    });
    expect(isAllowedCsrfOrigin(sameOriginReq, { AUTH_URL: 'https://viewora.app' })).toBe(true);

    const crossOriginReq = new Request('https://viewora.app/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://evil.example', host: 'viewora.app' },
    });
    expect(isAllowedCsrfOrigin(crossOriginReq, { AUTH_URL: 'https://viewora.app' })).toBe(false);
  });

  it('hashes passwords with strong bcrypt cost factor and verifies accurately', async () => {
    expect(BCRYPT_COST_FACTOR).toBeGreaterThanOrEqual(12);
    const hash = await hashPassword('VieworaSecure#2026');
    expect(hash.startsWith('$2')).toBe(true);
    expect(hash).not.toContain('VieworaSecure#2026');
    expect(await verifyPassword('VieworaSecure#2026', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('enforces login rate limiting and recovers after reset', () => {
    for (let i = 0; i < 5; i += 1) {
      const res = checkAuthRateLimit({
        scope: 'login',
        identifier: 'user@example.com',
        maxAttempts: 5,
        windowMs: 60_000,
      });
      expect(res.allowed).toBe(true);
    }

    const blocked = checkAuthRateLimit({
      scope: 'login',
      identifier: 'user@example.com',
      maxAttempts: 5,
      windowMs: 60_000,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    resetAuthRateLimit('login', 'user@example.com');
    const afterReset = checkAuthRateLimit({
      scope: 'login',
      identifier: 'user@example.com',
      maxAttempts: 5,
    });
    expect(afterReset.allowed).toBe(true);
  });

  it('blocks open redirects while allowing safe internal paths', () => {
    expect(sanitizeRedirectPath('/en/dashboard/profiles')).toBe('/en/dashboard/profiles');
    expect(sanitizeRedirectPath('//evil.com/phish')).toBe('/en/dashboard');
    expect(sanitizeRedirectPath('https://evil.com')).toBe('/en/dashboard');
    expect(sanitizeRedirectPath('/\\evil.com')).toBe('/en/dashboard');
    expect(sanitizeRedirectPath('')).toBe('/en/dashboard');
  });

  it('keeps payments strictly disabled by default and detects PostgreSQL DATABASE_URL without Supabase', () => {
    expect(isPaymentsEnabled()).toBe(false);
    const prevUrl = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = '';
      expect(isDatabaseConfigured()).toBe(false);
      process.env.DATABASE_URL = 'postgresql://viewora_app:secret@127.0.0.1:5432/viewora';
      expect(isDatabaseConfigured()).toBe(true);
    } finally {
      if (prevUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevUrl;
    }
  });
});
