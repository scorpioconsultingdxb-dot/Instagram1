import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isDatabaseConfigured } from '@/lib/env';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { consumePasswordResetToken } from '@/lib/db/repositories/auth-tokens.repo';
import { checkAuthRateLimit, extractClientIp } from '@/lib/auth/rate-limit';

const resetSchema = z.object({
  token: z.string().min(16).max(256),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const ip = extractClientIp(request.headers);
  const limit = checkAuthRateLimit({
    scope: 'reset_password',
    identifier: `ip:${ip}`,
    maxAttempts: 10,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many reset attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Provide a valid reset token and a new password of at least 8 characters.',
      },
      { status: 400 }
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Password reset requires a configured PostgreSQL database.' },
      { status: 503 }
    );
  }

  try {
    const result = await consumePasswordResetToken(parsed.data.token, parsed.data.newPassword);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Your password has been updated and all prior sessions were signed out.',
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Unable to complete password reset at this time.' },
      { status: 503 }
    );
  }
}
