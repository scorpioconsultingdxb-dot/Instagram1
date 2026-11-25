import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSessionUser, upsertLocalUser } from '@/lib/auth/session';
import {
  getAccountProfilePrefs,
  profilePatchSchema,
  saveAccountProfilePrefs,
} from '@/lib/auth/profile-prefs';
import { loadWorkspaceUsageStats } from '@/lib/dashboard/store';
import { isDatabaseConfigured } from '@/lib/env';

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const [profile, usage] = await Promise.all([
    getAccountProfilePrefs(user.id),
    loadWorkspaceUsageStats(user.id),
  ]);

  return NextResponse.json({
    ok: true,
    profile,
    usage,
    memberSince: user.createdAt,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Invalid profile update payload. Check field lengths and shortcut paths.',
        issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      },
      { status: 400 }
    );
  }

  const saved = await saveAccountProfilePrefs(user.id, parsed.data);
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 500 });
  }

  if (parsed.data.fullName && !isDatabaseConfigured()) {
    upsertLocalUser({ ...user, fullName: parsed.data.fullName.trim() });
  }

  const response = NextResponse.json({
    ok: true,
    profile: saved.profile,
    persistedAt: saved.profile.updatedAt,
  });

  if (parsed.data.preferredLocale) {
    response.cookies.set('viewora_locale', parsed.data.preferredLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  return response;
}
