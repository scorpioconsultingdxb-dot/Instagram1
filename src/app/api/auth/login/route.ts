import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isDemoModeEnabled, isSupabaseConfigured } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  deriveLocalUserId,
  encodeSignedSessionCookie,
  listLocalDemoUsers,
  LOCAL_SESSION_COOKIE,
  upsertLocalUser,
} from '@/lib/auth/session';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Please enter a valid email address and password (min 6 characters).' },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'Auth service unavailable.' }, { status: 503 });
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }
    return NextResponse.json({ ok: true, mode: 'supabase' });
  }

  // Server-controlled Demo Mode guard: never allow local demo auth when DEMO_MODE_ENABLED=false
  if (!isDemoModeEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Authentication requires configured Supabase credentials. Demo authentication is disabled by default (DEMO_MODE_ENABLED=false).',
      },
      { status: 503 }
    );
  }

  // Isolated Demo Mode (only when explicitly enabled via DEMO_MODE_ENABLED=true)
  const existing = listLocalDemoUsers().find((u) => u.email.toLowerCase() === email);
  const user =
    existing ??
    upsertLocalUser({
      id: deriveLocalUserId(email),
      email,
      fullName: email.split('@')[0] ?? 'Viewora User',
      role: 'user',
      segment: 'personal',
      planCode: 'free',
      billingInterval: 'monthly',
      onboardingCompleted: true,
      emailPreferences: {
        productUpdates: false,
        weeklyDigest: false,
        trackingAlerts: true,
        marketing: false,
      },
      authMode: 'local_demo',
    });

  const response = NextResponse.json({ ok: true, mode: 'local_demo', user });
  response.cookies.set(LOCAL_SESSION_COOKIE, encodeSignedSessionCookie(user.email), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
