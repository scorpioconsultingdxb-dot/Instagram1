import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import {
  getCurrentSessionUser,
  LOCAL_SESSION_COOKIE,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';
import {
  listDbUserActiveSessions,
  revokeAllDbUserSessions,
  revokeDbSessionById,
} from '@/lib/db/repositories/users.repo';
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';

const revokeSchema = z.union([
  z.object({ revokeOthers: z.literal(true) }),
  z.object({ sessionId: z.string().min(4).max(120) }),
]);

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    if (isDatabaseConfigured()) {
      const cookieStore = await cookies();
      const rawToken =
        cookieStore.get(SESSION_COOKIE_NAME)?.value ?? cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
      const sessions = await listDbUserActiveSessions(
        user.id,
        rawToken && !rawToken.includes('|') ? rawToken : undefined
      );
      return NextResponse.json({ ok: true, mode: 'database', sessions });
    }

    if (isLocalDevFallbackAllowed()) {
      return NextResponse.json({
        ok: true,
        mode: 'local_demo',
        sessions: [
          {
            id: 'local-current-session',
            ipAddress: '127.0.0.1',
            userAgent: request.headers.get('user-agent') || 'Local Browser Session',
            createdAt: user.createdAt || new Date().toISOString(),
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
            isCurrent: true,
          },
        ],
      });
    }

    return NextResponse.json(
      { ok: false, error: 'Database session management is unavailable.' },
      { status: 503 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Unable to load active sessions right now.' },
      { status: 503 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  try {
    const user = await getCurrentSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Provide either a sessionId or revokeOthers: true.' },
        { status: 400 }
      );
    }

    if (!isDatabaseConfigured()) {
      if (isLocalDevFallbackAllowed()) {
        return NextResponse.json({
          ok: true,
          revokedCount: 0,
          message: 'Local demo mode maintains a single browser cookie session.',
        });
      }
      return NextResponse.json(
        { ok: false, error: 'Database session management is unavailable.' },
        { status: 503 }
      );
    }

    const cookieStore = await cookies();
    const rawToken =
      cookieStore.get(SESSION_COOKIE_NAME)?.value ?? cookieStore.get(LOCAL_SESSION_COOKIE)?.value;
    const currentRaw = rawToken && !rawToken.includes('|') ? rawToken : undefined;

    if ('revokeOthers' in parsed.data) {
      const revokedCount = await revokeAllDbUserSessions(user.id, currentRaw);
      return NextResponse.json({
        ok: true,
        revokedCount,
        message:
          revokedCount > 0
            ? `Revoked ${revokedCount} other active session${revokedCount === 1 ? '' : 's'}.`
            : 'No other active sessions were found.',
      });
    }

    const revoked = await revokeDbSessionById(user.id, parsed.data.sessionId);
    if (!revoked) {
      return NextResponse.json(
        { ok: false, error: 'Session not found or already revoked.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      revokedCount: 1,
      message: 'Selected session has been revoked.',
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Unable to revoke session right now.' },
      { status: 503 }
    );
  }
}
