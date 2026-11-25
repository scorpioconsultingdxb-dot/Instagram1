import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { loadUserWorkspaceState } from '@/lib/dashboard/store';
import { loadIsFeatureFlagEnabled } from '@/lib/admin/store';
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
  const [workspace, demoAllowed] = await Promise.all([
    loadUserWorkspaceState(user.id),
    loadIsFeatureFlagEnabled('demo_provider_enabled'),
  ]);
  const savedRecord = workspace.savedProfiles.find(
    (p) => p.username.toLowerCase() === id.toLowerCase()
  );
  const savedFolder = savedRecord?.folderId
    ? workspace.folders.find((f) => f.id === savedRecord.folderId)
    : null;

  const lookup = await defaultProviderRegistry.lookupPublicProfile(id, {
    allowDemoFallback: demoAllowed,
  });
  const profileData = savedRecord?.profile ?? lookup.data;
  const dataClass = savedRecord?.dataClass ?? (lookup.data ? lookup.meta.dataClass : 'unavailable');

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={`/${safeLocale}/dashboard/profiles`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#7957FF]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to Saved Profiles
      </Link>

      <div className="viewora-card mt-5 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-white">
              @{profileData?.username ?? id}
            </h1>
            {profileData?.displayName ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                {profileData.displayName} · {profileData.category}
              </p>
            ) : null}
          </div>
          <ProvenanceBadge dataClass={dataClass} labels={dict.provenance} />
        </div>
        <p className="mt-2 text-sm text-[#64748B] dark:text-slate-300">
          {profileData ? profileData.bio : lookup.meta.notice}
        </p>

        {savedRecord ? (
          <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[#6941EF] dark:text-[#A99AFF]">
                Saved in your workspace ({savedRecord.workspace})
              </span>
              {savedFolder ? (
                <span className="rounded-md bg-white px-2 py-0.5 font-semibold text-[#0F172A] ring-1 ring-slate-200 dark:bg-[#131C2E] dark:text-slate-200 dark:ring-[#263047]">
                  Folder: {savedFolder.name}
                </span>
              ) : null}
              {savedRecord.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-violet-100 px-2 py-0.5 font-semibold text-[#6941EF] dark:bg-violet-950 dark:text-[#A99AFF]"
                >
                  #{tag}
                </span>
              ))}
            </div>
            {savedRecord.privateNote ? (
              <p className="mt-2 leading-relaxed text-[#0F172A] dark:text-slate-200">
                <strong>Private Research Note:</strong> {savedRecord.privateNote}
              </p>
            ) : (
              <p className="mt-1.5 text-[#64748B] dark:text-[#94A3B8]">
                No private note saved yet. Edit notes from Saved Profiles.
              </p>
            )}
          </div>
        ) : null}

        {profileData ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-[#263047]">
              <p className="text-xs text-slate-500">Followers</p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums">
                {(profileData.followersCount ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-[#263047]">
              <p className="text-xs text-slate-500">Following</p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums">
                {(profileData.followingCount ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-[#263047]">
              <p className="text-xs text-slate-500">Posts</p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums">
                {(profileData.postsCount ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-[#263047]">
              <p className="text-xs text-slate-500">Est. ER</p>
              <p className="mt-1 font-display text-lg font-bold tabular-nums">
                {profileData.estimatedEngagementRate ?? '—'}%
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
