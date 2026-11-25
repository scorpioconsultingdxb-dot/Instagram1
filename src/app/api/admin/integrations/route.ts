import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/rbac';
import { defaultApiGateway } from '@/lib/integrations';

/**
 * Super Admin Integration Center telemetry endpoint (Stage 41).
 * Protected by server-side admin RBAC.
 * Strictly NEVER returns raw API keys, tokens, secrets, or database URLs — only
 * boolean presence, missing env var names, feature-flag states, capabilities,
 * resilience policies, circuit states, cost caps, and redacted request logs.
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const snapshot = defaultApiGateway.getIntegrationCenterSnapshot();
  return NextResponse.json(
    {
      ok: true,
      actor: { email: guard.user.email, role: guard.user.role },
      integrationCenter: snapshot,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    }
  );
}
