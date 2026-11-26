import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/rbac';
import { defaultApiGateway, loadPersistentIntegrationTelemetry } from '@/lib/integrations';

/**
 * Super Admin Integration Center telemetry endpoint (Stages 41–45).
 * Combines centralized gateway catalog/policies with durable PostgreSQL
 * kill-switch states, actual spend, and sanitized persisted errors.
 * Strictly NEVER exposes raw API keys, tokens, secrets, or database URLs.
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const [snapshot, persistentTelemetry] = await Promise.all([
    Promise.resolve(defaultApiGateway.getIntegrationCenterSnapshot()),
    loadPersistentIntegrationTelemetry().catch(() => null),
  ]);

  return NextResponse.json(
    {
      ok: true,
      actor: { email: guard.user.email, role: guard.user.role },
      integrationCenter: snapshot,
      distributedTelemetry: persistentTelemetry,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    }
  );
}
