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
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileDown,
  GitCompare,
  LifeBuoy,
  Lock,
  LogOut,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  User,
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
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import {
  EmptyState,
  MembershipBadge,
  MetricCard,
  UpgradePreviewCard,
} from '@/components/ui/Primitives';
import { triggerCommandPalette } from '@/components/command/CommandPalette';
import { AnalyticsVisualizations } from './AnalyticsCharts';
import { AiIntelligenceStudio } from './AiIntelligenceStudio';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
      title: 'Workspace ready with labeled Demo Data',
      body: 'Explore interactive charts, AI Intelligence Studio, and PDF/CSV exports transparently.',
      read: false,
      time: 'Today',
    },
    {
      id: 'n2',
      title: 'Personalize your Digital Headquarters',
      body: 'Customize your cover banner, avatar, and accent theme in My Profile HQ.',
      read: false,
      time: 'Today',
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
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push(`/${locale}`);
    router.refresh();
  };

  const handleAddProfile = async () => {
    setAddStatus(null);
    if (!hasEntitlement(entitlements, 'tracked_profiles', savedProfiles.length)) {
      setAddStatus(
        `Your ${entitlements.planName} plan includes up to ${trackedLimit} saved profiles. Remove one or compare upgraded plans.`
      );
      return;
    }

    const res = await fetch(`/api/search?q=${encodeURIComponent(addInput)}&preview=demo`);
    const json = (await res.json()) as {
      ok: boolean;
      error?: { message: string };
      result?: {
        data: PublicProfileData | null;
        meta: { dataClass: DataClass; providerLabel: string; notice: string };
      };
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

  const navGroups: Array<{
    group: string;
    items: Array<{ id: DashboardTab; label: string; icon: typeof Activity }>;
  }> = [
    {
      group: 'Intelligence',
      items: [
        { id: 'overview', label: 'Overview', icon: Activity },
        { id: 'profiles', label: 'Saved Profiles', icon: Users },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'ai', label: 'AI Studio', icon: Sparkles },
      ],
    },
    {
      group: 'Monitoring',
      items: [
        { id: 'timeline', label: 'Activity', icon: Clock },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'competitors', label: 'Competitors', icon: GitCompare },
        { id: 'exports', label: 'Reports', icon: FileDown },
      ],
    },
    {
      group: 'Workspace',
      items: [
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'billing', label: 'Subscription', icon: CreditCard },
      ],
    },
  ];

  const initials = user.fullName
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
      <div className="flex gap-6">
        {/* Collapsible Desktop Sidebar */}
        <aside
          aria-label="Dashboard sidebar"
          className={`viewora-card hidden shrink-0 flex-col justify-between rounded-2xl p-3 transition-all duration-200 lg:flex ${
            sidebarCollapsed ? 'w-[72px]' : 'w-60'
          }`}
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between px-1.5">
              {!sidebarCollapsed ? (
                <span className="text-[11px] font-bold tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
                  Workspace
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-white"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>

            {navGroups.map((g) => (
              <div key={g.group}>
                {!sidebarCollapsed ? (
                  <p className="mb-1.5 px-2 text-[10px] font-bold tracking-wider text-[#64748B] uppercase dark:text-[#94A3B8]">
                    {g.group}
                  </p>
                ) : null}
                <div className="space-y-0.5">
                  {g.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        title={sidebarCollapsed ? item.label : undefined}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                          active
                            ? 'bg-[#7957FF] text-white shadow-xs'
                            : 'text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-white'
                        } ${sidebarCollapsed ? 'justify-center' : ''}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {!sidebarCollapsed ? <span>{item.label}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="border-t border-slate-200 pt-3 dark:border-[#263047]">
              <Link
                href={`/${locale}/dashboard/profile`}
                title={sidebarCollapsed ? 'My Profile HQ' : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-white ${
                  sidebarCollapsed ? 'justify-center' : ''
                }`}
              >
                <User className="h-4 w-4 shrink-0 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
                {!sidebarCollapsed ? <span>My Profile HQ</span> : null}
              </Link>
              <Link
                href={`/${locale}/dashboard/settings`}
                title={sidebarCollapsed ? 'Settings' : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-white ${
                  sidebarCollapsed ? 'justify-center' : ''
                }`}
              >
                <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed ? <span>Settings</span> : null}
              </Link>
              <Link
                href={`/${locale}/dashboard/support`}
                title={sidebarCollapsed ? 'Support' : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-white ${
                  sidebarCollapsed ? 'justify-center' : ''
                }`}
              >
                <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed ? <span>Support</span> : null}
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            title={sidebarCollapsed ? 'Sign out' : undefined}
            className={`mt-6 flex w-full items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-semibold text-[#64748B] hover:border-rose-300 hover:text-rose-600 dark:border-[#263047] dark:text-[#94A3B8] ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!sidebarCollapsed ? <span>Sign out</span> : null}
          </button>
        </aside>

        {/* Main Workspace Canvas */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* Top Personalized Greeting & Utility Bar */}
          <div className="viewora-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
            <div className="flex items-center gap-3.5">
              <Link
                href={`/${locale}/dashboard/profile`}
                aria-label="Open My Profile HQ"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7957FF] to-[#22D3EE] font-display text-sm font-extrabold text-white shadow-sm transition hover:scale-105"
              >
                {initials}
              </Link>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                    Welcome back, {user.fullName.split(' ')[0]}
                  </h1>
                  <MembershipBadge planCode={user.planCode} />
                  <ProvenanceBadge dataClass="demo" labels={dict.provenance} />
                </div>
                <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {activeWorkspace} · <span className="capitalize">{user.segment}</span> workflow ·{' '}
                  <Link
                    href={`/${locale}/dashboard/profile`}
                    className="font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                  >
                    Customize Personal HQ →
                  </Link>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={triggerCommandPalette}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-[#64748B] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Search</span>
                <kbd className="font-mono text-[10px]">⌘K</kbd>
              </button>

              {user.segment === 'agency' || canAgency ? (
                <label className="inline-flex items-center gap-1.5 text-xs">
                  <Building2 className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
                  <span className="sr-only">Switch workspace</span>
                  <select
                    value={activeWorkspace}
                    onChange={(e) => setActiveWorkspace(e.target.value)}
                    className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-[#0F172A] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#F8FAFC]"
                  >
                    {AGENCY_WORKSPACES.map((ws) => (
                      <option key={ws} value={ws}>
                        {ws}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                aria-label={`Notifications (${unreadCount} unread)`}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#64748B] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#7957FF] text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </button>

              {isAdmin ? (
                <Link
                  href={`/${locale}/admin`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-[#6941EF] hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/60 dark:text-[#A99AFF]"
                >
                  <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                  Admin
                </Link>
              ) : null}
            </div>
          </div>

          {/* Active Profile Selector Strip */}
          {savedProfiles.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-2.5 text-xs dark:border-[#263047] dark:bg-[#131C2E]/70">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  Active profile:
                </span>
                {savedProfiles.map((item) => (
                  <button
                    key={item.profile.username}
                    type="button"
                    onClick={() => setSelectedUsername(item.profile.username)}
                    className={`rounded-lg px-2.5 py-1 font-mono text-xs transition ${
                      selectedEntry?.profile.username === item.profile.username
                        ? 'bg-[#7957FF] font-semibold text-white'
                        : 'bg-slate-100 text-[#0F172A] hover:bg-slate-200 dark:bg-[#0F172A] dark:text-slate-200'
                    }`}
                  >
                    @{item.profile.username}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('profiles')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add Profile
              </button>
            </div>
          ) : null}

          {/* TAB VIEWS */}
          {activeTab === 'overview' ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Saved Eligible Profiles"
                  value={`${savedProfiles.length} / ${trackedLimit}`}
                  hint={`${entitlements.planName} entitlement`}
                />
                <MetricCard
                  label="Monthly AI Reports"
                  value={`${entitlements.rules.ai_profile_reports.numericLimit ?? 0}`}
                  hint={canAi ? 'AI Intelligence Studio ready' : 'Upgrade to unlock AI reports'}
                />
                <MetricCard
                  label="Historical Lookback"
                  value={
                    canHistory
                      ? `${entitlements.rules.historical_analytics_days.numericLimit}d`
                      : 'Current'
                  }
                  hint={canHistory ? 'Recorded public snapshots' : 'Starter+ unlocks 30–365d'}
                />
                <MetricCard
                  label="Team Seats"
                  value={`${entitlements.rules.team_seats.numericLimit ?? 1}`}
                  hint={`Workspace: ${activeWorkspace}`}
                />
              </div>

              {selectedEntry ? (
                <div className="viewora-card rounded-2xl p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        Active Profile Intelligence — @{selectedEntry.profile.username}
                      </h2>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                        {selectedEntry.profile.displayName} · {selectedEntry.providerLabel}
                      </p>
                    </div>
                    <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    <MetricCard
                      label="Followers"
                      value={(selectedEntry.profile.followersCount ?? 0).toLocaleString()}
                      hint={selectedEntry.dataClass}
                    />
                    <MetricCard
                      label="Following"
                      value={(selectedEntry.profile.followingCount ?? 0).toLocaleString()}
                      hint={selectedEntry.dataClass}
                    />
                    <MetricCard
                      label="Public Posts"
                      value={(selectedEntry.profile.postsCount ?? 0).toLocaleString()}
                      hint={selectedEntry.dataClass}
                    />
                    <MetricCard
                      label="Est. Engagement"
                      value={`${selectedEntry.profile.estimatedEngagementRate ?? '—'}%`}
                      hint="Transparent formula"
                    />
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No saved public profiles yet"
                  description="Save an eligible public business profile or labeled demo account to inspect historical charts, calendar cadence, and AI briefs."
                  actionLabel="Add your first profile"
                  onAction={() => setActiveTab('profiles')}
                />
              )}
            </div>
          ) : null}

          {activeTab === 'profiles' ? (
            <div className="viewora-card space-y-5 rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Saved Profiles ({savedProfiles.length} / {trackedLimit})
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Try adding <span className="font-mono">@nordic.design</span> or{' '}
                    <span className="font-mono">@solaris.fitness</span>.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addInput}
                    onChange={(e) => setAddInput(e.target.value)}
                    placeholder="Enter @username"
                    className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddProfile()}
                    className="viewora-btn-primary inline-flex h-10 items-center gap-1 rounded-xl px-4 text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Save
                  </button>
                </div>
              </div>

              {addStatus ? (
                <p className="text-xs font-semibold text-[#6941EF] dark:text-[#A99AFF]">{addStatus}</p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {savedProfiles.map((item) => (
                  <div
                    key={item.profile.username}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/${locale}/dashboard/profiles/${encodeURIComponent(item.profile.username)}`}
                          className="font-mono text-sm font-bold text-[#0F172A] hover:text-[#6941EF] dark:text-[#F8FAFC]"
                        >
                          @{item.profile.username}
                        </Link>
                        <ProvenanceBadge dataClass={item.dataClass} labels={dict.provenance} />
                      </div>
                      <p className="mt-1 text-xs text-[#64748B]">{item.profile.displayName}</p>
                      <p className="mt-2 text-xs tabular-nums text-[#0F172A] dark:text-slate-300">
                        {(item.profile.followersCount ?? 0).toLocaleString()} followers ·{' '}
                        {item.profile.estimatedEngagementRate ?? '—'}% est. ER
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-[#263047]">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUsername(item.profile.username);
                          setActiveTab('analytics');
                        }}
                        className="text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                      >
                        Open analytics →
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveProfile(item.profile.username)}
                        aria-label={`Remove @${item.profile.username}`}
                        className="text-slate-400 hover:text-rose-500"
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
            <div className="viewora-card rounded-2xl p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Interactive Analytics — @{selectedEntry.profile.username}
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Area growth trajectory, engagement bars, format donut &amp; publishing heatmap.
                  </p>
                </div>
                <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
              </div>
              {!canHistory ? (
                <UpgradePreviewCard
                  title="Historical Public Analytics (30 to 365 days)"
                  description="Upgrade from Free to inspect interactive follower progression charts, format mix breakdowns, and lookback windows."
                  requiredTier="Starter+ Plan"
                  ctaHref={`/${locale}/pricing`}
                />
              ) : (
                <AnalyticsVisualizations profile={selectedEntry.profile} />
              )}
            </div>
          ) : null}

          {activeTab === 'ai' ? (
            <div className="viewora-card rounded-2xl p-6">
              <div className="mb-5">
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  AI Intelligence Studio
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Generate structured Gemini-backed or transparent template reports across 7
                  analytical workflows.
                </p>
              </div>
              <AiIntelligenceStudio
                locale={locale}
                dict={dict}
                profiles={savedProfiles}
                canGenerateAi={canAi}
                canPdf={canPdf}
                canCsv={canCsv}
              />
            </div>
          ) : null}

          {activeTab === 'timeline' && selectedEntry ? (
            <div className="viewora-card rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Activity &amp; Snapshot Timeline — @{selectedEntry.profile.username}
                </h2>
                <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
              </div>
              <ol className="mt-5 space-y-3 border-l-2 border-[#7957FF]/30 pl-4">
                {selectedEntry.profile.historicalTrend
                  .slice()
                  .reverse()
                  .map((pt) => (
                    <li
                      key={pt.date}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                    >
                      <div className="flex items-center justify-between font-semibold tabular-nums text-[#0F172A] dark:text-white">
                        <span>Observed {pt.date}</span>
                        <span>{pt.followers.toLocaleString()} followers</span>
                      </div>
                      <p className="mt-1 text-[#64748B] dark:text-[#94A3B8]">
                        {pt.posts} total public posts · {pt.engagementRate}% estimated engagement
                      </p>
                    </li>
                  ))}
              </ol>
            </div>
          ) : null}

          {activeTab === 'calendar' && selectedEntry ? (
            <div className="viewora-card rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Publishing Calendar — November 2026
                </h2>
                <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
              </div>
              <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="font-semibold text-[#64748B]">
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
                          ? 'border-[#7957FF] bg-violet-50/70 dark:bg-violet-950/40'
                          : 'border-slate-200 bg-slate-50 dark:border-[#263047] dark:bg-[#0F172A]'
                      }`}
                    >
                      <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                        {day}
                      </span>
                      {matchingPost ? (
                        <p className="mt-1 truncate rounded bg-[#7957FF] px-1.5 py-0.5 text-[10px] font-semibold text-white">
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
            <div className="viewora-card rounded-2xl p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Competitor Comparison Matrix
                </h2>
                <ProvenanceBadge dataClass="demo" labels={dict.provenance} />
              </div>
              {!canCompetitors ? (
                <UpgradePreviewCard
                  title="Multi-Profile Competitor Monitoring"
                  description="Compare engagement deltas, audience ratios, and weekly posting cadence across saved public profiles."
                  requiredTier="Premium+ Plan"
                  ctaHref={`/${locale}/pricing`}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-left text-xs tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 text-[#64748B] dark:border-[#263047]">
                        <th className="py-2.5 pr-4">Profile</th>
                        <th className="py-2.5 pr-4">Followers</th>
                        <th className="py-2.5 pr-4">Est. ER</th>
                        <th className="py-2.5 pr-4">Posts / wk</th>
                        <th className="py-2.5">Provenance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#263047]">
                      {savedProfiles.map((item) => (
                        <tr key={item.profile.username}>
                          <td className="py-3 pr-4 font-mono font-bold text-[#0F172A] dark:text-white">
                            @{item.profile.username}
                          </td>
                          <td className="py-3 pr-4">
                            {(item.profile.followersCount ?? 0).toLocaleString()}
                          </td>
                          <td className="py-3 pr-4 font-bold text-[#6941EF] dark:text-[#A99AFF]">
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

          {activeTab === 'notifications' ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="viewora-card rounded-2xl p-6">
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Notification Center
                </h2>
                <div className="mt-4 space-y-3">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`rounded-xl border p-3.5 text-xs ${
                        n.read
                          ? 'border-slate-200 bg-slate-50 dark:border-[#263047] dark:bg-[#0F172A]'
                          : 'border-[#7957FF]/40 bg-violet-50/50 dark:bg-violet-950/30'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold text-[#0F172A] dark:text-white">
                        <span>{n.title}</span>
                        <span className="text-[11px] font-normal text-[#64748B]">{n.time}</span>
                      </div>
                      <p className="mt-1 text-[#64748B] dark:text-[#94A3B8]">{n.body}</p>
                      {!n.read ? (
                        <button
                          type="button"
                          onClick={() =>
                            setNotifications((prev) =>
                              prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
                            )
                          }
                          className="mt-2 text-[11px] font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                        >
                          Mark as read
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="viewora-card rounded-2xl p-6">
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Email Notification Controls
                </h2>
                <div className="mt-4 space-y-3 text-xs text-[#0F172A] dark:text-slate-300">
                  {(
                    [
                      ['trackingAlerts', 'Saved profile tracking alerts'],
                      ['weeklyDigest', 'Weekly analytics summary'],
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
                  className="viewora-btn-primary mt-5 rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  Save Preferences
                </button>
                {prefSaved ? (
                  <span className="ml-3 text-xs font-semibold text-emerald-600 dark:text-[#34D399]">
                    Saved
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'exports' && selectedEntry ? (
            <div className="viewora-card rounded-2xl p-6">
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Report Center — @{selectedEntry.profile.username}
              </h2>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Every download is protected server-side by centralized entitlements and stamped with
                data source &amp; timestamp.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-5 dark:border-[#263047]">
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                    Viewora Branded PDF Report
                  </h3>
                  <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Clean printable layout with profile summary &amp; historical checkpoints.
                  </p>
                  {canPdf ? (
                    <a
                      href={`/api/dashboard/export?format=pdf&username=${encodeURIComponent(selectedEntry.profile.username)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="viewora-btn-primary mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
                    >
                      <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                      Open PDF Report
                    </a>
                  ) : (
                    <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-[#FBBF24]">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      Requires Premium+ Plan
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 p-5 dark:border-[#263047]">
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                    Structured CSV Export
                  </h3>
                  <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Spreadsheet-ready metrics and timeline rows with provenance labels.
                  </p>
                  {canCsv ? (
                    <a
                      href={`/api/dashboard/export?format=csv&username=${encodeURIComponent(selectedEntry.profile.username)}`}
                      className="viewora-btn-primary mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
                    >
                      <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                      Download CSV
                    </a>
                  ) : (
                    <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-[#FBBF24]">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      Requires Pro+ Plan
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'billing' ? (
            <div className="viewora-card rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      Membership &amp; Entitlements
                    </h2>
                    <MembershipBadge planCode={user.planCode} />
                  </div>
                  <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Interval: {entitlements.billingInterval} · Live payments disabled (Phase 7
                    reserved).
                  </p>
                </div>
                <Link
                  href={`/${locale}/pricing`}
                  className="viewora-btn-primary rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  Compare Plans (Demo)
                </Link>
              </div>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((key) => {
                  const rule = entitlements.rules[key];
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                    >
                      <span className="font-medium text-[#0F172A] dark:text-slate-300">
                        {FEATURE_LABELS[key].label}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-bold tabular-nums ${
                          rule.enabled
                            ? 'text-emerald-700 dark:text-[#34D399]'
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

      {/* Native-Style Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile dashboard navigation"
        className="fixed right-0 bottom-0 left-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur dark:border-[#263047] dark:bg-[#080D19]/95 lg:hidden"
      >
        {(
          [
            ['overview', 'Overview', Activity],
            ['profiles', 'Profiles', Users],
            ['analytics', 'Charts', BarChart3],
            ['ai', 'AI Studio', Sparkles],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 text-[10px] font-semibold ${
              activeTab === id
                ? 'text-[#6941EF] dark:text-[#A99AFF]'
                : 'text-[#64748B] dark:text-[#94A3B8]'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
        <Link
          href={`/${locale}/dashboard/profile`}
          className="flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8]"
        >
          <User className="h-4 w-4" aria-hidden="true" />
          <span>Profile HQ</span>
        </Link>
      </nav>
    </div>
  );
}
