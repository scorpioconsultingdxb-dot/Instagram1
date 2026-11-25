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
import { recordFunnelEvent } from '@/lib/analytics/funnel';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(80),
  segment: z.enum(['personal', 'business', 'agency']).default('personal'),
  locale: z.string().default('en'),
  emailPreferences: z
    .object({
      productUpdates: z.boolean().default(false),
      weeklyDigest: z.boolean().default(false),
      trackingAlerts: z.boolean().default(true),
      marketing: z.boolean().default(false),
    })
    .default({
      productUpdates: false,
      weeklyDigest: false,
      trackingAlerts: true,
      marketing: false,
    }),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Please provide your name, a valid email, and a password of at least 8 characters.',
      },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'Auth service unavailable.' }, { status: 503 });
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
          segment: parsed.data.segment,
        },
      },
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    if (data.user) {
      await supabase
        .from('profiles')
        .update({
          full_name: parsed.data.fullName,
          segment: parsed.data.segment,
          preferred_locale: parsed.data.locale,
          onboarding_completed: true,
          email_preferences: parsed.data.emailPreferences,
        })
        .eq('id', data.user.id);
    }

    recordFunnelEvent({
      eventName: 'signup_completed',
      locale: parsed.data.locale,
      sessionId: data.user?.id ?? 'anon',
      userId: data.user?.id ?? null,
      properties: { segment: parsed.data.segment },
    });

    return NextResponse.json({ ok: true, mode: 'supabase' });
  }

  if (!isDemoModeEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Registration requires configured Supabase credentials. Isolated demo mode is disabled by default (DEMO_MODE_ENABLED=false).',
      },
      { status: 503 }
    );
  }

  const existingUser = listLocalDemoUsers().find((u) => u.email.toLowerCase() === email);
  if (existingUser) {
    return NextResponse.json(
      {
        ok: false,
        error: 'An account with this email already exists. Please sign in instead.',
      },
      { status: 409 }
    );
  }

  const newUser = upsertLocalUser({
    id: deriveLocalUserId(email),
    email,
    fullName: parsed.data.fullName.trim(),
    role: 'user',
    segment: parsed.data.segment,
    planCode: 'free',
    billingInterval: 'monthly',
    onboardingCompleted: true,
    emailPreferences: parsed.data.emailPreferences,
    authMode: 'local_demo',
  });

  recordFunnelEvent({
    eventName: 'signup_completed',
    locale: parsed.data.locale,
    sessionId: newUser.id,
    userId: newUser.id,
    properties: { segment: newUser.segment },
  });

  const response = NextResponse.json({ ok: true, mode: 'local_demo', user: newUser });
  response.cookies.set(LOCAL_SESSION_COOKIE, encodeSignedSessionCookie(newUser.email), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
