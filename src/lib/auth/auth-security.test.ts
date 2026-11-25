import { describe, expect, it, beforeEach } from 'vitest';
import {
  checkAuthRateLimit,
  clearAllAuthRateLimits,
  resetAuthRateLimit,
} from '@/lib/auth/rate-limit';
import { sanitizeRedirectPath } from '@/lib/auth/session';
import {
  BCRYPT_COST_FACTOR,
  hashPassword,
  verifyPassword,
} from '@/lib/db/repositories/users.repo';
import { isDatabaseConfigured, isPaymentsEnabled } from '@/lib/env';

describe('Independent Authentication Security Controls', () => {
  beforeEach(() => {
    clearAllAuthRateLimits();
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

// Live PostgreSQL integration test suite — automatically runs whenever TEST_DATABASE_URL is provided
const LIVE_TEST_DB = process.env.TEST_DATABASE_URL;
describe.skipIf(!LIVE_TEST_DB)('Live PostgreSQL Integration Tests (viewora_test)', () => {
  it('connects to live PostgreSQL test database and verifies SELECT 1', async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: LIVE_TEST_DB } } });
    try {
      const result = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
      expect(Number(result[0]?.ok)).toBe(1);
    } finally {
      await prisma.$disconnect();
    }
  });
});
