import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser, upsertLocalUser } from '@/lib/auth/session';
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import { updateDbAccountPreferences } from '@/lib/db/repositories/users.repo';

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

  if (isDatabaseConfigured()) {
    try {
      await updateDbAccountPreferences(user.id, {
        segment: parsed.data.segment,
        emailPreferences: parsed.data.emailPreferences,
      });
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error:
            err instanceof Error
              ? `Could not save preferences: ${err.message}`
              : 'Could not save preferences to PostgreSQL.',
        },
        { status: 500 }
      );
    }
  } else if (isLocalDevFallbackAllowed()) {
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
  } else {
    return NextResponse.json(
      { ok: false, error: 'PostgreSQL database is not configured. Preferences were not saved.' },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, persistedAt: new Date().toISOString() });
}
