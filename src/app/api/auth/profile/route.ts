import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSessionUser, upsertLocalUser } from '@/lib/auth/session';
import { profilePatchSchema, saveExtendedProfilePrefs } from '@/lib/auth/profile-prefs';
import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid profile update payload.' }, { status: 400 });
  }

  const merged = saveExtendedProfilePrefs(user.id, parsed.data);

  if (parsed.data.fullName) {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      await supabase
        ?.from('profiles')
        .update({ full_name: parsed.data.fullName.trim() })
        .eq('id', user.id);
    } else {
      upsertLocalUser({ ...user, fullName: parsed.data.fullName.trim() });
    }
  }

  return NextResponse.json({ ok: true, profile: merged });
}
