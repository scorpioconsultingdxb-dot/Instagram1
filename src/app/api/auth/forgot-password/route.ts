import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getEnv, isDatabaseConfigured } from '@/lib/env';
import { issuePasswordResetToken } from '@/lib/db/repositories/auth-tokens.repo';
import { checkAuthRateLimit, extractClientIp } from '@/lib/auth/rate-limit';
import { captureDevAuthEmail } from '@/lib/auth/dev-mail';

const forgotSchema = z.object({
  email: z.string().email(),
  locale: z.enum(['en', 'pt-BR', 'es', 'de', 'fr']).default('en'),
});

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request.headers);
  const ipLimit = checkAuthRateLimit({
    scope: 'forgot_password',
    identifier: `ip:${ip}`,
    maxAttempts: 10,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many recovery requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Please enter a valid account email address.' },
      { status: 400 }
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Password recovery requires a configured PostgreSQL database. External email delivery remains disabled until authorized.',
      },
      { status: 503 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  try {
    const issued = await issuePasswordResetToken(email);
    if (issued.issued && issued.rawToken && issued.expiresAt) {
      const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
      // Never log raw tokens in production; isolated dev-only mail capture only
      captureDevAuthEmail({
        to: email,
        subject: 'Reset your Viewora password',
        kind: 'password_reset',
        actionUrl: `${appUrl}/${parsed.data.locale}/reset-password?token=${encodeURIComponent(issued.rawToken)}`,
        expiresAt: issued.expiresAt.toISOString(),
      });
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Password recovery service is temporarily unavailable.' },
      { status: 503 }
    );
  }

  // Always return identical generic message to prevent account enumeration
  return NextResponse.json({
    ok: true,
    message:
      'If an account exists for that email address, a single-use password reset token has been generated. External email delivery is inactive in Stage 1; use the local development mail capture or administrator reset workflow.',
  });
}
