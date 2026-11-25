import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { isDatabaseConfigured } from '@/lib/env';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import {
  buildSessionCookieOptions,
  LOCAL_SESSION_COOKIE,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';
import { revokeDbSessionByRawToken } from '@/lib/db/repositories/users.repo';

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const rawToken =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ?? cookieStore.get(LOCAL_SESSION_COOKIE)?.value;

  if (isDatabaseConfigured() && rawToken && !rawToken.includes('|')) {
    await revokeDbSessionByRawToken(rawToken).catch(() => false);
  }

  const response = NextResponse.json({ ok: true });
  const expiredOpts = buildSessionCookieOptions(0);
  response.cookies.set(SESSION_COOKIE_NAME, '', expiredOpts);
  response.cookies.set(LOCAL_SESSION_COOKIE, '', expiredOpts);
  response.cookies.set('viewora.authjs.session-token', '', expiredOpts);
  response.cookies.set('__Host-viewora.authjs.session-token', '', expiredOpts);
  return response;
}
