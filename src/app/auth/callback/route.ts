import { NextResponse, type NextRequest } from 'next/server';
import { sanitizeRedirectPath } from '@/lib/auth/session';

/**
 * Safe internal redirect handler for authentication flows.
 * Blocks open-redirect attacks (external origins, protocol-relative URLs, backslashes).
 */
export async function GET(request: NextRequest) {
  const nextPath = sanitizeRedirectPath(
    request.nextUrl.searchParams.get('next'),
    '/en/dashboard'
  );
  return NextResponse.redirect(new URL(nextPath, request.url));
}
