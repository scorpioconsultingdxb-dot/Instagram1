import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getEnv, isDatabaseConfigured } from '@/lib/env';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { issueEmailVerificationToken } from '@/lib/db/repositories/auth-tokens.repo';
import { checkAuthRateLimit, extractClientIp } from '@/lib/auth/rate-limit';
import { captureDevAuthEmail } from '@/lib/auth/dev-mail';

const resendSchema = z.object({
  locale: z.enum(['en', 'pt-BR', 'es', 'de', 'fr']).default('en'),
});

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  if (user.emailVerified) {
    return NextResponse.json({
      ok: true,
      alreadyVerified: true,
      message: 'Your email address is already verified.',
    });
  }

  const ip = extractClientIp(request.headers);
  const limit = checkAuthRateLimit({
    scope: 'resend_verification',
    identifier: `user:${user.id}:${ip}`,
    maxAttempts: 5,
    windowMs: 1000 * 60 * 15,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many verification requests. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Email verification requires a configured PostgreSQL database.' },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = resendSchema.safeParse(body ?? {});
  const locale = parsed.success ? parsed.data.locale : 'en';

  try {
    const issued = await issueEmailVerificationToken(user.id);
    const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
    captureDevAuthEmail({
      to: user.email,
      subject: 'Verify your Viewora email address',
      kind: 'email_verification',
      actionUrl: `${appUrl}/${locale}/verify-email?token=${encodeURIComponent(issued.rawToken)}`,
      expiresAt: issued.expiresAt.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message:
        'A fresh single-use verification token was generated. External email delivery remains disabled until authorized; use the verification link or token flow.',
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Unable to issue a verification token right now.' },
      { status: 503 }
    );
  }
}
