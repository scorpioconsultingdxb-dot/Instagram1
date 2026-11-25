import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getEnv, isSupabaseConfigured } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const forgotSchema = z.object({
  email: z.string().email(),
  locale: z.string().default('en'),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Please enter a valid account email address.' },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Password recovery emails require live Supabase Auth and verified email delivery. No recovery email was sent in this unconfigured environment.',
      },
      { status: 503 }
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Authentication service is temporarily unavailable.' },
      { status: 503 }
    );
  }

  const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email.trim().toLowerCase(),
    {
      redirectTo: `${appUrl}/${parsed.data.locale}/reset-password`,
    }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message:
      'If an account exists for that email address, Supabase Auth has dispatched a signed recovery link.',
  });
}
