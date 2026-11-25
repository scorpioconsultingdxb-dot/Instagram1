import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getEnv, isDatabaseConfigured, isDemoModeEnabled } from '@/lib/env';
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
  registerUserWithWorkspace,
  SESSION_TTL_MS,
} from '@/lib/db/repositories/users.repo';
import { checkAuthRateLimit, extractClientIp } from '@/lib/auth/rate-limit';
import { captureDevAuthEmail } from '@/lib/auth/dev-mail';
import { persistFunnelEvent } from '@/lib/analytics/funnel';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(80),
  segment: z.enum(['personal', 'business', 'agency']).default('personal'),
  locale: z.enum(['en', 'pt-BR', 'es', 'de', 'fr']).default('en'),
  emailPreferences: z
    .object({
      productUpdates: z.boolean().default(false),
      weeklyDigest: z.boolean().default(false),
      trackingAlerts: z.boolean().default(false),
      marketing: z.boolean().default(false),
    })
    .default({
      productUpdates: false,
      weeklyDigest: false,
      trackingAlerts: false,
      marketing: false,
    }),
});

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  try {
    assertValidProductionAuthConfig();
  } catch (err) {
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
  const ipLimit = checkAuthRateLimit({ scope: 'signup', identifier: `ip:${ip}`, maxAttempts: 10 });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Please provide your name, a valid email, and a password of at least 8 characters.',
      },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();

  if (isDatabaseConfigured()) {
    try {
      const reg = await registerUserWithWorkspace({
        email,
        password: parsed.data.password,
        fullName: parsed.data.fullName,
        segment: parsed.data.segment,
        preferredLocale: parsed.data.locale,
        emailPreferences: parsed.data.emailPreferences,
      });

      if (!reg.ok) {
        return NextResponse.json(
          { ok: false, error: reg.error },
          { status: reg.code === 'EMAIL_EXISTS' ? 409 : 400 }
        );
      }

      const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
      captureDevAuthEmail({
        to: reg.user.email,
        subject: 'Verify your Viewora email address',
        kind: 'email_verification',
        actionUrl: `${appUrl}/${parsed.data.locale}/verify-email?token=${encodeURIComponent(reg.verificationTokenRaw)}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      });

      const session = await createDbSession({
        userId: reg.user.id,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent'),
        ttlMs: SESSION_TTL_MS,
      });

      await persistFunnelEvent({
        eventName: 'signup_completed',
        locale: parsed.data.locale,
        sessionId: reg.user.id,
        userId: reg.user.id,
        properties: { segment: reg.user.segment },
      }).catch(() => undefined);

      const response = NextResponse.json(
        {
          ok: true,
          mode: 'database',
          user: reg.user,
          verificationPending: true,
        },
        { status: 201 }
      );
      response.cookies.set(
        SESSION_COOKIE_NAME,
        session.rawToken,
        buildSessionCookieOptions(Math.floor(SESSION_TTL_MS / 1000))
      );
      return response;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Database registration service is temporarily unavailable.' },
        { status: 503 }
      );
    }
  }

  if (!isDemoModeEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Account registration is temporarily unavailable. You can continue exploring our free tools.',
      },
      { status: 503 }
    );
  }

  const existingUser = listLocalDemoUsers().find((u) => u.email.toLowerCase() === email);
  if (existingUser) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Unable to complete registration with the provided email address.',
      },
      { status: 409 }
    );
  }

  const newUser = upsertLocalUser({
    id: deriveLocalUserId(email),
    email,
    fullName: parsed.data.fullName.trim(),
    role: 'user',
    segment: parsed.data.segment,
    planCode: 'free',
    billingInterval: 'monthly',
    onboardingCompleted: true,
    emailPreferences: parsed.data.emailPreferences,
    authMode: 'local_demo',
  });

  await persistFunnelEvent({
    eventName: 'signup_completed',
    locale: parsed.data.locale,
    sessionId: newUser.id,
    userId: newUser.id,
    properties: { segment: newUser.segment },
  }).catch(() => undefined);

  const response = NextResponse.json({ ok: true, mode: 'local_demo', user: newUser }, { status: 201 });
  response.cookies.set(
    LOCAL_SESSION_COOKIE,
    encodeSignedSessionCookie(newUser.email),
    buildSessionCookieOptions(60 * 60 * 24 * 7)
  );
  return response;
}
