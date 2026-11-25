import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { deleteLocalUser, getCurrentSessionUser, LOCAL_SESSION_COOKIE } from '@/lib/auth/session';
import { deleteAccountProfilePrefs } from '@/lib/auth/profile-prefs';
import { deleteUserWorkspaceState } from '@/lib/dashboard/store';
import { recordAuditLog } from '@/lib/admin/store';
import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';

const deleteSchema = z.object({
  confirmEmail: z.string().email(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success || parsed.data.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { ok: false, error: 'Please type your exact account email address to confirm deletion.' },
      { status: 400 }
    );
  }

  if (isSupabaseConfigured()) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      await admin.auth.admin.deleteUser(user.id);
    }
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.signOut();
  } else {
    deleteLocalUser(user.id);
  }

  // Always purge local persistent preferences and private workspace records for this account
  deleteAccountProfilePrefs(user.id);
  deleteUserWorkspaceState(user.id);

  recordAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: 'user.account.deleted',
    targetType: 'user',
    targetId: user.id,
    diff: { selfServiceDeletion: true },
  });

  const response = NextResponse.json({
    ok: true,
    message: 'Your account deletion request has been processed and your session ended.',
  });
  response.cookies.set(LOCAL_SESSION_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true });
  return response;
}
