import { NextResponse } from 'next/server';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { resolveEntitlements } from '@/lib/entitlements/service';

/**
 * GDPR / LGPD / UAE PDPL Personal Data Export endpoint.
 * Returns the authenticated user's own account data only.
 */
export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    dataController: 'Viewora',
    account: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      segment: user.segment,
      role: user.role,
      planCode: user.planCode,
      billingInterval: user.billingInterval,
      emailPreferences: user.emailPreferences,
      authMode: user.authMode,
    },
    entitlements,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="viewora-personal-data-${user.id}.json"`,
    },
  });
}
