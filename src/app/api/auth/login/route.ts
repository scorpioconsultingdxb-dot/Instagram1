import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isDatabaseConfigured, isDemoModeEnabled } from '@/lib/env';
import {
  assertValidProductionAuthConfig,
  AuthConfigurationError,
  isAllowedCsrfOrigin,
} from '@/lib/auth/secret';
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
import { emitStructuredLog, recordObservabilityEvent } from '@/lib/observability/metrics';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  if (!isAllowedCsrfOrigin(request)) {
    recordObservabilityEvent({
      category: 'csrf_blocked',
      route: '/api/auth/login',
      statusCode: 403,
      detail: 'origin_mismatch',
    });
    emitStructuredLog('warn', 'auth.login.csrf_blocked', { route: '/api/auth/login' });
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  try {
    assertValidProductionAuthConfig();
  } catch (err) {
    recordObservabilityEvent({
      category: 'app_error',
      route: '/api/auth/login',
      statusCode: 503,
      detail: 'auth_config_invalid',
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof AuthConfigurationError
            ? 'Authentication service is not configured securely.'
            : 'Authentication configuration error.',
      },
      { status: 503 }
    );
  }

  const ip = extractClientIp(request.headers);
  const ipLimit = checkAuthRateLimit({ scope: 'login', identifier: `ip:${ip}`, maxAttempts: 20 });
  if (!ipLimit.allowed) {
    recordObservabilityEvent({
      category: 'auth_rate_limited',
      route: '/api/auth/login',
      statusCode: 429,
      detail: 'ip_rate_limit',
    });
    emitStructuredLog('warn', 'auth.login.rate_limited', { scope: 'ip' });
    return NextResponse.json(
      { ok: false, error: 'Too many sign-in attempts. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    recordObservabilityEvent({
      category: 'auth_failure',
      route: '/api/auth/login',
      statusCode: 400,
      detail: 'invalid_payload',
    });
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
    recordObservabilityEvent({
      category: 'auth_rate_limited',
      route: '/api/auth/login',
      statusCode: 429,
      detail: 'account_rate_limit',
    });
    emitStructuredLog('warn', 'auth.login.rate_limited', { scope: 'email' });
    return NextResponse.json(
      { ok: false, error: 'Too many sign-in attempts. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) } }
    );
  }

  if (isDatabaseConfigured()) {
    try {
      const user = await verifyDbUserCredentials(email, parsed.data.password);
      if (!user) {
        recordObservabilityEvent({
          category: 'auth_failure',
          route: '/api/auth/login',
          statusCode: 401,
          latencyMs: Date.now() - startedAt,
          detail: 'invalid_credentials',
        });
        emitStructuredLog('warn', 'auth.login.failed', { statusCode: 401 });
        return NextResponse.json({ ok: false, error: 'Invalid email or password.' }, { status: 401 });
      }

      const session = await createDbSession({
        userId: user.id,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent'),
        ttlMs: SESSION_TTL_MS,
      });
      resetAuthRateLimit('login', `email:${email}`);

      recordObservabilityEvent({
        category: 'auth_success',
        route: '/api/auth/login',
        statusCode: 200,
        latencyMs: Date.now() - startedAt,
      });

      const response = NextResponse.json({ ok: true, mode: 'database', user });
      const cookieOpts = buildSessionCookieOptions(Math.floor(SESSION_TTL_MS / 1000));
      response.cookies.set(SESSION_COOKIE_NAME, session.rawToken, cookieOpts);
      if (SESSION_COOKIE_NAME !== LOCAL_SESSION_COOKIE) {
        response.cookies.set(LOCAL_SESSION_COOKIE, '', buildSessionCookieOptions(0));
      }
      return response;
    } catch {
      recordObservabilityEvent({
        category: 'app_error',
        route: '/api/auth/login',
        statusCode: 503,
        latencyMs: Date.now() - startedAt,
        detail: 'database_unavailable',
      });
      emitStructuredLog('error', 'auth.login.database_error', { statusCode: 503 });
      return NextResponse.json(
        { ok: false, error: 'Database authentication service is temporarily unavailable.' },
        { status: 503 }
      );
    }
  }

  // Strictly isolated non-production Demo Mode (impossible when NODE_ENV === 'production')
  if (!isDemoModeEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Account sign-in is temporarily unavailable. You can continue exploring our free tools.',
      },
      { status: 503 }
    );
  }

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
