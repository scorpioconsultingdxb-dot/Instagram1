import { NextResponse, type NextRequest } from 'next/server';
import { normalizeInstagramInput } from '@/lib/instagram/normalize';
import { defaultProviderRegistry } from '@/lib/providers';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const normalized = normalizeInstagramInput(query);

  if (!normalized.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: normalized.code,
          message: normalized.message,
        },
      },
      { status: 400 }
    );
  }

  const result = await defaultProviderRegistry.lookupStoryAvailability(normalized.username, {
    allowDemoFallback: true,
  });

  return NextResponse.json({
    ok: true,
    normalized,
    result,
  });
}
