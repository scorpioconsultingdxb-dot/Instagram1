'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileDown,
  GitCompare,
  Lock,
  LogOut,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { SessionUser } from '@/lib/auth/session';
import type { FeatureKey, ResolvedEntitlements } from '@/lib/entitlements/types';
import { FEATURE_LABELS } from '@/lib/entitlements/catalog';
import { hasEntitlement } from '@/lib/entitlements/service';
import type { DataClass, PublicProfileData } from '@/lib/providers/types';
import { generateStructuredProfileInsights } from '@/lib/reports/export';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';

export interface DashboardSavedProfile {
  profile: PublicProfileData;
  dataClass: DataClass;
  providerLabel: string;
  workspace: string;
}

type DashboardTab =
  | 'overview'
  | 'profiles'
  | 'analytics'
  | 'timeline'
  | 'calendar'
  | 'competitors'
  | 'ai'
  | 'notifications'
  | 'exports'
  | 'billing';

const AGENCY_WORKSPACES = [
  'Primary Agency HQ',
  'Client: Aurora Roasters',
  'Client: Nordic Interiors',
];

export function CustomerDashboard({
  locale,
  dict,
  user,
  entitlements,
  initialProfiles,
  isAdmin,
}: {
  locale: Locale;
  dict: Dictionary;
  user: SessionUser;
  entitlements: ResolvedEntitlements;
  initialProfiles: DashboardSavedProfile[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [activeWorkspace, setActiveWorkspace] = useState(
    user.segment === 'agency' ? AGENCY_WORKSPACES[0]! : 'Personal Workspace'
  );
  const [savedProfiles, setSavedProfiles] = useState<DashboardSavedProfile[]>(initialProfiles);
  const [selectedUsername, setSelectedUsername] = useState<string>(
    initialProfiles[0]?.profile.username ?? 'viewora.studio'
  );
  const [addInput, setAddInput] = useState('');
  const [addStatus, setAddStatus] = useState<string | null>(null);
  const [notifications, setNotifications] = useState([
    {
      id: 'n1',
      title: 'Labeled demo profiles ready',
      body: 'Explore historical charts, calendar cadence, and exports with clearly marked Demo Data.',
      read: false,
      time: 'Today',
    },
    {
      id: 'n2',
      title: 'Data transparency reminder',
      body: 'Connect Official Meta API credentials in your deployment to replace demo fixtures with live business insights.',
      read: false,
      time: 'Yesterday',
    },
  ]);
  const [emailPrefs, setEmailPrefs] = useState(user.emailPreferences);
  const [prefSaved, setPrefSaved] = useState(false);

  const selectedEntry =
    savedProfiles.find((p) => p.profile.username === selectedUsername) ?? savedProfiles[0];

  const trackedLimit = entitlements.rules.tracked_profiles.numericLimit ?? 1;
  const canHistory = hasEntitlement(entitlements, 'historical_analytics_days');
  const canCompetitors = hasEntitlement(entitlements, 'competitor_monitoring');
  const canAi = hasEntitlement(entitlements, 'ai_profile_reports');
  const canCsv = hasEntitlement(entitlements, 'csv_export');
  const canPdf = hasEntitlement(entitlements, 'pdf_export');
  const canAgency = hasEntitlement(entitlements, 'agency_dashboard');

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push(`/${locale}`);
    router.refresh();
  };

  const handleAddProfile = async () => {
    setAddStatus(null);
    if (!hasEntitlement(entitlements, 'tracked_profiles', savedProfiles.length)) {
      setAddStatus(
        `Your ${entitlements.planName} plan supports up to ${trackedLimit} saved profiles. Remove one or preview an upgraded tier.`
      );
      return;
    }

    const res = await fetch(`/api/search?q=${encodeURIComponent(addInput)}&preview=demo`);
    const json = (await res.json()) as {
      ok: boolean;
      error?: { message: string };
      result?: { data: PublicProfileData | null; meta: { dataClass: DataClass; providerLabel: string; notice: string } };
    };

    if (!json.ok || !json.result?.data) {
      setAddStatus(json.error?.message || json.result?.meta.notice || 'Profile unavailable.');
      return;
    }

    const found = json.result.data;
    if (savedProfiles.some((p) => p.profile.username === found.username)) {
      setAddStatus(`@${found.username} is already saved.`);
      return;
    }

    setSavedProfiles([
      ...savedProfiles,
      {
        profile: found,
        dataClass: json.result.meta.dataClass,
        providerLabel: json.result.meta.providerLabel,
        workspace: activeWorkspace,
      },
    ]);
    setSelectedUsername(found.username);
    setAddInput('');
    setAddStatus(`Saved @${found.username} (${json.result.meta.dataClass}).`);
  };

  const handleRemoveProfile = (username: string) => {
    const next = savedProfiles.filter((p) => p.profile.username !== username);
    setSavedProfiles(next);
    if (selectedUsername === username && next[0]) {
      setSelectedUsername(next[0].profile.username);
    }
  };

  const saveEmailPreferences = async () => {
    setPrefSaved(false);
    await fetch('/api/auth/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailPreferences: emailPrefs }),
    });
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2500);
  };

  const tabs: Array<{ id: DashboardTab; label: string; icon: typeof Activity }> = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'profiles', label: 'Saved Profiles', icon: Users },
    { id: 'analytics', label: 'Charts', icon: BarChart3 },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'competitors', label: 'Competitors', icon: GitCompare },
    { id: 'ai', label: 'AI Insights', icon: Sparkles },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'exports', label: 'Exports', icon: FileDown },
    { id: 'billing', label: 'Plan & Limits', icon: CreditCard },
  ];

  const aiReport = selectedEntry
    ? generateStructuredProfileInsights({
        profile: selectedEntry.profile,
        dataClass: selectedEntry.dataClass,
      })
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Identity & Segment Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {user.fullName}
            </h1>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {user.segment} Mode
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {entitlements.planName} Plan
            </span>
            <ProvenanceBadge dataClass="demo" labels={dict.provenance} />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {user.email} ·{' '}
            {user.segment === 'agency'
              ? 'Multi-client agency reporting & team controls enabled.'
              : user.segment === 'business'
                ? 'Competitor monitoring, content trends & AI insight workflow.'
                : 'Streamlined public profile viewing & quick personal analytics.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {user.segment === 'agency' || canAgency ? (
            <label className="inline-flex items-center gap-1.5 text-xs">
              <Building2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span className="sr-only">Workspace</span>
              <select
                value={activeWorkspace}
                onChange={(e) => setActiveWorkspace(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                {AGENCY_WORKSPACES.map((ws) => (
                  <option key={ws} value={ws}>
                    {ws}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {isAdmin ? (
            <Link
              href={`/${locale}/admin`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
            >
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              Admin Console
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Dashboard sections"
        className="mt-6 flex gap-1.5 overflow-x-auto pb-2"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Profile Selector Bar */}
      {savedProfiles.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-100/70 px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Active profile:
            </span>
            {savedProfiles.map((item) => (
              <button
                key={item.profile.username}
                type="button"
                onClick={() => setSelectedUsername(item.profile.username)}
                className={`rounded-lg px-2.5 py-1 font-mono text-xs transition ${
                  selectedEntry?.profile.username === item.profile.username
                    ? 'bg-indigo-600 font-semibold text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                @{item.profile.username}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            All sample series are clearly labeled as Demo Data.
          </span>
        </div>
      ) : null}

      {/* TAB CONTENT */}
      <div className="mt-6">
        {activeTab === 'overview' ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Saved Profiles Quota"
                value={`${savedProfiles.length} / ${trackedLimit}`}
                hint={`${entitlements.planName} plan allocation`}
              />
              <StatCard
                label="Daily Search Allowance"
                value={`${entitlements.rules.daily_searches.numericLimit ?? '∞'} / day`}
                hint="Centralized entitlement limit"
              />
              <StatCard
                label="Historical Window"
                value={
                  canHistory
                    ? `${entitlements.rules.historical_analytics_days.numericLimit} days`
                    : 'Current snapshot'
                }
                hint={canHistory ? 'Public trend history active' : 'Upgrade preview available'}
              />
              <StatCard
                label="Workspaces"
                value={`${entitlements.rules.workspaces.numericLimit ?? '∞'}`}
                hint={`Active: ${activeWorkspace}`}
              />
            </div>

            {selectedEntry ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Snapshot Overview — @{selectedEntry.profile.username}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedEntry.profile.displayName} · {selectedEntry.providerLabel}
                    </p>
                  </div>
                  <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <StatCard
                    label="Followers"
                    value={(selectedEntry.profile.followersCount ?? 0).toLocaleString()}
                    hint={selectedEntry.dataClass}
                  />
                  <StatCard
                    label="Following"
                    value={(selectedEntry.profile.followingCount ?? 0).toLocaleString()}
                    hint={selectedEntry.dataClass}
                  />
                  <StatCard
                    label="Public Posts"
                    value={(selectedEntry.profile.postsCount ?? 0).toLocaleString()}
                    hint={selectedEntry.dataClass}
                  />
                  <StatCard
                    label="Est. Engagement"
                    value={`${selectedEntry.profile.estimatedEngagementRate ?? '—'}%`}
                    hint="Transparent estimate"
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'profiles' ? (
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Saved Public Profiles ({savedProfiles.length} / {trackedLimit})
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addInput}
                  onChange={(e) => setAddInput(e.target.value)}
                  placeholder="Add @nordic.design or @solaris.fitness"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => void handleAddProfile()}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Save
                </button>
              </div>
            </div>

            {addStatus ? (
              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{addStatus}</p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {savedProfiles.map((item) => (
                <div
                  key={item.profile.username}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                        @{item.profile.username}
                      </span>
                      <ProvenanceBadge dataClass={item.dataClass} labels={dict.provenance} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{item.profile.displayName}</p>
                    <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">
                      {(item.profile.followersCount ?? 0).toLocaleString()} followers ·{' '}
                      {item.profile.estimatedEngagementRate ?? '—'}% est. ER
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUsername(item.profile.username);
                        setActiveTab('analytics');
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      View charts
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveProfile(item.profile.username)}
                      aria-label={`Remove @${item.profile.username}`}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === 'analytics' && selectedEntry ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Interactive Public Trend Charts — @{selectedEntry.profile.username}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Follower count &amp; engagement progression across recorded checkpoints.
                </p>
              </div>
              <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
            </div>

            {!canHistory ? (
              <LockedFeatureNotice
                locale={locale}
                title="Historical Trend Charts (Starter+ Plan)"
                description="Upgrade from Free to unlock 30–730 days of historical public follower-count charts."
              />
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <FollowerSvgChart points={selectedEntry.profile.historicalTrend} />
                <EngagementBarChart points={selectedEntry.profile.historicalTrend} />
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'timeline' && selectedEntry ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Historical Snapshot Timeline — @{selectedEntry.profile.username}
              </h2>
              <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
            </div>
            <ol className="mt-5 space-y-3 border-l-2 border-indigo-200 pl-4 dark:border-indigo-900">
              {selectedEntry.profile.historicalTrend
                .slice()
                .reverse()
                .map((pt) => (
                  <li
                    key={pt.date}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                      <span>{pt.date}</span>
                      <span>{pt.followers.toLocaleString()} followers</span>
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-400">
                      {pt.posts} total public posts · {pt.engagementRate}% estimated engagement rate
                    </p>
                  </li>
                ))}
            </ol>
          </div>
        ) : null}

        {activeTab === 'calendar' && selectedEntry ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Calendar Activity View — November 2026
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Public posting cadence and recorded snapshot days for @
                  {selectedEntry.profile.username}.
                </p>
              </div>
              <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="font-semibold text-slate-500">
                  {d}
                </div>
              ))}
              {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
                const dateStr = `2026-11-${String(day).padStart(2, '0')}`;
                const matchingPost = selectedEntry.profile.recentPosts.find((p) =>
                  p.publishedAt.startsWith(dateStr)
                );
                return (
                  <div
                    key={day}
                    className={`min-h-16 rounded-xl border p-2 text-left ${
                      matchingPost
                        ? 'border-indigo-400 bg-indigo-50/80 dark:border-indigo-700 dark:bg-indigo-950/50'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950'
                    }`}
                  >
                    <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      {day}
                    </span>
                    {matchingPost ? (
                      <p className="mt-1 truncate rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {matchingPost.mediaType}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeTab === 'competitors' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Competitor Monitoring Matrix
              </h2>
              <ProvenanceBadge dataClass="demo" labels={dict.provenance} />
            </div>

            {!canCompetitors ? (
              <LockedFeatureNotice
                locale={locale}
                title="Competitor Monitoring (Premium+ Plan)"
                description="Track multi-account competitor sets, side-by-side engagement deltas, and cadence shifts."
              />
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                      <th className="py-2.5 pr-4">Profile</th>
                      <th className="py-2.5 pr-4">Followers</th>
                      <th className="py-2.5 pr-4">Est. ER</th>
                      <th className="py-2.5 pr-4">Posts / wk</th>
                      <th className="py-2.5">Provenance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {savedProfiles.map((item) => (
                      <tr key={item.profile.username}>
                        <td className="py-3 pr-4 font-mono font-semibold text-slate-900 dark:text-white">
                          @{item.profile.username}
                        </td>
                        <td className="py-3 pr-4">
                          {(item.profile.followersCount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 font-semibold text-indigo-600 dark:text-indigo-400">
                          {item.profile.estimatedEngagementRate ?? '—'}%
                        </td>
                        <td className="py-3 pr-4">{item.profile.postingCadencePerWeek ?? '—'}</td>
                        <td className="py-3">
                          <ProvenanceBadge dataClass={item.dataClass} labels={dict.provenance} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'ai' && aiReport ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  AI Profile Report — @{aiReport.username}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{aiReport.modelLabel}</p>
              </div>
              <ProvenanceBadge dataClass={aiReport.dataClass} labels={dict.provenance} />
            </div>

            {!canAi ? (
              <LockedFeatureNotice
                locale={locale}
                title="AI-Generated Profile Reports (Starter+ Plan)"
                description="Unlock structured AI diagnostics, content strategy recommendations, and executive summaries."
              />
            ) : (
              <div className="mt-5 space-y-4">
                <p className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-sm text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100">
                  {aiReport.executiveSummary}
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-emerald-700 uppercase dark:text-emerald-400">
                      Strengths
                    </h3>
                    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-slate-600 dark:text-slate-300">
                      {aiReport.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-amber-700 uppercase dark:text-amber-400">
                      Opportunities
                    </h3>
                    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-slate-600 dark:text-slate-300">
                      {aiReport.opportunities.length > 0 ? (
                        aiReport.opportunities.map((o) => <li key={o}>{o}</li>)
                      ) : (
                        <li>Core baseline signals look healthy across recent checkpoints.</li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-indigo-700 uppercase dark:text-indigo-400">
                      Recommended Next Steps
                    </h3>
                    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-slate-600 dark:text-slate-300">
                      {aiReport.recommendedActions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'notifications' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                In-App Notifications
              </h2>
              <div className="mt-4 space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-3.5 text-xs ${
                      n.read
                        ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950'
                        : 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-white">{n.title}</span>
                      <span className="text-[11px] text-slate-500">{n.time}</span>
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{n.body}</p>
                    {!n.read ? (
                      <button
                        type="button"
                        onClick={() =>
                          setNotifications((prev) =>
                            prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                          )
                        }
                        className="mt-2 text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Mark as read
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                User-Controlled Email Preferences
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Choose exactly which emails you want to receive. Changes save immediately.
              </p>
              <div className="mt-4 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                {(
                  [
                    ['trackingAlerts', 'Saved profile tracking alerts'],
                    ['weeklyDigest', 'Weekly analytics digest'],
                    ['productUpdates', 'Product updates & new tools'],
                    ['marketing', 'Promotional offers'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={emailPrefs[key]}
                      onChange={(e) => setEmailPrefs({ ...emailPrefs, [key]: e.target.checked })}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void saveEmailPreferences()}
                className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Save Email Preferences
              </button>
              {prefSaved ? (
                <span className="ml-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Saved
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeTab === 'exports' && selectedEntry ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Report Downloads — @{selectedEntry.profile.username}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Every exported file is stamped with data source, provenance class, and export
              timestamp. Enforced server-side via centralized entitlements.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  CSV Data Export
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Download profile summary and historical checkpoints as a clean spreadsheet file.
                </p>
                {canCsv ? (
                  <a
                    href={`/api/dashboard/export?format=csv&username=${encodeURIComponent(selectedEntry.profile.username)}`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <FileDown className="h-4 w-4" aria-hidden="true" />
                    Download CSV
                  </a>
                ) : (
                  <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    Requires Starter plan or higher
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Printable PDF Report
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Client-ready printable report including provenance badge and snapshot history.
                </p>
                {canPdf ? (
                  <a
                    href={`/api/dashboard/export?format=pdf&username=${encodeURIComponent(selectedEntry.profile.username)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <FileDown className="h-4 w-4" aria-hidden="true" />
                    Open PDF Report
                  </a>
                ) : (
                  <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    Requires Premium plan or higher
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'billing' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Subscription &amp; Centralized Entitlements
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Active Plan: <strong>{entitlements.planName}</strong> (
                  {entitlements.billingInterval}) · Live payments are disabled.
                </p>
              </div>
              <Link
                href={`/${locale}/pricing`}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Compare Plans (Demo)
              </Link>
            </div>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((key) => {
                const rule = entitlements.rules[key];
                const meta = FEATURE_LABELS[key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {meta.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        rule.enabled
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      {rule.enabled ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {rule.numericLimit === null ? 'Unlimited' : rule.numericLimit}
                        </>
                      ) : (
                        'Locked'
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

function LockedFeatureNotice({
  locale,
  title,
  description,
}: {
  locale: Locale;
  title: string;
  description: string;
}) {
  return (
    <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{description}</p>
          <Link
            href={`/${locale}/pricing`}
            className="mt-3 inline-block rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Explore Plans (Demo Pricing)
          </Link>
        </div>
      </div>
    </div>
  );
}

function FollowerSvgChart({
  points,
}: {
  points: PublicProfileData['historicalTrend'];
}) {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.followers));
  const min = Math.min(...points.map((p) => p.followers));
  const range = Math.max(1, max - min);

  const svgPoints = points
    .map((pt, idx) => {
      const x = 24 + (idx / Math.max(1, points.length - 1)) * 272;
      const y = 120 - ((pt.followers - min) / range) * 90;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        Follower Count Progression (Demo Series)
      </h3>
      <svg viewBox="0 0 320 150" className="mt-3 h-44 w-full" role="img" aria-label="Follower trend line chart">
        <polyline
          fill="none"
          stroke="#4f46e5"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={svgPoints}
        />
        {points.map((pt, idx) => {
          const x = 24 + (idx / Math.max(1, points.length - 1)) * 272;
          const y = 120 - ((pt.followers - min) / range) * 90;
          return (
            <g key={pt.date}>
              <circle cx={x} cy={y} r="4" fill="#4f46e5" />
              <text x={x} y="142" textAnchor="middle" fontSize="9" fill="#64748b">
                {pt.date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function EngagementBarChart({
  points,
}: {
  points: PublicProfileData['historicalTrend'];
}) {
  if (points.length === 0) return null;
  const maxEr = Math.max(...points.map((p) => p.engagementRate), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        Estimated Engagement Rate by Checkpoint (%)
      </h3>
      <div className="mt-4 flex h-44 items-end justify-between gap-2 pt-4">
        {points.map((pt) => {
          const heightPercent = Math.max(12, Math.round((pt.engagementRate / maxEr) * 100));
          return (
            <div key={pt.date} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                {pt.engagementRate}%
              </span>
              <div
                className="w-full max-w-10 rounded-t-lg bg-indigo-500/85"
                style={{ height: `${heightPercent}%` }}
              />
              <span className="font-mono text-[10px] text-slate-500">{pt.date.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
