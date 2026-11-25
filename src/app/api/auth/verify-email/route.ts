import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isDatabaseConfigured } from '@/lib/env';
import { consumeEmailVerificationToken } from '@/lib/db/repositories/auth-tokens.repo';
import { checkAuthRateLimit, extractClientIp } from '@/lib/auth/rate-limit';

const verifySchema = z.object({
  token: z.string().min(16).max(256),
});

export async function POST(request: NextRequest) {
  const ip = extractClientIp(request.headers);
  const limit = checkAuthRateLimit({
    scope: 'verify_email',
    identifier: `ip:${ip}`,
    maxAttempts: 15,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many verification attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Please provide a valid verification token.' },
      { status: 400 }
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Email verification requires a configured PostgreSQL database.' },
      { status: 503 }
    );
  }

  try {
    const result = await consumeEmailVerificationToken(parsed.data.token);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      message: 'Your email address has been verified.',
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Unable to verify email at this time.' },
      { status: 503 }
    );
  }
}
