import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/rbac';
import { getEnv, isEmailDeliveryEnabled } from '@/lib/env';
import { isProviderEffectivelyEnabled } from '@/lib/integrations';
import { loadAdminCommunicationOverview } from '@/lib/db/repositories/email.repo';
import { EMAIL_TEMPLATE_CATALOG } from '@/lib/email/templates';

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const env = getEnv();
  const providerEnabled =
    isEmailDeliveryEnabled() && isProviderEffectivelyEnabled('resend_email');
  const overview = await loadAdminCommunicationOverview(
    providerEnabled,
    env.EMAIL_FROM_ADDRESS
  );

  return NextResponse.json(
    {
      ok: true,
      overview,
      templates: EMAIL_TEMPLATE_CATALOG,
      locales: ['en', 'pt-BR', 'es', 'de', 'fr'],
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
