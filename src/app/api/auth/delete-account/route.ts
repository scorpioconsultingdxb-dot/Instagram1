import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
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
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import { deleteDbUserAccount } from '@/lib/db/repositories/users.repo';
import { defaultFileStorage } from '@/lib/storage/local-files';

const deleteSchema = z.object({
  confirmEmail: z.string().email(),
});

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

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
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Database service is temporarily unavailable. Account was not deleted.' },
        { status: 503 }
      );
    }
  } else if (isLocalDevFallbackAllowed()) {
    deleteLocalUser(user.id);
    await persistAuditLog({
      actorId: 'system',
      actorEmail: user.email,
      action: 'user.account.deleted',
      targetType: 'user',
      targetId: user.id,
      diff: { selfServiceDeletion: true, deletedUserId: user.id },
    });
  } else {
    return NextResponse.json(
      { ok: false, error: 'Database service is unavailable.' },
      { status: 503 }
    );
  }

  if (!isDatabaseConfigured()) {
    deleteAccountProfilePrefs(user.id);
    deleteUserWorkspaceState(user.id);
  }
  await defaultFileStorage.deleteOwnerNamespace(user.id).catch(() => undefined);

  const response = NextResponse.json({
    ok: true,
    message: 'Your account deletion request has been processed and all active sessions ended.',
  });
  const expiredOpts = buildSessionCookieOptions(0);
  response.cookies.set(SESSION_COOKIE_NAME, '', expiredOpts);
  response.cookies.set(LOCAL_SESSION_COOKIE, '', expiredOpts);
  response.cookies.set('viewora.authjs.session-token', '', expiredOpts);
  response.cookies.set('__Host-viewora.authjs.session-token', '', expiredOpts);
  return response;
}
