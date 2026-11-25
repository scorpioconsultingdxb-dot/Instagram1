import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { getPrismaClient } from '@/lib/db/prisma';
import { isDatabaseConfigured } from '@/lib/env';
import {
  assertValidProductionAuthConfig,
  getRequiredAuthSecret,
} from '@/lib/auth/secret';

/**
 * Authoritative Auth.js v5 configuration (PostgreSQL database session strategy).
 *
 * Unified Session Architecture:
 *   - Viewora does NOT issue unrevocable JWT authentication cookies.
 *   - All sessions are persisted in PostgreSQL `public.sessions` (hashed tokens)
 *     and validated server-side on every request via `resolveDbSessionByRawToken`.
 *   - Production startup/initialization strictly requires a strong `AUTH_SECRET`
 *     with zero predictable fallbacks.
 */
function buildNextAuthInstance() {
  const secret = getRequiredAuthSecret();
  const isProd = process.env.NODE_ENV === 'production';

  return NextAuth({
    adapter: isDatabaseConfigured() ? PrismaAdapter(getPrismaClient()) : undefined,
    secret,
    trustHost: !isProd,
    session: {
      strategy: 'database',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh sliding window every 24h
    },
    pages: {
      signIn: '/en/login',
      error: '/en/login',
    },
    cookies: {
      sessionToken: {
        name: isProd
          ? '__Host-viewora.authjs.session-token'
          : 'viewora.authjs.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: isProd,
        },
      },
    },
    providers: [],
  });
}

let cachedInstance: ReturnType<typeof NextAuth> | null = null;

function getAuthInstance() {
  assertValidProductionAuthConfig();
  if (!cachedInstance) {
    cachedInstance = buildNextAuthInstance();
  }
  return cachedInstance;
}

export const handlers = {
  GET: async (...args: Parameters<ReturnType<typeof NextAuth>['handlers']['GET']>) =>
    getAuthInstance().handlers.GET(...args),
  POST: async (...args: Parameters<ReturnType<typeof NextAuth>['handlers']['POST']>) =>
    getAuthInstance().handlers.POST(...args),
};

export async function auth() {
  return getAuthInstance().auth();
}
