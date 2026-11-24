import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { defaultProviderRegistry } from '@/lib/providers';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';

export const dynamic = 'force-dynamic';

export default async function SavedProfileDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/${safeLocale}/login?next=/${safeLocale}/dashboard/profiles/${encodeURIComponent(id)}`);
  }

  const dict = getDictionary(safeLocale);
  const lookup = await defaultProviderRegistry.lookupPublicProfile(id, {
    allowDemoFallback: true,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={`/${safeLocale}/dashboard/profiles`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#7957FF]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to Saved Profiles
      </Link>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#131C2E]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold text-[#0F172A] dark:text-white">@{id}</h1>
          <ProvenanceBadge
            dataClass={lookup.data ? lookup.meta.dataClass : 'unavailable'}
            labels={dict.provenance}
          />
        </div>
        <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
          {lookup.data ? lookup.data.bio : lookup.meta.notice}
        </p>
        {lookup.data ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500">Followers</p>
              <p className="mt-1 text-lg font-bold">
                {(lookup.data.followersCount ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500">Following</p>
              <p className="mt-1 text-lg font-bold">
                {(lookup.data.followingCount ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500">Posts</p>
              <p className="mt-1 text-lg font-bold">
                {(lookup.data.postsCount ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500">Est. ER</p>
              <p className="mt-1 text-lg font-bold">{lookup.data.estimatedEngagementRate ?? '—'}%</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
