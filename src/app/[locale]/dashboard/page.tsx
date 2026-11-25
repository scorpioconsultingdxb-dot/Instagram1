import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { getCurrentSessionUser, isAdminRole } from '@/lib/auth/session';
import { getAccountProfilePrefs } from '@/lib/auth/profile-prefs';
import {
  loadConfiguredPlans,
  loadUserEntitlementOverrides,
  resolveEntitlements,
} from '@/lib/entitlements/service';
import { defaultProviderRegistry } from '@/lib/providers';
import {
  loadUserWorkspaceState,
  type SavedProfileRecord,
} from '@/lib/dashboard/store';
import { loadActiveBroadcastNotifications } from '@/lib/admin/store';
import { CustomerDashboard } from '@/components/dashboard/CustomerDashboard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  return buildPageMetadata({
    locale: safeLocale,
    path: '/dashboard',
    title: 'Customer Dashboard',
    description: 'Manage saved public Instagram profiles, folders, notes, analytics charts, and reports.',
    noIndex: true,
  });
}

async function buildExplicitDemoPreviewProfiles(workspaceName: string): Promise<SavedProfileRecord[]> {
  const handles = ['viewora.studio', 'aurora.coffee', 'nordic.design'];
  const list: SavedProfileRecord[] = [];
  const now = new Date().toISOString();
  for (const handle of handles) {
    const res = await defaultProviderRegistry.lookupPublicProfile(handle, {
      allowDemoFallback: true,
    });
    if (res.data) {
      list.push({
        id: `demo-preview-${res.data.username}`,
        username: res.data.username,
        profile: res.data,
        dataClass: res.meta.dataClass,
        providerLabel: res.meta.providerLabel,
        workspace: workspaceName,
        folderId: null,
        tags: ['demo-preview'],
        privateNote: '',
        savedAt: now,
        updatedAt: now,
      });
    }
  }
  return list;
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ demo?: string; saved?: string }>;
}) {
  const { locale } = await params;
  const { demo, saved } = await searchParams;
  const safeLocale: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(`/${safeLocale}/login?next=/${safeLocale}/dashboard`);
  }

  const dict = getDictionary(safeLocale);
  const [plans, overrides, profilePrefs, broadcasts] = await Promise.all([
    loadConfiguredPlans(),
    loadUserEntitlementOverrides(user.id),
    getAccountProfilePrefs(user.id),
    loadActiveBroadcastNotifications(user.segment),
  ]);
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
    plans,
    overrides,
  });

  const defaultWs =
    profilePrefs.workspaceName ||
    (user.segment === 'agency' ? 'Primary Agency HQ' : 'Personal Workspace');
  const [workspace, demoPreviewProfiles] = await Promise.all([
    loadUserWorkspaceState(user.id, defaultWs),
    buildExplicitDemoPreviewProfiles(defaultWs),
  ]);

  const queuedHandle = saved?.trim() ? saved.trim().replace(/^@+/, '') : undefined;

  return (
    <CustomerDashboard
      locale={safeLocale}
      dict={dict}
      user={user}
      entitlements={entitlements}
      initialWorkspace={workspace}
      demoPreviewProfiles={demoPreviewProfiles}
      profilePrefs={profilePrefs}
      broadcasts={broadcasts}
      isAdmin={isAdminRole(user.role)}
      initialTab={queuedHandle ? 'profiles' : 'overview'}
      initialDemoPreview={demo === '1'}
      initialSavedHandle={queuedHandle}
    />
  );
}
