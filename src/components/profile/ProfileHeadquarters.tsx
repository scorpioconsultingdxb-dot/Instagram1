'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Check,
  CreditCard,
  Download,
  FileText,
  FolderKanban,
  Globe,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Palette,
  Plus,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { LOCALE_METADATA, SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import { getDictionary } from '@/i18n/get-dictionary';
import type { SessionUser } from '@/lib/auth/session';
import type { ResolvedEntitlements } from '@/lib/entitlements/types';
import { formatQuotaLimit, hasEntitlement } from '@/lib/entitlements/helpers';
import type { PersonalProfilePrefs, PersonalShortcut } from '@/lib/auth/profile-prefs';
import type { WorkspaceUsageStats } from '@/lib/dashboard/store';
import { useTheme, type AccentPreset, type ThemePreference } from '@/components/theme/ThemeProvider';
import { Breadcrumbs, MembershipBadge, MetricCard } from '@/components/ui/Primitives';
import { AccountSecurityPanel, InlineAccountDeletionCard } from './AccountSecurityPanel';

type ProfileTab =
  | 'overview'
  | 'workspace'
  | 'research'
  | 'reports'
  | 'membership'
  | 'personalization'
  | 'notifications'
  | 'security'
  | 'privacy';

const COVER_STYLES: Record<
  PersonalProfilePrefs['coverPreset'],
  { label: string; gradient: string }
> = {
  aurora: {
    label: 'Aurora Violet',
    gradient: 'from-[#080D19] via-[#3B2699] to-[#0E7490]',
  },
  midnight: {
    label: 'Midnight Cyan',
    gradient: 'from-[#080D19] via-[#131C2E] to-[#0891B2]',
  },
  emerald: {
    label: 'Emerald Dusk',
    gradient: 'from-[#080D19] via-[#064E3B] to-[#0F766E]',
  },
  obsidian: {
    label: 'Obsidian Slate',
    gradient: 'from-[#080D19] via-[#1E293B] to-[#334155]',
  },
  sunset: {
    label: 'Violet Horizon',
    gradient: 'from-[#080D19] via-[#4C1D95] to-[#9D174D]',
  },
};

const AVATAR_STYLES: Record<
  PersonalProfilePrefs['avatarPreset'],
  { label: string; gradient: string }
> = {
  'violet-cyan': {
    label: 'Electric Violet',
    gradient: 'from-[#7957FF] to-[#22D3EE]',
  },
  'emerald-teal': {
    label: 'Emerald Signal',
    gradient: 'from-[#10B981] to-[#0891B2]',
  },
  'amber-rose': {
    label: 'Warm Amber',
    gradient: 'from-[#F59E0B] to-[#EC4899]',
  },
  'obsidian-indigo': {
    label: 'Midnight Indigo',
    gradient: 'from-[#1E293B] to-[#6366F1]',
  },
  'custom-emoji': {
    label: 'Custom Monogram / Emoji',
    gradient: 'from-[#6941EF] to-[#0891B2]',
  },
};

const ACCENT_SWATCHES: Array<{ id: AccentPreset; label: string; hex: string }> = [
  { id: 'violet', label: 'Electric Violet', hex: '#7957FF' },
  { id: 'cyan', label: 'Cyan Pulse', hex: '#06B6D4' },
  { id: 'emerald', label: 'Emerald Signal', hex: '#10B981' },
  { id: 'indigo', label: 'Deep Indigo', hex: '#6366F1' },
];

const SHORTCUT_CATALOG: Array<{ label: string; href: string }> = [
  { label: 'Analytics Dashboard', href: '/dashboard/analytics' },
  { label: 'Saved Profiles', href: '/dashboard/profiles' },
  { label: 'Competitor Projects', href: '/dashboard/competitors' },
  { label: 'AI Intelligence Studio', href: '/dashboard/ai-insights' },
  { label: 'Report Library & Exports', href: '/dashboard/reports' },
  { label: '12 Free Instagram Tools', href: '/tools' },
  { label: 'Engagement Calculator', href: '/instagram-engagement-calculator' },
  { label: 'Pricing & Entitlements', href: '/pricing' },
];

function formatMemberSince(iso: string | undefined, locale: Locale): string {
  if (!iso) return 'Active Member';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Active Member';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

export function ProfileHeadquarters({
  locale,
  dict: providedDict,
  user,
  entitlements,
  initialPrefs,
  usageStats,
}: {
  locale: Locale;
  dict?: Dictionary;
  user: SessionUser;
  entitlements: ResolvedEntitlements;
  initialPrefs: PersonalProfilePrefs;
  usageStats: WorkspaceUsageStats;
}) {
  const dict = providedDict ?? getDictionary(locale);
  const tp = dict.profileHq;
  const router = useRouter();
  const { theme, setTheme, accent, setAccent } = useTheme();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [fullName, setFullName] = useState(initialPrefs.fullName || user.fullName);
  const [title, setTitle] = useState(initialPrefs.professionalTitle);
  const [organization, setOrganization] = useState(initialPrefs.organization);
  const [avatarPreset, setAvatarPreset] = useState<PersonalProfilePrefs['avatarPreset']>(
    initialPrefs.avatarPreset
  );
  const [avatarEmoji, setAvatarEmoji] = useState(initialPrefs.avatarEmoji || '');
  const [coverPreset, setCoverPreset] = useState<PersonalProfilePrefs['coverPreset']>(
    initialPrefs.coverPreset
  );
  const [preferredLocale, setPreferredLocale] = useState<Locale>(
    initialPrefs.preferredLocale || locale
  );
  const [timezone, setTimezone] = useState(initialPrefs.timezone);
  const [defaultRange, setDefaultRange] = useState<'7d' | '30d' | '90d' | 'all'>(
    initialPrefs.defaultDateRange
  );
  const [density, setDensity] = useState<'comfortable' | 'compact'>(
    initialPrefs.dashboardDensity
  );
  const [sidebarDefaultCollapsed, setSidebarDefaultCollapsed] = useState(
    initialPrefs.sidebarDefaultCollapsed
  );
  const [workspaceName, setWorkspaceName] = useState(initialPrefs.workspaceName);
  const [shortcuts, setShortcuts] = useState<PersonalShortcut[]>(initialPrefs.personalShortcuts);
  const [newShortcutHref, setNewShortcutHref] = useState(SHORTCUT_CATALOG[0]!.href);
  const [emailPrefs, setEmailPrefs] = useState(user.emailPreferences);

  // Hydrate theme & accent from account-owned server preferences in fresh sessions
  useEffect(() => {
    try {
      if (!window.localStorage.getItem('viewora_theme') && initialPrefs.themePreference) {
        setTheme(initialPrefs.themePreference);
      }
      if (!window.localStorage.getItem('viewora_accent') && initialPrefs.accentPreset) {
        setAccent(initialPrefs.accentPreset);
      }
    } catch {
      // ignore storage errors
    }
  }, [initialPrefs.themePreference, initialPrefs.accentPreset, setTheme, setAccent]);

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const initials = fullName
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const avatarDisplay =
    avatarPreset === 'custom-emoji' && avatarEmoji.trim() ? avatarEmoji.trim() : initials || 'VW';

  const canAgencyBranding = hasEntitlement(entitlements, 'agency_dashboard');
  const trackedLimit = formatQuotaLimit(entitlements.rules.tracked_profiles);
  const aiLimit = formatQuotaLimit(entitlements.rules.ai_profile_reports);
  const seatsLimit = formatQuotaLimit(entitlements.rules.team_seats);
  const workspacesLimit = formatQuotaLimit(entitlements.rules.workspaces);
  const historyDaysLimit = formatQuotaLimit(entitlements.rules.historical_analytics_days);

  const persistProfile = async () => {
    setErrorNotice(null);
    setSavedNotice(null);

    if (fullName.trim().length < 2) {
      setErrorNotice('Display name must be at least 2 characters.');
      return;
    }
    if (workspaceName.trim().length < 2) {
      setErrorNotice('Workspace name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    try {
      const profileRes = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          professionalTitle: title.trim(),
          organization: organization.trim(),
          avatarPreset,
          avatarEmoji: avatarEmoji.trim().slice(0, 4),
          coverPreset,
          preferredLocale,
          themePreference: theme,
          accentPreset: accent,
          timezone,
          defaultDateRange: defaultRange,
          dashboardDensity: density,
          sidebarDefaultCollapsed,
          workspaceName: workspaceName.trim(),
          personalShortcuts: shortcuts,
        }),
      });
      const profileJson = (await profileRes.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        persistedAt?: string;
      } | null;

      if (!profileRes.ok || !profileJson?.ok) {
        setErrorNotice(
          profileJson?.error ??
            `Failed to persist profile settings (HTTP ${profileRes.status}). No changes were confirmed.`
        );
        return;
      }

      const prefsRes = await fetch('/api/auth/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailPreferences: emailPrefs }),
      });
      const prefsJson = (await prefsRes.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!prefsRes.ok || !prefsJson?.ok) {
        setErrorNotice(
          prefsJson?.error ??
            `Profile details saved, but email notification preferences failed (HTTP ${prefsRes.status}).`
        );
        return;
      }

      setSavedNotice(
        `Personal Digital HQ saved (${new Date(profileJson.persistedAt ?? Date.now()).toLocaleTimeString()}).`
      );
      if (preferredLocale !== locale) {
        router.push(`/${preferredLocale}/dashboard/profile`);
      } else {
        router.refresh();
      }
    } catch {
      setErrorNotice('Network error while saving settings. Please verify your connection and retry.');
    } finally {
      setSaving(false);
    }
  };

  const addShortcut = () => {
    if (shortcuts.length >= 6) return;
    const match = SHORTCUT_CATALOG.find((s) => s.href === newShortcutHref);
    if (!match) return;
    if (shortcuts.some((s) => s.href === match.href)) return;
    setShortcuts([
      ...shortcuts,
      { id: `sc-${Date.now()}`, label: match.label, href: match.href },
    ]);
  };

  const removeShortcut = (id: string) => {
    setShortcuts(shortcuts.filter((s) => s.id !== id));
  };

  const tabs: Array<{ id: ProfileTab; label: string; icon: typeof User }> = [
    { id: 'overview', label: tp.tabOverview, icon: LayoutDashboard },
    { id: 'workspace', label: tp.tabWorkspace, icon: Building2 },
    { id: 'research', label: 'My Research', icon: FolderKanban },
    { id: 'reports', label: tp.tabReports, icon: FileText },
    { id: 'membership', label: tp.tabMembership, icon: CreditCard },
    { id: 'personalization', label: tp.tabPersonalization, icon: Palette },
    { id: 'notifications', label: tp.tabNotifications, icon: Bell },
    { id: 'security', label: tp.tabSecurity, icon: KeyRound },
    { id: 'privacy', label: tp.tabPrivacy, icon: Shield },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: dict.nav.dashboard, href: `/${locale}/dashboard` },
          { label: tp.breadcrumbTitle },
        ]}
      />

      {/* Premium Profile Hero Cover & Identity Card */}
      <section className="viewora-card-elevated overflow-hidden rounded-3xl">
        <div
          className={`relative h-36 bg-gradient-to-r sm:h-44 ${COVER_STYLES[coverPreset].gradient}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_55%)]" />
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              {tp.privateBadge}
            </span>
          </div>
        </div>

        <div className="relative z-10 px-6 pb-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div
                className={`relative z-10 flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border-4 border-white bg-gradient-to-br font-display text-2xl font-extrabold text-white shadow-lg dark:border-[#131C2E] ${AVATAR_STYLES[avatarPreset].gradient}`}
              >
                {avatarDisplay}
              </div>
              <div className="pt-14 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                    {fullName}
                  </h1>
                  <MembershipBadge planCode={user.planCode} />
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-[#0F172A] dark:border-[#263047] dark:bg-[#192337] dark:text-slate-200">
                    {user.segment}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      user.emailVerified
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-[#34D399]'
                        : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                    }`}
                  >
                    {user.emailVerified ? 'Email Verified' : 'Verification Pending'}
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">
                  {title} · {organization}
                </p>
                <p className="mt-1 font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  {user.email} · {tp.workspaceLabel}: {workspaceName} · {tp.memberSince}{' '}
                  {formatMemberSince(user.createdAt, locale)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('personalization')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0F172A] transition hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#192337] dark:text-[#F8FAFC]"
              >
                {tp.editIdentityTheme}
              </button>
              <Link
                href={`/${locale}/dashboard`}
                className="viewora-btn-primary rounded-xl px-4 py-2 text-xs font-semibold"
              >
                {tp.openWorkspace}
              </Link>
            </div>
          </div>

          {/* Genuine Account Usage Statistics */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label={tp.statSavedProfiles}
              value={`${usageStats.savedProfilesCount} / ${trackedLimit}`}
              hint={`${usageStats.foldersCount} research folder${usageStats.foldersCount === 1 ? '' : 's'}`}
            />
            <MetricCard
              label={tp.statNotesComparisons}
              value={`${usageStats.notesCount} / ${usageStats.comparisonsCount}`}
              hint="Notes saved / comparison projects"
            />
            <MetricCard
              label={tp.statAiReports}
              value={`${usageStats.reportsCount}`}
              hint={`Plan quota: ${aiLimit}/mo`}
            />
            <MetricCard
              label={tp.statExports}
              value={`${usageStats.exportsCount}`}
              hint={`Lookback: ${defaultRange.toUpperCase()} · ${density}`}
            />
          </div>
        </div>
      </section>

      {/* 8-Section Profile HQ Navigation */}
      <div
        role="tablist"
        aria-label="Personal profile sections"
        className="flex gap-1.5 overflow-x-auto pb-1"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-[#7957FF] text-white shadow-xs'
                  : 'viewora-card text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      {errorNotice ? (
        <div
          role="alert"
          className="animate-viewora-enter flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorNotice}</span>
        </div>
      ) : null}

      {savedNotice ? (
        <div
          role="status"
          className="animate-viewora-enter flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-[#34D399]"
        >
          <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{savedNotice}</span>
        </div>
      ) : null}

      {/* Section Content */}
      <div className="viewora-card rounded-2xl p-6">
        {activeTab === 'overview' ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {tp.summaryHeading}
              </h2>
              <p className="text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                {tp.summaryBody}
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {tp.verifiedDetailsHeading}
                </p>
                <ul className="mt-2 space-y-1.5 text-[#64748B] dark:text-[#94A3B8]">
                  <li>
                    • Authentication:{' '}
                    <strong className="text-[#0F172A] dark:text-white">
                      {user.authMode === 'database'
                        ? 'Independent PostgreSQL Sessions'
                        : 'Isolated Local Demo'}
                    </strong>
                  </li>
                  <li>
                    • Email Verification:{' '}
                    <strong
                      className={
                        user.emailVerified
                          ? 'text-emerald-700 dark:text-[#34D399]'
                          : 'text-amber-700 dark:text-amber-300'
                      }
                    >
                      {user.emailVerified ? 'Verified' : 'Verification Pending'}
                    </strong>
                    {!user.emailVerified ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab('security')}
                        className="ml-2 font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                      >
                        Manage
                      </button>
                    ) : null}
                  </li>
                  <li>
                    • {tp.memberSince}:{' '}
                    <strong className="text-[#0F172A] dark:text-white">
                      {formatMemberSince(user.createdAt, locale)}
                    </strong>
                  </li>
                  <li>
                    • {dict.nav.language}:{' '}
                    <strong className="text-[#0F172A] dark:text-white">
                      {LOCALE_METADATA[preferredLocale].nativeLabel} ({preferredLocale})
                    </strong>
                  </li>
                  <li>
                    • {tp.tabNotifications}:{' '}
                    <strong className="tabular-nums text-[#0F172A] dark:text-white">
                      {usageStats.unreadNotificationsCount}
                    </strong>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  {tp.shortcutsHeading} ({shortcuts.length}/6)
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('workspace')}
                  className="text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                >
                  {tp.customizeAction}
                </button>
              </div>
              <div className="grid gap-2.5">
                {shortcuts.map((sc) => (
                  <Link
                    key={sc.id}
                    href={`/${locale}${sc.href}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 text-xs font-semibold text-[#0F172A] transition hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
                  >
                    <span>{sc.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'personalization' ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Display Name *
                <input
                  type="text"
                  value={fullName}
                  maxLength={80}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                />
              </label>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Professional Title
                <input
                  type="text"
                  value={title}
                  maxLength={80}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                />
              </label>
            </div>

            {/* Editable Avatar Picker */}
            <div>
              <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Editable Avatar Style
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {(Object.keys(AVATAR_STYLES) as Array<keyof typeof AVATAR_STYLES>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={avatarPreset === key}
                    onClick={() => setAvatarPreset(key)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${
                      avatarPreset === key
                        ? 'border-[#7957FF] ring-2 ring-[#7957FF]/30'
                        : 'border-slate-200 dark:border-[#263047]'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br font-display text-sm font-extrabold text-white ${AVATAR_STYLES[key].gradient}`}
                    >
                      {key === 'custom-emoji' ? avatarEmoji || '✦' : initials || 'VW'}
                    </span>
                    <span className="text-[11px] font-semibold text-[#0F172A] dark:text-slate-200">
                      {AVATAR_STYLES[key].label}
                    </span>
                  </button>
                ))}
              </div>
              {avatarPreset === 'custom-emoji' ? (
                <label className="mt-3 block max-w-xs text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  Custom Emoji or 2-letter Monogram (max 4 chars)
                  <input
                    type="text"
                    maxLength={4}
                    value={avatarEmoji}
                    onChange={(e) => setAvatarEmoji(e.target.value)}
                    placeholder="e.g. AR or ✦"
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                  />
                </label>
              ) : null}
            </div>

            {/* Cover Banner Picker */}
            <div>
              <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Customizable Cover Banner
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {(Object.keys(COVER_STYLES) as Array<keyof typeof COVER_STYLES>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={coverPreset === key}
                    onClick={() => setCoverPreset(key)}
                    className={`overflow-hidden rounded-xl border p-1.5 text-left transition ${
                      coverPreset === key
                        ? 'border-[#7957FF] ring-2 ring-[#7957FF]/30'
                        : 'border-slate-200 dark:border-[#263047]'
                    }`}
                  >
                    <div className={`h-10 rounded-lg bg-gradient-to-r ${COVER_STYLES[key].gradient}`} />
                    <span className="mt-1.5 block px-1 text-[11px] font-semibold text-[#0F172A] dark:text-slate-200">
                      {COVER_STYLES[key].label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Theme, Accent & Preferred Language */}
            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  Appearance Mode
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['light', 'dark', 'system'] as ThemePreference[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={theme === mode}
                      onClick={() => setTheme(mode)}
                      className={`rounded-xl border px-3.5 py-2 text-xs font-semibold capitalize ${
                        theme === mode
                          ? 'border-[#7957FF] bg-[#7957FF] text-white'
                          : 'border-slate-200 text-[#64748B] dark:border-[#263047] dark:text-[#94A3B8]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  Accessible Accent Preset
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACCENT_SWATCHES.map((sw) => (
                    <button
                      key={sw.id}
                      type="button"
                      aria-pressed={accent === sw.id}
                      onClick={() => setAccent(sw.id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                        accent === sw.id
                          ? 'border-[#7957FF] bg-violet-50 text-[#0F172A] dark:bg-[#192337] dark:text-white'
                          : 'border-slate-200 text-[#64748B] dark:border-[#263047] dark:text-[#94A3B8]'
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: sw.hex }}
                        aria-hidden="true"
                      />
                      {sw.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
                    Preferred Language
                  </span>
                  <select
                    value={preferredLocale}
                    onChange={(e) => setPreferredLocale(e.target.value as Locale)}
                    className="mt-2 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                  >
                    {SUPPORTED_LOCALES.map((loc) => (
                      <option key={loc} value={loc}>
                        {LOCALE_METADATA[loc].nativeLabel} ({loc})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void persistProfile()}
              className="viewora-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {saving ? 'Saving Identity & Theme…' : 'Save Identity & Theme'}
            </button>
          </div>
        ) : null}

        {activeTab === 'workspace' ? (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Workspace Identity, Dashboard Layout &amp; Personal Shortcuts
              </h2>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Configure your organization display name, default dashboard density, and quick-launch
                shortcuts.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Workspace Name *
                <input
                  type="text"
                  value={workspaceName}
                  maxLength={80}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                />
              </label>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Company / Organization
                <input
                  type="text"
                  value={organization}
                  maxLength={80}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Timezone
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Default Analytics Range
                <select
                  value={defaultRange}
                  onChange={(e) => setDefaultRange(e.target.value as typeof defaultRange)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="all">All recorded history</option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Dashboard Density
                <select
                  value={density}
                  onChange={(e) => setDensity(e.target.value as typeof density)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2.5 text-xs text-[#0F172A] dark:text-slate-300">
              <input
                type="checkbox"
                checked={sidebarDefaultCollapsed}
                onChange={(e) => setSidebarDefaultCollapsed(e.target.checked)}
              />
              <span>Start desktop dashboard with sidebar collapsed for wider charts</span>
            </label>

            {/* Personal Shortcuts Manager */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
              <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Personal Shortcuts ({shortcuts.length}/6)
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {shortcuts.map((sc) => (
                  <span
                    key={sc.id}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-200"
                  >
                    {sc.label}
                    <button
                      type="button"
                      onClick={() => removeShortcut(sc.id)}
                      aria-label={`Remove shortcut ${sc.label}`}
                      className="text-[#64748B] hover:text-rose-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {shortcuts.length < 6 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    aria-label="Choose shortcut destination"
                    value={newShortcutHref}
                    onChange={(e) => setNewShortcutHref(e.target.value)}
                    className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                  >
                    {SHORTCUT_CATALOG.map((item) => (
                      <option key={item.href} value={item.href}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addShortcut}
                    className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#7957FF] px-3 text-xs font-semibold text-[#6941EF] hover:bg-violet-50 dark:text-[#A99AFF] dark:hover:bg-[#192337]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add Shortcut
                  </button>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
              <p className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                White-Label Report Branding:{' '}
                <span className="text-[#6941EF] dark:text-[#A99AFF]">
                  {canAgencyBranding ? 'Entitled (Agency Plan)' : 'Available on Agency Plan'}
                </span>
              </p>
              <p className="mt-1 text-[#64748B] dark:text-[#94A3B8]">
                Allocated seats: <strong>{seatsLimit}</strong> · Workspaces:{' '}
                <strong>{workspacesLimit}</strong>.
              </p>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void persistProfile()}
              className="viewora-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {saving ? 'Saving Workspace Settings…' : 'Save Workspace & Layout'}
            </button>
          </div>
        ) : null}

        {activeTab === 'research' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  My Private Research Library
                </h2>
                <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Genuine customer-owned research artifacts scoped strictly to your account. Private
                  notes are never visible to administrators or other workspaces.
                </p>
              </div>
              <Link
                href={`/${locale}/dashboard/profiles`}
                className="viewora-btn-primary rounded-xl px-4 py-2 text-xs font-semibold"
              >
                Manage Saved Profiles
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <span className="text-[#64748B]">Saved Profiles</span>
                <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0F172A] dark:text-white">
                  {usageStats.savedProfilesCount}
                </p>
                <p className="mt-1 text-[11px] text-[#64748B]">Quota: {trackedLimit}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <span className="text-[#64748B]">Research Folders</span>
                <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0F172A] dark:text-white">
                  {usageStats.foldersCount}
                </p>
                <p className="mt-1 text-[11px] text-[#64748B]">Color-coded collections</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <span className="text-[#64748B]">Private Notes</span>
                <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0F172A] dark:text-white">
                  {usageStats.notesCount}
                </p>
                <p className="mt-1 text-[11px] text-[#64748B]">Strict owner-only RLS</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <span className="text-[#64748B]">Comparison Projects</span>
                <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0F172A] dark:text-white">
                  {usageStats.comparisonsCount}
                </p>
                <p className="mt-1 text-[11px] text-[#64748B]">Sortable benchmarks + CSV</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs">
              <Link
                href={`/${locale}/dashboard/competitors`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
              >
                Open Competitor Comparison Studio
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <Link
                href={`/${locale}/dashboard/analytics`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
              >
                Open Analytics Intelligence Center
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <Link
                href={`/${locale}/dashboard/activity`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
              >
                Open Research Timeline
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : null}

        {activeTab === 'reports' ? (
          <div className="space-y-4">
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              My Generated Reports &amp; Exports
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Recorded AI reports in your library: <strong>{usageStats.reportsCount}</strong> ·
              Recorded PDF/CSV exports: <strong>{usageStats.exportsCount}</strong>.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${locale}/dashboard/ai-insights`}
                className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Open AI Intelligence Studio
              </Link>
              <Link
                href={`/${locale}/dashboard/reports`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
              >
                Open Report Library &amp; Export History
              </Link>
            </div>
          </div>
        ) : null}

        {activeTab === 'membership' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Current Membership
                  </h2>
                  <MembershipBadge planCode={user.planCode} />
                </div>
                <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Server-authorized entitlements · Billing period: {entitlements.billingInterval} ·
                  Payments disabled (Phase 7 reserved).
                </p>
              </div>
              <Link
                href={`/${locale}/pricing`}
                className="viewora-btn-primary rounded-xl px-4 py-2 text-xs font-semibold"
              >
                Explore All 5 Tiers
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <span className="text-[#64748B]">Saved Profiles Quota</span>
                <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0F172A] dark:text-white">
                  {usageStats.savedProfilesCount} / {trackedLimit}
                </p>
                {typeof entitlements.rules.tracked_profiles.numericLimit === 'number' &&
                entitlements.rules.tracked_profiles.numericLimit > 0 ? (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-[#192337]">
                    <div
                      className="h-full rounded-full bg-[#7957FF]"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (usageStats.savedProfilesCount /
                              entitlements.rules.tracked_profiles.numericLimit) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <span className="text-[#64748B]">Monthly AI Reports</span>
                <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0F172A] dark:text-white">
                  {usageStats.reportsCount} / {aiLimit}
                </p>
                {typeof entitlements.rules.ai_profile_reports.numericLimit === 'number' &&
                entitlements.rules.ai_profile_reports.numericLimit > 0 ? (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-[#192337]">
                    <div
                      className="h-full rounded-full bg-[#22D3EE]"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (usageStats.reportsCount /
                              entitlements.rules.ai_profile_reports.numericLimit) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <span className="text-[#64748B]">Historical Lookback</span>
                <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0F172A] dark:text-white">
                  {historyDaysLimit === '∞' ? 'Unlimited' : `${historyDaysLimit} days`}
                </p>
                <p className="mt-1.5 text-[11px] text-[#64748B]">
                  Workspaces: {workspacesLimit} · Seats: {seatsLimit}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'notifications' ? (
          <div className="space-y-4">
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Notification Preferences
            </h2>
            <div className="space-y-2.5 text-xs text-[#0F172A] dark:text-slate-300">
              {(
                [
                  ['trackingAlerts', 'Saved profile tracking alerts'],
                  ['weeklyDigest', 'Weekly executive summary digest'],
                  ['productUpdates', 'Product updates & new free tools'],
                  ['marketing', 'Promotional communications'],
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
              disabled={saving}
              onClick={() => void persistProfile()}
              className="viewora-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {saving ? 'Saving Preferences…' : 'Save Notification Preferences'}
            </button>
          </div>
        ) : null}

        {activeTab === 'security' ? (
          <AccountSecurityPanel locale={locale} user={user} />
        ) : null}

        {activeTab === 'privacy' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-5 dark:border-[#263047]">
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                Export Personal Data (JSON)
              </h3>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Exercise GDPR, LGPD &amp; UAE PDPL portability rights anytime.
              </p>
              <Link
                href="/api/auth/export-data"
                prefetch={false}
                className="viewora-btn-primary mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download My Data
              </Link>
            </div>
            <InlineAccountDeletionCard locale={locale} userEmail={user.email} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
