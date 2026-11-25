import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isDatabaseConfigured } from '@/lib/env';
import {
  getCurrentSessionUser,
  LOCAL_SESSION_COOKIE,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';
import { changeDbUserPassword } from '@/lib/db/repositories/users.repo';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(128),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Provide your current password and a new password (min 8 characters).' },
      { status: 400 }
    );
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json(
      { ok: false, error: 'New password must differ from your current password.' },
      { status: 400 }
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Password changes require a configured PostgreSQL database.' },
      { status: 503 }
    );
  }

  const cookieStore = await cookies();
  const currentRawToken =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ?? cookieStore.get(LOCAL_SESSION_COOKIE)?.value;

  const res = await changeDbUserPassword({
    userId: user.id,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
    keepCurrentSessionRawToken:
      currentRawToken && !currentRawToken.includes('|') ? currentRawToken : undefined,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Password updated successfully. All other active sessions have been revoked.',
  });
}
