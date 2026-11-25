import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  buildSessionCookieOptions,
  deleteLocalUser,
  getCurrentSessionUser,
  LOCAL_SESSION_COOKIE,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';
import { deleteAccountProfilePrefs } from '@/lib/auth/profile-prefs';
import { deleteUserWorkspaceState } from '@/lib/dashboard/store';
import { persistAuditLog } from '@/lib/admin/store';
import { isDatabaseConfigured } from '@/lib/env';
import { deleteDbUserAccount } from '@/lib/db/repositories/users.repo';
import { defaultFileStorage } from '@/lib/storage/local-files';

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

  if (isDatabaseConfigured()) {
    try {
      await deleteDbUserAccount(user.id, user.email);
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error:
            err instanceof Error
              ? `Account deletion failed: ${err.message}`
              : 'Unable to delete account in database.',
        },
        { status: 500 }
      );
    }
  } else {
    deleteLocalUser(user.id);
    await persistAuditLog({
      actorId: 'system',
      actorEmail: user.email,
      action: 'user.account.deleted',
      targetType: 'user',
      targetId: user.id,
      diff: { selfServiceDeletion: true, deletedUserId: user.id },
    });
  }

  // Always purge any local dev preferences, workspace records, and stored customer files
  deleteAccountProfilePrefs(user.id);
  deleteUserWorkspaceState(user.id);
  await defaultFileStorage.deleteOwnerNamespace(user.id).catch(() => undefined);

  const response = NextResponse.json({
    ok: true,
    message: 'Your account deletion request has been processed and all active sessions ended.',
  });
  const expiredOpts = buildSessionCookieOptions(0);
  response.cookies.set(SESSION_COOKIE_NAME, '', expiredOpts);
  response.cookies.set(LOCAL_SESSION_COOKIE, '', expiredOpts);
  response.cookies.set('viewora.authjs.session-token', '', expiredOpts);
  response.cookies.set('__Secure-viewora.authjs.session-token', '', expiredOpts);
  return response;
}
