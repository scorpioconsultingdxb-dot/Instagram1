import { NextResponse } from 'next/server';
import { getCurrentSessionUser, isAdminRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      planCode: user.planCode,
      role: user.role,
      segment: user.segment,
      isAdmin: isAdminRole(user.role),
    },
  });
}
