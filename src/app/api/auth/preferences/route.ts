import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser, upsertLocalUser } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const prefsSchema = z.object({
  segment: z.enum(['personal', 'business', 'agency']).optional(),
  emailPreferences: z
    .object({
      productUpdates: z.boolean(),
      weeklyDigest: z.boolean(),
      trackingAlerts: z.boolean(),
      marketing: z.boolean(),
    })
    .optional(),
});

export async function PATCH(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid preferences payload.' }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: 'Database service unavailable. Preferences were not saved.' },
        { status: 503 }
      );
    }
    const { error } = await supabase
      .from('profiles')
      .update({
        ...(parsed.data.segment ? { segment: parsed.data.segment } : {}),
        ...(parsed.data.emailPreferences
          ? { email_preferences: parsed.data.emailPreferences }
          : {}),
        onboarding_completed: true,
      })
      .eq('id', user.id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: `Could not save preferences: ${error.message}` },
        { status: 500 }
      );
    }
  } else {
    try {
      upsertLocalUser({
        ...user,
        segment: parsed.data.segment ?? user.segment,
        emailPreferences: parsed.data.emailPreferences ?? user.emailPreferences,
        onboardingCompleted: true,
      });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error:
            err instanceof Error ? err.message : 'Unable to persist account preferences locally.',
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, persistedAt: new Date().toISOString() });
}
