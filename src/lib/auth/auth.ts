import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { z } from 'zod';
import { getPrismaClient } from '@/lib/db/prisma';
import { isDatabaseConfigured } from '@/lib/env';
import { verifyDbUserCredentials } from '@/lib/db/repositories/users.repo';
import { checkAuthRateLimit } from '@/lib/auth/rate-limit';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function resolveAuthSecret(): string {
  const configured = (process.env.AUTH_SECRET || '').trim();
  if (configured.length >= 16) return configured;
  if (process.env.NODE_ENV === 'production') {
    // Never ship a predictable production secret; Auth.js will reject unsigned calls if missing
    return configured || 'missing-auth-secret-configure-AUTH_SECRET-in-env';
  }
  return 'viewora-local-dev-auth-secret-do-not-use-in-production';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: isDatabaseConfigured() ? PrismaAdapter(getPrismaClient()) : undefined,
  secret: resolveAuthSecret(),
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  pages: {
    signIn: '/en/login',
    error: '/en/login',
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-viewora.authjs.session-token'
          : 'viewora.authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success || !isDatabaseConfigured()) {
          return null;
        }

        const email = parsed.data.email.trim().toLowerCase();
        const limit = checkAuthRateLimit({ scope: 'login', identifier: email });
        if (!limit.allowed) {
          return null;
        }

        const user = await verifyDbUserCredentials(email, parsed.data.password);
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
