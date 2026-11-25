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
  Eye,
  FileDown,
  FileText,
  FolderKanban,
  Gift,
  GitCompare,
  LifeBuoy,
  LogOut,
  Plus,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  User,
  Users,
  Workflow,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { SessionUser } from '@/lib/auth/session';
import type { PersonalProfilePrefs } from '@/lib/auth/profile-prefs';
import type { FeatureKey, ResolvedEntitlements } from '@/lib/entitlements/types';
import { FEATURE_LABELS } from '@/lib/entitlements/catalog';
import { formatQuotaLimit, hasEntitlement } from '@/lib/entitlements/helpers';
import type { SavedProfileRecord, UserWorkspaceState } from '@/lib/dashboard/store';
import type { BroadcastNotificationRecord } from '@/lib/admin/store';
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
import { SavedProfilesModule } from './SavedProfilesModule';
import { CompetitorStudio } from './CompetitorStudio';
import { NotificationsSupportModule } from './NotificationsSupportModule';
import { ActivityCalendarModule } from './ActivityCalendarModule';
import { ReportsLibraryModule } from './ReportsLibraryModule';
import { ResearchProModule } from './ResearchProModule';
import { ReportBuilderModule } from './ReportBuilderModule';
import { AgencyCollaborationModule } from './AgencyCollaborationModule';
import { AutomationCenterModule } from './AutomationCenterModule';
import { ReferralGrowthModule } from './ReferralGrowthModule';

export type DashboardTab =
  | 'overview'
  | 'profiles'
  | 'projects'
  | 'analytics'
  | 'timeline'
  | 'calendar'
  | 'competitors'
  | 'ai'
  | 'report_builder'
  | 'agency'
  | 'automation'
  | 'referrals'
  | 'notifications'
  | 'exports'
  | 'billing'
  | 'support';

export interface DashboardSavedProfile {
  profile: SavedProfileRecord['profile'];
  dataClass: SavedProfileRecord['dataClass'];
  providerLabel: string;
  workspace: string;
}

