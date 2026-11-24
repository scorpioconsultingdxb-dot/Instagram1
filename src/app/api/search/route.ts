import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { normalizeInstagramInput } from '@/lib/instagram/normalize';
import { defaultProviderRegistry } from '@/lib/providers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const ANON_SEARCH_COOKIE = 'viewora_anon_searches';
const FREE_ANON_SEARCH_LIMIT = 1;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const bypassAnonLimitForSample = request.nextUrl.searchParams.get('preview') === 'demo';

  const normalized = normalizeInstagramInput(query);
  if (!normalized.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: normalized.code,
          message: normalized.message,
        },
      },
      { status: 400 }
    );
  }

  // Check if user is authenticated via Supabase
  let isAuthenticated = false;
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    isAuthenticated = Boolean(data.user);
  }

  const cookieStore = await cookies();
  const previousCount = Number(cookieStore.get(ANON_SEARCH_COOKIE)?.value ?? '0') || 0;

  if (!isAuthenticated && !bypassAnonLimitForSample && previousCount >= FREE_ANON_SEARCH_LIMIT) {
    return NextResponse.json(
      {
        ok: false,
        requiresRegistration: true,
        error: {
          code: 'FREE_SEARCH_LIMIT_REACHED',
          message:
            'You have used your complimentary visitor search. Create a free Viewora account to continue searching public profiles and save your history.',
        },
        normalized,
      },
      { status: 429 }
    );
  }

  const result = await defaultProviderRegistry.lookupPublicProfile(normalized.username, {
    allowDemoFallback: true,
  });

  const nextCount = isAuthenticated ? previousCount : previousCount + 1;
  const response = NextResponse.json({
    ok: true,
    normalized,
    result,
    anonymousSearchesUsed: isAuthenticated ? null : nextCount,
    anonymousSearchLimit: isAuthenticated ? null : FREE_ANON_SEARCH_LIMIT,
  });

  if (!isAuthenticated && !bypassAnonLimitForSample && result.meta.availability === 'available') {
    response.cookies.set(ANON_SEARCH_COOKIE, String(nextCount), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  }

  return response;
}
