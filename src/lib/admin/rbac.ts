import { NextResponse } from 'next/server';
import { getCurrentSessionUser, isAdminRole, type SessionUser } from '@/lib/auth/session';

export type AdminGuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

export function checkAdminAuthorization(user: SessionUser | null): {
  allowed: boolean;
  status: 200 | 401 | 403;
  reason?: string;
} {
  if (!user) {
    return { allowed: false, status: 401, reason: 'Authentication required.' };
  }
  if (!isAdminRole(user.role)) {
    return {
      allowed: false,
      status: 403,
      reason: 'Administrator role is required for this operation.',
    };
  }
  return { allowed: true, status: 200 };
}

/**
 * Server-side RBAC guard for all /api/admin/* endpoints.
 */
export async function requireAdminApi(): Promise<AdminGuardResult> {
  const user = await getCurrentSessionUser();
  const check = checkAdminAuthorization(user);

  if (!check.allowed || !user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: check.reason }, { status: check.status }),
    };
  }

  return { ok: true, user };
}