export function CustomerDashboard({
  locale,
  dict,
  user,
  entitlements,
  initialWorkspace,
  demoPreviewProfiles,
  profilePrefs,
  broadcasts,
  isAdmin,
  initialTab = 'overview',
  initialDemoPreview = false,
  initialSavedHandle,
}: {
  locale: Locale;
  dict: Dictionary;
  user: SessionUser;
  entitlements: ResolvedEntitlements;
  initialWorkspace: UserWorkspaceState;
  demoPreviewProfiles: SavedProfileRecord[];
  profilePrefs: PersonalProfilePrefs;
  broadcasts: BroadcastNotificationRecord[];
  isAdmin: boolean;
  initialTab?: DashboardTab;
  initialDemoPreview?: boolean;
  initialSavedHandle?: string;
}) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    profilePrefs.sidebarDefaultCollapsed ?? false
  );
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);
  const [workspace, setWorkspace] = useState<UserWorkspaceState>(initialWorkspace);
  const [demoPreviewMode, setDemoPreviewMode] = useState<boolean>(
    initialDemoPreview || initialWorkspace.settings.demoPreviewMode
  );
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);
  const [walkthroughDismissed, setWalkthroughDismissed] = useState(
    profilePrefs.walkthroughDismissed ?? false
  );
  const [widgetVisibility, setWidgetVisibility] = useState({
    checklist: profilePrefs.widgetVisibility?.checklist ?? true,
    kpis: profilePrefs.widgetVisibility?.kpis ?? true,
    quickActions: profilePrefs.widgetVisibility?.quickActions ?? true,
    shortcuts: profilePrefs.widgetVisibility?.shortcuts ?? true,
    analyticsPreview: profilePrefs.widgetVisibility?.analyticsPreview ?? true,
  });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('viewora_dash_widgets');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<typeof widgetVisibility>;
        setWidgetVisibility((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleWidget = (key: keyof typeof widgetVisibility) => {
    setWidgetVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem('viewora_dash_widgets', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const effectiveProfiles: SavedProfileRecord[] = useMemo(() => {
    if (demoPreviewMode && workspace.savedProfiles.length === 0) {
      return demoPreviewProfiles;
    }
    return workspace.savedProfiles;
  }, [demoPreviewMode, workspace.savedProfiles, demoPreviewProfiles]);

  const [selectedUsername, setSelectedUsername] = useState<string>(
    effectiveProfiles[0]?.username ?? ''
  );

  const selectedEntry =
    effectiveProfiles.find((p) => p.username === selectedUsername) ?? effectiveProfiles[0] ?? null;

  const isViewingDemoOverlay = demoPreviewMode && workspace.savedProfiles.length === 0;

  const trackedLimitLabel = formatQuotaLimit(entitlements.rules.tracked_profiles);
  const aiLimitLabel = formatQuotaLimit(entitlements.rules.ai_profile_reports);
  const historyDaysLabel = formatQuotaLimit(entitlements.rules.historical_analytics_days);
  const seatsLimitLabel = formatQuotaLimit(entitlements.rules.team_seats);
  const canHistory = hasEntitlement(entitlements, 'historical_analytics_days');
  const canCompetitors = hasEntitlement(entitlements, 'competitor_monitoring');
  const canAi = hasEntitlement(entitlements, 'ai_profile_reports');
  const canCsv = hasEntitlement(entitlements, 'csv_export');
  const canPdf = hasEntitlement(entitlements, 'pdf_export');
  const canAgency = hasEntitlement(entitlements, 'agency_dashboard');
  const unreadCount = workspace.notifications.filter((n) => !n.read).length;

  const toggleDemoPreview = async (next: boolean) => {
    setDemoPreviewMode(next);
    if (next && !selectedUsername && demoPreviewProfiles[0]) {
      setSelectedUsername(demoPreviewProfiles[0].username);
    }
    try {
      const res = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'update_settings', demoPreviewMode: next }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        workspace?: UserWorkspaceState;
      } | null;
      if (res.ok && json?.ok && json.workspace) {
        setWorkspace(json.workspace);
      }
    } catch {
      // keep local toggle responsive
    }
  };

  const switchWorkspace = async (wsName: string) => {
    const res = await fetch('/api/dashboard/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update_settings', activeWorkspace: wsName }),
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      workspace?: UserWorkspaceState;
    } | null;
    if (res.ok && json?.ok && json.workspace) {
      setWorkspace(json.workspace);
    }
  };

  const createWorkspace = async () => {
    if (newWorkspaceName.trim().length < 2) return;
    const res = await fetch('/api/dashboard/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'create_workspace', name: newWorkspaceName.trim() }),
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      workspace?: UserWorkspaceState;
    } | null;
    if (res.ok && json?.ok && json.workspace) {
      setWorkspace(json.workspace);
      setNewWorkspaceName('');
      setShowAddWorkspace(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push(`/${locale}`);
    router.refresh();
  };

  const td = dict.dashboard;

  const navGroups: Array<{
    group: string;
    items: Array<{ id: DashboardTab; label: string; icon: typeof Activity }>;
  }> = [
    {
      group: td.groupIntelligence,
      items: [
        { id: 'overview', label: td.tabOverview, icon: Activity },
        { id: 'profiles', label: td.tabProfiles, icon: Users },
        { id: 'projects', label: 'Research Pro', icon: FolderKanban },
        { id: 'analytics', label: td.tabAnalytics, icon: BarChart3 },
        { id: 'ai', label: td.tabAi, icon: Sparkles },
      ],
    },
    {
      group: td.groupMonitoring,
      items: [
        { id: 'timeline', label: td.tabTimeline, icon: Clock },
        { id: 'calendar', label: td.tabCalendar, icon: Calendar },
        { id: 'competitors', label: td.tabCompetitors, icon: GitCompare },
        { id: 'report_builder', label: 'Report Builder', icon: FileText },
        { id: 'exports', label: td.tabExports, icon: FileDown },
      ],
    },
    {
      group: td.groupWorkspace,
      items: [
        { id: 'agency', label: 'Agency & Team', icon: Building2 },
        { id: 'automation', label: 'Automation', icon: Workflow },
        { id: 'referrals', label: 'Referrals', icon: Gift },
        { id: 'notifications', label: td.tabNotifications, icon: Bell },
        { id: 'billing', label: td.tabBilling, icon: CreditCard },
        { id: 'support', label: td.tabSupport, icon: LifeBuoy },
      ],
    },
  ];

  const displayName = profilePrefs.fullName || user.fullName;
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const densityPadding = profilePrefs.dashboardDensity === 'compact' ? 'space-y-3.5' : 'space-y-5';

  const legacyAiProfiles: DashboardSavedProfile[] = effectiveProfiles.map((p) => ({
    profile: p.profile,
    dataClass: p.dataClass,
    providerLabel: p.providerLabel,
    workspace: p.workspace,
  }));

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
                <span className="truncate text-[11px] font-bold tracking-wider text-[#6941EF] uppercase dark:text-[#A99AFF]">
                  {profilePrefs.workspaceName || 'Workspace'}
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
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                          active
                            ? 'bg-[#7957FF] text-white shadow-xs'
                            : 'text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-white'
                        } ${sidebarCollapsed ? 'justify-center' : ''}`}
                      >
                        <span className="inline-flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {!sidebarCollapsed ? <span>{item.label}</span> : null}
                        </span>
                        {!sidebarCollapsed && item.id === 'notifications' && unreadCount > 0 ? (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              active ? 'bg-white/20 text-white' : 'bg-[#7957FF] text-white'
                            }`}
                          >
                            {unreadCount}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="border-t border-slate-200 pt-3 dark:border-[#263047]">
              <Link
                href={`/${locale}/dashboard/profile`}
                title={sidebarCollapsed ? td.myProfileHq : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-white ${
                  sidebarCollapsed ? 'justify-center' : ''
                }`}
              >
                <User
                  className="h-4 w-4 shrink-0 text-[#6941EF] dark:text-[#A99AFF]"
                  aria-hidden="true"
                />
                {!sidebarCollapsed ? <span>{td.myProfileHq}</span> : null}
              </Link>
              <Link
                href={`/${locale}/dashboard/settings`}
                title={sidebarCollapsed ? td.settingsShort : undefined}
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#192337] dark:hover:text-white ${
                  sidebarCollapsed ? 'justify-center' : ''
                }`}
              >
                <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed ? <span>{td.privacySettings}</span> : null}
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            title={sidebarCollapsed ? td.signOut : undefined}
            className={`mt-6 flex w-full items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-semibold text-[#64748B] hover:border-rose-300 hover:text-rose-600 dark:border-[#263047] dark:text-[#94A3B8] ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!sidebarCollapsed ? <span>{td.signOut}</span> : null}
          </button>
        </aside>

        {/* Main Workspace Canvas */}
        <div className={`min-w-0 flex-1 ${densityPadding}`}>
          {/* Top Personalized Greeting & Utility Bar */}
          <div className="viewora-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
            <div className="flex items-center gap-3.5">
              <Link
                href={`/${locale}/dashboard/profile`}
                aria-label={td.myProfileHq}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7957FF] to-[#22D3EE] font-display text-sm font-extrabold text-white shadow-sm transition hover:scale-105"
              >
                {profilePrefs.avatarPreset === 'custom-emoji' && profilePrefs.avatarEmoji
                  ? profilePrefs.avatarEmoji
                  : initials}
              </Link>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                    {td.welcomeBack} {displayName.split(' ')[0]}
                  </h1>
                  <MembershipBadge planCode={user.planCode} />
                  {isViewingDemoOverlay ? (
                    <ProvenanceBadge dataClass="demo" labels={dict.provenance} />
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {workspace.settings.activeWorkspace} ·{' '}
                  <span className="capitalize">{user.segment}</span> {td.workflowLabel} ·{' '}
                  <Link
                    href={`/${locale}/dashboard/profile`}
                    className="font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                  >
                    {td.personalHqLink}
                  </Link>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={demoPreviewMode}
                onClick={() => void toggleDemoPreview(!demoPreviewMode)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
                  demoPreviewMode
                    ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'border-slate-200 bg-white text-[#64748B] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]'
                }`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {demoPreviewMode ? td.demoPreviewOn : td.demoPreview}
              </button>

              <button
                type="button"
                onClick={triggerCommandPalette}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-[#64748B] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{td.searchButton}</span>
                <kbd className="font-mono text-[10px]">⌘K</kbd>
              </button>

              {user.segment === 'agency' || canAgency ? (
                <div className="flex items-center gap-1">
                  <label className="inline-flex items-center gap-1.5 text-xs">
                    <Building2 className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
                    <span className="sr-only">Switch workspace</span>
                    <select
                      value={workspace.settings.activeWorkspace}
                      onChange={(e) => void switchWorkspace(e.target.value)}
                      className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-[#0F172A] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#F8FAFC]"
                    >
                      {workspace.workspaces.map((ws) => (
                        <option key={ws} value={ws}>
                          {ws}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddWorkspace((p) => !p)}
                    aria-label="Add workspace"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#64748B] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
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

          {/* Mobile & Tablet Complete Section Switcher (gives <1024px access to all 11 modules + settings + sign-out) */}
          <div
            role="tablist"
            aria-label="Dashboard sections"
            className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:hidden"
          >
            {navGroups.flatMap((g) => g.items).map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? 'bg-[#7957FF] text-white shadow-xs'
                      : 'viewora-card text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.id === 'notifications' && unreadCount > 0 ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? 'bg-white/20 text-white' : 'bg-[#7957FF] text-white'
                      }`}
                    >
                      {unreadCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
            <Link
              href={`/${locale}/dashboard/settings`}
              className="viewora-card inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              {td.settingsShort}
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 dark:border-[#263047] dark:bg-[#131C2E] dark:text-rose-400"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              {td.signOut}
            </button>
          </div>

          {showAddWorkspace ? (
            <div className="viewora-card flex flex-wrap items-center gap-2 rounded-2xl p-4">
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="New client workspace name (e.g. Client: Nordic Studio)"
                className="h-9 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
              <button
                type="button"
                onClick={() => void createWorkspace()}
                className="viewora-btn-primary h-9 rounded-xl px-4 text-xs font-semibold"
              >
                {td.createWorkspace}
              </button>
            </div>
          ) : null}

          {/* Explicit Demo Preview Mode Banner */}
          {isViewingDemoOverlay ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
              <span>
                <strong>Explicit Demo Preview Mode Active:</strong> Showing labeled sample profiles
                (<span className="font-mono">@viewora.studio</span>,{' '}
                <span className="font-mono">@aurora.coffee</span>) for interface exploration. Your
                real saved workspace currently has 0 saved profiles.
              </span>
              <button
                type="button"
                onClick={() => void toggleDemoPreview(false)}
                className="rounded-lg border border-amber-400 bg-white px-3 py-1 font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-[#131C2E] dark:text-amber-200"
              >
                {td.exitDemoPreview}
              </button>
            </div>
          ) : null}

          {/* Active Profile Selector Strip */}
          {effectiveProfiles.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2.5 text-xs dark:border-[#263047] dark:bg-[#131C2E]/80">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  {td.activeProfile}
                </span>
                {effectiveProfiles.map((item) => (
                  <button
                    key={item.username}
                    type="button"
                    onClick={() => setSelectedUsername(item.username)}
                    className={`rounded-lg px-2.5 py-1 font-mono text-xs transition ${
                      selectedEntry?.username === item.username
                        ? 'bg-[#7957FF] font-semibold text-white'
                        : 'bg-slate-100 text-[#0F172A] hover:bg-slate-200 dark:bg-[#0F172A] dark:text-slate-200'
                    }`}
                  >
                    @{item.username}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('profiles')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {td.manageProfiles}
              </button>
            </div>
          ) : null}

          {/* TAB VIEWS */}
          {activeTab === 'overview' ? (
            <div className="space-y-5">
              {/* Configurable Widget Layout & Quick Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {widgetVisibility.quickActions ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveTab('profiles')}
                        className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Save Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('competitors')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
                      >
                        <GitCompare className="h-3.5 w-3.5 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
                        Compare Peers
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('ai')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-[#22D3EE]" aria-hidden="true" />
                        AI Studio
                      </button>
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-expanded={showWidgetConfig}
                  onClick={() => setShowWidgetConfig((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:border-[#7957FF] hover:text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#94A3B8] dark:hover:text-white"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  Customize Layout
                </button>
              </div>

              {showWidgetConfig ? (
                <div className="viewora-card flex flex-wrap items-center gap-4 rounded-2xl p-4 text-xs">
                  <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Overview Widgets:
                  </span>
                  {(
                    [
                      ['checklist', 'Getting-Started Checklist'],
                      ['kpis', 'Usage & Quota KPIs'],
                      ['quickActions', 'Quick Actions Bar'],
                      ['shortcuts', 'Personal Shortcuts'],
                      ['analyticsPreview', 'Active Profile Snapshot'],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="inline-flex items-center gap-1.5 text-[#0F172A] dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={widgetVisibility[key]}
                        onChange={() => toggleWidget(key)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              {widgetVisibility.shortcuts && profilePrefs.personalShortcuts.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    Shortcuts:
                  </span>
                  {profilePrefs.personalShortcuts.map((sc) => (
                    <Link
                      key={sc.id}
                      href={`/${locale}${sc.href}`}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0F172A] transition hover:border-[#7957FF] hover:text-[#6941EF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200 dark:hover:text-[#A99AFF]"
                    >
                      {sc.label} →
                    </Link>
                  ))}
                </div>
              ) : null}

              {/* Stage 21 Personalized Getting-Started Checklist (computed from genuine account state) */}
              {widgetVisibility.checklist && !walkthroughDismissed ? (() => {
                const steps = [
                  {
                    id: 'onboarding',
                    label: 'Complete personalized role & goal onboarding',
                    done: Boolean(profilePrefs.onboardingCompleted || user.onboardingCompleted),
                    href: `/${locale}/onboarding`,
                  },
                  {
                    id: 'profile',
                    label: 'Save your first public profile or CSV dataset',
                    done: workspace.savedProfiles.length > 0,
                    onClick: () => setActiveTab('projects'),
                  },
                  {
                    id: 'hq',
                    label: 'Personalize your Digital HQ bio or avatar',
                    done: Boolean(profilePrefs.biography || profilePrefs.customAvatarUrl),
                    href: `/${locale}/dashboard/profile`,
                  },
                  {
                    id: 'report',
                    label: 'Draft a template-generated report or AI brief',
                    done: workspace.reports.length > 0 || workspace.exports.length > 0,
                    onClick: () => setActiveTab('report_builder'),
                  },
                ];
                const completedCount = steps.filter((s) => s.done).length;
                return (
                  <section className="viewora-card rounded-2xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                          Getting-Started Checklist ({completedCount}/{steps.length} complete)
                        </p>
                        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          Tracked strictly from real actions in your account ·{' '}
                          <Link
                            href={`/${locale}/resources`}
                            className="font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                          >
                            Help Center &amp; Guides
                          </Link>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setWalkthroughDismissed(true);
                          void fetch('/api/auth/profile', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ walkthroughDismissed: true }),
                          }).catch(() => undefined);
                        }}
                        className="text-[11px] font-semibold text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]"
                      >
                        Dismiss
                      </button>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {steps.map((st) =>
                        st.href ? (
                          <Link
                            key={st.id}
                            href={st.href}
                            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A]"
                          >
                            <span
                              className={
                                st.done
                                  ? 'text-[#64748B] line-through'
                                  : 'font-semibold text-[#0F172A] dark:text-slate-100'
                              }
                            >
                              {st.label}
                            </span>
                            <CheckCircle2
                              className={`h-4 w-4 shrink-0 ${st.done ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}
                              aria-hidden="true"
                            />
                          </Link>
                        ) : (
                          <button
                            key={st.id}
                            type="button"
                            onClick={st.onClick}
                            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-left text-xs hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A]"
                          >
                            <span
                              className={
                                st.done
                                  ? 'text-[#64748B] line-through'
                                  : 'font-semibold text-[#0F172A] dark:text-slate-100'
                              }
                            >
                              {st.label}
                            </span>
                            <CheckCircle2
                              className={`h-4 w-4 shrink-0 ${st.done ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}
                              aria-hidden="true"
                            />
                          </button>
                        )
                      )}
                    </div>
                  </section>
                );
              })() : null}

              {widgetVisibility.kpis ? (
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <MetricCard
                  label="Saved Profiles"
                  value={`${workspace.savedProfiles.length} / ${trackedLimitLabel}`}
                  hint={`${workspace.folders.length} research folder${workspace.folders.length === 1 ? '' : 's'}`}
                />
                <MetricCard
                  label="Saved AI Reports"
                  value={`${workspace.reports.length}`}
                  hint={
                    canAi
                      ? `Plan quota: ${aiLimitLabel}/mo`
                      : 'Upgrade for AI Studio'
                  }
                />
                <MetricCard
                  label="Comparison Projects"
                  value={`${workspace.comparisons.length}`}
                  hint={
                    canHistory
                      ? `${historyDaysLabel === '∞' ? 'Unlimited' : `${historyDaysLabel}d`} history lookback`
                      : 'Starter+ unlocks history'
                  }
                />
                <MetricCard
                  label="Recorded Exports"
                  value={`${workspace.exports.length}`}
                  hint={`${seatsLimitLabel} seat${seatsLimitLabel === '1' ? '' : 's'} · ${workspace.settings.activeWorkspace}`}
                />
              </div>
              ) : null}

              {selectedEntry ? (
                <div className="viewora-card rounded-2xl p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        Active Profile Intelligence — @{selectedEntry.username}
                      </h2>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                        {selectedEntry.profile.displayName} · {selectedEntry.providerLabel}
                      </p>
                    </div>
                    <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                  title={td.cleanWorkspaceTitle}
                  description={td.cleanWorkspaceDesc}
                  actionLabel={td.tabProfiles}
                  onAction={() => setActiveTab('profiles')}
                />
              )}
            </div>
          ) : null}

          {activeTab === 'profiles' ? (
            <SavedProfilesModule
              locale={locale}
              dict={dict}
              workspace={workspace}
              trackedLimit={trackedLimitLabel}
              initialHandle={initialSavedHandle}
              onWorkspaceChange={(next) => {
                setWorkspace(next);
                if (!selectedUsername && next.savedProfiles[0]) {
                  setSelectedUsername(next.savedProfiles[0].username);
                }
              }}
              onInspectProfile={(handle) => {
                setSelectedUsername(handle);
                setActiveTab('analytics');
              }}
              onEnableDemoPreview={() => void toggleDemoPreview(true)}
            />
          ) : null}

          {activeTab === 'projects' ? (
            <ResearchProModule workspace={workspace} onWorkspaceChange={setWorkspace} />
          ) : null}

          {activeTab === 'report_builder' ? (
            <ReportBuilderModule
              activeProfiles={effectiveProfiles}
              canCsv={canCsv}
              canPdf={canPdf}
              canAgencyBranding={canAgency}
            />
          ) : null}

          {activeTab === 'agency' ? (
            <AgencyCollaborationModule
              locale={locale}
              canAgency={canAgency}
              seatLimit={entitlements.rules.team_seats.numericLimit}
              workspaceLimit={entitlements.rules.workspaces.numericLimit}
            />
          ) : null}

          {activeTab === 'automation' ? (
            <AutomationCenterModule defaultTimezone={profilePrefs.timezone || 'UTC'} />
          ) : null}

          {activeTab === 'referrals' ? <ReferralGrowthModule locale={locale} /> : null}

          {activeTab === 'analytics' ? (
            <div className="viewora-card rounded-2xl p-6">
              {!selectedEntry ? (
                <EmptyState
                  title="Select or save a profile to inspect analytics"
                  description="Add an eligible public profile in Saved Profiles or turn on Demo Preview Mode to explore interactive charts and tabular checkpoints."
                  actionLabel="Enable Demo Preview Mode"
                  onAction={() => void toggleDemoPreview(true)}
                />
              ) : !canHistory ? (
                <UpgradePreviewCard
                  title="Historical Public Analytics (30 to 365 days)"
                  description="Upgrade from Free to inspect interactive follower progression charts, format mix breakdowns, and lookback windows."
                  requiredTier="Starter+ Plan"
                  ctaHref={`/${locale}/pricing`}
                />
              ) : (
                <>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        Interactive Analytics — @{selectedEntry.username}
                      </h2>
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                        Source: {selectedEntry.providerLabel} · Saved{' '}
                        {new Date(selectedEntry.savedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ProvenanceBadge dataClass={selectedEntry.dataClass} labels={dict.provenance} />
                  </div>
                  <AnalyticsVisualizations
                    profile={selectedEntry.profile}
                    dataClass={selectedEntry.dataClass}
                    providerLabel={selectedEntry.providerLabel}
                    fetchedAt={selectedEntry.savedAt}
                    initialRange={workspace.settings.defaultDateRange}
                  />
                </>
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
                  analytical workflows. Generated briefs are saved automatically to your Report
                  Library.
                </p>
              </div>
              <AiIntelligenceStudio
                locale={locale}
                dict={dict}
                profiles={legacyAiProfiles}
                canGenerateAi={canAi}
                canPdf={canPdf}
                canCsv={canCsv}
                onEnableDemoPreview={() => void toggleDemoPreview(true)}
                onReportSaved={(savedEntry) => {
                  setWorkspace((prev) => ({
                    ...prev,
                    reports: [savedEntry, ...prev.reports],
                  }));
                }}
              />
            </div>
          ) : null}

          {activeTab === 'timeline' ? (
            <ActivityCalendarModule
              mode="timeline"
              dict={dict}
              selectedEntry={selectedEntry}
              onEnableDemoPreview={() => void toggleDemoPreview(true)}
            />
          ) : null}

          {activeTab === 'calendar' ? (
            <ActivityCalendarModule
              mode="calendar"
              dict={dict}
              selectedEntry={selectedEntry}
              onEnableDemoPreview={() => void toggleDemoPreview(true)}
            />
          ) : null}

          {activeTab === 'competitors' ? (
            <CompetitorStudio
              locale={locale}
              dict={dict}
              canCompetitors={canCompetitors}
              workspace={workspace}
              activeProfiles={effectiveProfiles}
              isDemoPreview={isViewingDemoOverlay}
              onWorkspaceChange={setWorkspace}
            />
          ) : null}

          {activeTab === 'notifications' ? (
            <NotificationsSupportModule
              mode="notifications"
              workspace={workspace}
              broadcasts={broadcasts}
              initialEmailPrefs={user.emailPreferences}
              onWorkspaceChange={setWorkspace}
            />
          ) : null}

          {activeTab === 'support' ? (
            <NotificationsSupportModule
              mode="support"
              workspace={workspace}
              broadcasts={broadcasts}
              initialEmailPrefs={user.emailPreferences}
              onWorkspaceChange={setWorkspace}
            />
          ) : null}

          {activeTab === 'exports' ? (
            <ReportsLibraryModule
              dict={dict}
              selectedEntry={selectedEntry}
              reports={workspace.reports}
              exportsHistory={workspace.exports}
              canPdf={canPdf}
              canCsv={canCsv}
              onOpenAiStudio={() => setActiveTab('ai')}
              onExportTriggered={(format, username) => {
                setWorkspace((prev) => ({
                  ...prev,
                  exports: [
                    {
                      id: `exp-local-${Date.now()}`,
                      username,
                      format,
                      dataClass: selectedEntry?.dataClass ?? 'demo',
                      createdAt: new Date().toISOString(),
                    },
                    ...prev.exports,
                  ],
                }));
              }}
            />
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

      {/* Mobile Bottom Navigation Bar */}
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
