import { NextResponse, type NextRequest } from 'next/server';
import { verifySignedUnsubscribeToken } from '@/lib/email/templates';
import { addEmailSuppression } from '@/lib/db/repositories/email.repo';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const check = verifySignedUnsubscribeToken(token);
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  }

  await addEmailSuppression(check.email, 'unsubscribed');
  return NextResponse.json({
    ok: true,
    unsubscribed: true,
    message:
      'You have been unsubscribed from optional Viewora engagement emails. Mandatory account security emails remain active.',
  });
}
