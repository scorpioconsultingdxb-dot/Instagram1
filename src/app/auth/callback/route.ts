import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sanitizeRedirectPath } from '@/lib/auth/session';

/**
 * Supabase Auth OAuth & email-verification callback handler.
 * Enforces safe internal redirect validation to prevent open-redirect attacks.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const nextPath = sanitizeRedirectPath(
    request.nextUrl.searchParams.get('next'),
    '/en/dashboard'
  );

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      await supabase.auth.exchangeCodeForSession(code);
    }
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
