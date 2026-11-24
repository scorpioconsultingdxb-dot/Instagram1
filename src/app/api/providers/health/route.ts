import { NextResponse } from 'next/server';
import { defaultProviderRegistry } from '@/lib/providers';

export async function GET() {
  const health = await defaultProviderRegistry.checkAllHealth();
  return NextResponse.json({
    ok: true,
    providers: health.map((p) => ({
      providerId: p.providerId,
      providerKind: p.providerKind,
      providerLabel: p.providerLabel,
      configured: p.configured,
      status: p.status,
      checkedAt: p.checkedAt,
    })),
  });
}
