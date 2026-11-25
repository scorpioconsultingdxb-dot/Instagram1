import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isDatabaseConfigured, isDemoModeEnabled } from '@/lib/env';
import {
  buildSessionCookieOptions,
  deriveLocalUserId,
  encodeSignedSessionCookie,
  listLocalDemoUsers,
  LOCAL_SESSION_COOKIE,
  SESSION_COOKIE_NAME,
  upsertLocalUser,
} from '@/lib/auth/session';
import {
  createDbSession,
  SESSION_TTL_MS,
  verifyDbUserCredentials,
} from '@/lib/db/repositories/users.repo';
import {
  checkAuthRateLimit,
  extractClientIp,
  resetAuthRateLimit,
} from '@/lib/auth/rate-limit';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request.headers);
  const ipLimit = checkAuthRateLimit({ scope: 'login', identifier: `ip:${ip}`, maxAttempts: 20 });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many sign-in attempts. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Please enter a valid email address and password (min 6 characters).' },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const emailLimit = checkAuthRateLimit({
    scope: 'login',
    identifier: `email:${email}`,
    maxAttempts: 10,
  });
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many sign-in attempts. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) } }
    );
  }

  if (isDatabaseConfigured()) {
    try {
      const user = await verifyDbUserCredentials(email, parsed.data.password);
      if (!user) {
        // Generic error prevents account enumeration
        return NextResponse.json({ ok: false, error: 'Invalid email or password.' }, { status: 401 });
      }

      const session = await createDbSession({
        userId: user.id,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent'),
        ttlMs: SESSION_TTL_MS,
      });
      resetAuthRateLimit('login', `email:${email}`);

      const response = NextResponse.json({ ok: true, mode: 'database', user });
      const cookieOpts = buildSessionCookieOptions(Math.floor(SESSION_TTL_MS / 1000));
      response.cookies.set(SESSION_COOKIE_NAME, session.rawToken, cookieOpts);
      if (SESSION_COOKIE_NAME !== LOCAL_SESSION_COOKIE) {
        response.cookies.set(LOCAL_SESSION_COOKIE, '', buildSessionCookieOptions(0));
      }
      return response;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Database authentication service is temporarily unavailable.' },
        { status: 503 }
      );
    }
  }

  // Server-controlled Demo Mode guard: never allow local demo auth when DEMO_MODE_ENABLED=false
  if (!isDemoModeEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Authentication requires a configured PostgreSQL DATABASE_URL. Demo authentication is disabled by default (DEMO_MODE_ENABLED=false).',
      },
      { status: 503 }
    );
  }

  // Isolated Demo Mode (only when explicitly enabled via DEMO_MODE_ENABLED=true without PostgreSQL)
  const existing = listLocalDemoUsers().find((u) => u.email.toLowerCase() === email);
  const user =
    existing ??
    upsertLocalUser({
      id: deriveLocalUserId(email),
      email,
      fullName: email.split('@')[0] ?? 'Viewora User',
      role: 'user',
      segment: 'personal',
      planCode: 'free',
      billingInterval: 'monthly',
      onboardingCompleted: true,
      emailPreferences: {
        productUpdates: false,
        weeklyDigest: false,
        trackingAlerts: true,
        marketing: false,
      },
      authMode: 'local_demo',
    });

  const response = NextResponse.json({ ok: true, mode: 'local_demo', user });
  response.cookies.set(
    LOCAL_SESSION_COOKIE,
    encodeSignedSessionCookie(user.email),
    buildSessionCookieOptions(60 * 60 * 24 * 7)
  );
  return response;
}
