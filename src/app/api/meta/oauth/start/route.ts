import { NextResponse } from 'next/server';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { isSecureCookieContext } from '@/lib/auth/secret';
import { buildMetaOAuthUrl, createSignedMetaOAuthState } from '@/lib/meta/oauth';

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const state = createSignedMetaOAuthState(user.id);
  const result = buildMetaOAuthUrl(state);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, configured: false, error: result.error },
      { status: 503 }
    );
  }

  const res = NextResponse.json({ ok: true, authorizationUrl: result.url });
  res.cookies.set('viewora_meta_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookieContext(),
    path: '/',
    maxAge: 600,
  });
  return res;
}
