import { MailCheck } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="viewora-card-elevated rounded-3xl p-8">
        <div className="text-center">
          <MailCheck className="mx-auto h-10 w-10 text-[#7957FF]" aria-hidden="true" />
          <h1 className="mt-4 font-display text-xl font-extrabold text-[#0F172A] dark:text-white">
            Verify your email address
          </h1>
          <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
            Confirm your Viewora account using your single-use verification token. External email
            delivery remains disabled until configured.
          </p>
        </div>
        <div className="mt-6">
          <VerifyEmailForm locale={safeLocale} initialToken={token ?? ''} />
        </div>
      </div>
    </div>
  );
}
