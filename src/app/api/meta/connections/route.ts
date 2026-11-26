import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { isDatabaseConfigured } from '@/lib/env';
import { isMetaOAuthConfigured } from '@/lib/meta/oauth';
import {
  disconnectUserProviderConnection,
  listUserProviderConnections,
} from '@/lib/db/repositories/provider-connections.repo';
import { persistAuditLog } from '@/lib/admin/store';

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const oauthEnabled = isMetaOAuthConfigured();
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: true, oauthEnabled, connections: [] });
  }

  const connections = await listUserProviderConnections(user.id);
  return NextResponse.json(
    { ok: true, oauthEnabled, connections },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}

export async function DELETE(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const connectionId = (request.nextUrl.searchParams.get('id') ?? '').trim();
  if (!connectionId) {
    return NextResponse.json({ ok: false, error: 'Missing connection id.' }, { status: 400 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database not configured.' }, { status: 503 });
  }

  const disconnected = await disconnectUserProviderConnection(user.id, connectionId);
  if (!disconnected) {
    return NextResponse.json({ ok: false, error: 'Connected account not found.' }, { status: 404 });
  }

  await persistAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    action: 'customer.meta_connection.disconnected',
    targetType: 'provider_connection',
    targetId: connectionId,
    diff: { status: 'revoked', tokenWiped: true },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, disconnected: true, id: connectionId });
}
