'use client';

import Link from 'next/link';
import {
  Bell,
  Building2,
  Check,
  CreditCard,
  Download,
  FileText,
  KeyRound,
  LayoutDashboard,
  Palette,
  Shield,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { SessionUser } from '@/lib/auth/session';
import type { ResolvedEntitlements } from '@/lib/entitlements/types';
import { hasEntitlement } from '@/lib/entitlements/service';
import type { PersonalProfilePrefs } from '@/lib/auth/profile-prefs';
import { useTheme, type AccentPreset, type ThemePreference } from '@/components/theme/ThemeProvider';
import { Breadcrumbs, MembershipBadge, MetricCard } from '@/components/ui/Primitives';

type ProfileTab =
  | 'overview'
  | 'workspace'
  | 'reports'
  | 'membership'
  | 'personalization'
  | 'notifications'
  | 'security'
  | 'privacy';

const COVER_STYLES: Record<
  NonNullable<PersonalProfilePrefs['coverPreset']>,
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
};

const ACCENT_SWATCHES: Array<{ id: AccentPreset; label: string; hex: string }> = [
  { id: 'violet', label: 'Electric Violet', hex: '#7957FF' },
  { id: 'cyan', label: 'Cyan Pulse', hex: '#06B6D4' },
  { id: 'emerald', label: 'Emerald Signal', hex: '#10B981' },
  { id: 'indigo', label: 'Deep Indigo', hex: '#6366F1' },
];

export function ProfileHeadquarters({
  locale,
  user,
  entitlements,
  initialPrefs,
}: {
  locale: Locale;
  user: SessionUser;
  entitlements: ResolvedEntitlements;
  initialPrefs: PersonalProfilePrefs;
}) {
  const { theme, setTheme, accent, setAccent } = useTheme();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [fullName, setFullName] = useState(user.fullName);
  const [title, setTitle] = useState(initialPrefs.professionalTitle ?? 'Social Intelligence Strategist');
  const [organization, setOrganization] = useState(initialPrefs.organization ?? 'Viewora Workspace');
  const [coverPreset, setCoverPreset] = useState<NonNullable<PersonalProfilePrefs['coverPreset']>>(
    initialPrefs.coverPreset ?? 'aurora'
  );
  const [timezone, setTimezone] = useState(initialPrefs.timezone ?? 'UTC');
  const [defaultRange, setDefaultRange] = useState<'7d' | '30d' | '90d'>(
    initialPrefs.defaultDateRange ?? '30d'
  );
  const [density, setDensity] = useState<'comfortable' | 'compact'>(
    initialPrefs.dashboardDensity ?? 'comfortable'
  );
  const [workspaceName, setWorkspaceName] = useState(
    initialPrefs.workspaceName ?? 'Primary Workspace'
  );
  const [emailPrefs, setEmailPrefs] = useState(user.emailPreferences);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const initials = fullName
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const canAgencyBranding = hasEntitlement(entitlements, 'agency_dashboard');
  const trackedLimit = entitlements.rules.tracked_profiles.numericLimit ?? 1;
  const aiLimit = entitlements.rules.ai_profile_reports.numericLimit ?? 0;
  const seatsLimit = entitlements.rules.team_seats.numericLimit ?? 1;

  const persistProfile = async () => {
    setSaving(true);
    setSavedNotice(null);
    try {
      await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          professionalTitle: title,
          organization,
          coverPreset,
          accentPreset: accent,
          timezone,
          defaultDateRange: defaultRange,
          dashboardDensity: density,
          workspaceName,
        }),
      });
      await fetch('/api/auth/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailPreferences: emailPrefs }),
      });
      setSavedNotice('Personal headquarters settings saved.');
      setTimeout(() => setSavedNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const tabs: Array<{ id: ProfileTab; label: string; icon: typeof User }> = [
    { id: 'overview', label: 'My Overview', icon: LayoutDashboard },
    { id: 'workspace', label: 'My Workspace', icon: Building2 },
    { id: 'reports', label: 'My Reports', icon: FileText },
    { id: 'membership', label: 'Membership', icon: CreditCard },
    { id: 'personalization', label: 'Personalization', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: KeyRound },
    { id: 'privacy', label: 'Privacy', icon: Shield },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: `/${locale}/dashboard` },
          { label: 'My Profile — Personal Digital HQ' },
        ]}
      />

      {/* Premium Profile Hero Cover & Identity Card */}
      <section className="viewora-card-elevated overflow-hidden rounded-3xl">
        {/* Customizable Cover Banner */}
        <div
          className={`relative h-36 bg-gradient-to-r sm:h-44 ${COVER_STYLES[coverPreset].gradient}`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_55%)]" />
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              Private Profile · Visible Only to You
            </span>
          </div>
        </div>

        {/* Identity Bar */}
        <div className="px-6 pb-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-white bg-gradient-to-br from-[#7957FF] to-[#22D3EE] font-display text-2xl font-extrabold text-white shadow-lg dark:border-[#131C2E]">
                {initials || 'VW'}
              </div>
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                    {fullName}
                  </h1>
                  <MembershipBadge planCode={user.planCode} />
                </div>
                <p className="mt-0.5 text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">
                  {title} · {organization}
                </p>
                <p className="mt-1 font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  {user.email} · Workspace: {workspaceName} · Member since Nov 2026
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('personalization')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0F172A] transition hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#192337] dark:text-[#F8FAFC]"
              >
                Edit Profile &amp; Theme
              </button>
              <Link
                href={`/${locale}/dashboard`}
                className="viewora-btn-primary rounded-xl px-4 py-2 text-xs font-semibold"
              >
                Back to Workspace
              </Link>
            </div>
          </div>

          {/* Personal Workspace Statistics */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Saved Profile Allowance"
              value={`${trackedLimit}`}
              hint={`${entitlements.planName} tier limit`}
            />
            <MetricCard
              label="Monthly AI Reports"
              value={`${aiLimit}`}
              hint="Gemini Intelligence Studio"
            />
            <MetricCard
              label="Team Seats"
              value={`${seatsLimit}`}
              hint={`Segment: ${user.segment}`}
            />
            <MetricCard
              label="Default Lookback"
              value={defaultRange.toUpperCase()}
              hint={`Timezone: ${timezone}`}
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

      {savedNotice ? (
        <div
          role="status"
          className="animate-viewora-enter flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-[#34D399]"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          <span>{savedNotice}</span>
        </div>
      ) : null}

      {/* Section Content */}
      <div className="viewora-card rounded-2xl p-6">
        {activeTab === 'overview' ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Identity Summary
              </h2>
              <p className="text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                Your Personal Digital Headquarters centralizes workspace branding, visual
                personalization, entitlement status, and GDPR/LGPD/UAE PDPL privacy controls. Your
                profile remains strictly private by default.
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  Active Workspace Milestones
                </p>
                <ul className="mt-2 space-y-1.5 text-[#64748B] dark:text-[#94A3B8]">
                  <li>• Account authenticated ({user.authMode === 'supabase' ? 'Supabase Auth' : 'Isolated Local Demo'})</li>
                  <li>• Segment configured as <strong className="capitalize">{user.segment}</strong></li>
                  <li>• Privacy-first cookie &amp; email preferences active</li>
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Quick Workspace Actions
              </h2>
              <div className="grid gap-2.5">
                <Link
                  href={`/${locale}/dashboard`}
                  className="rounded-xl border border-slate-200 p-3.5 text-xs font-semibold text-[#0F172A] transition hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
                >
                  Open Analytics Dashboard →
                </Link>
                <Link
                  href={`/${locale}/dashboard/ai-insights`}
                  className="rounded-xl border border-slate-200 p-3.5 text-xs font-semibold text-[#0F172A] transition hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
                >
                  Launch AI Intelligence Studio →
                </Link>
                <Link
                  href={`/${locale}/tools`}
                  className="rounded-xl border border-slate-200 p-3.5 text-xs font-semibold text-[#0F172A] transition hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
                >
                  Explore 12 Free Instagram Tools →
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'workspace' ? (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Workspace Identity &amp; Branding
              </h2>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Configure your organization display name and client report branding.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Workspace Name
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                />
              </label>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Company / Organization
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                />
              </label>
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
                <strong>{entitlements.rules.workspaces.numericLimit ?? 1}</strong>.
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void persistProfile()}
              className="viewora-btn-primary rounded-xl px-5 py-2.5 text-xs font-semibold disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Workspace Identity'}
            </button>
          </div>
        ) : null}

        {activeTab === 'reports' ? (
          <div className="space-y-4">
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              My Generated Reports
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Generate structured AI reports or download provenance-stamped PDF and CSV exports from
              your workspace.
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
                Go to Report Exports
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
                  {trackedLimit}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <span className="text-[#64748B]">Monthly AI Reports</span>
                <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0F172A] dark:text-white">
                  {aiLimit}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <span className="text-[#64748B]">Historical Lookback</span>
                <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#0F172A] dark:text-white">
                  {entitlements.rules.historical_analytics_days.numericLimit || 0} days
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'personalization' ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Display Name
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                />
              </label>
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Professional Title
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                />
              </label>
            </div>

            {/* Cover Banner Picker */}
            <div>
              <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                Cover Banner Style
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {(Object.keys(COVER_STYLES) as Array<keyof typeof COVER_STYLES>).map((key) => (
                  <button
                    key={key}
                    type="button"
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

            {/* Live Theme & Accent Color Switcher */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  Appearance Mode
                </p>
                <div className="mt-2 flex gap-2">
                  {(['light', 'dark', 'system'] as ThemePreference[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
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

            <button
              type="button"
              disabled={saving}
              onClick={() => void persistProfile()}
              className="viewora-btn-primary rounded-xl px-5 py-2.5 text-xs font-semibold disabled:opacity-60"
            >
              {saving ? 'Saving Personalization…' : 'Save Personalization'}
            </button>
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
              className="viewora-btn-primary rounded-xl px-5 py-2.5 text-xs font-semibold"
            >
              Save Notification Preferences
            </button>
          </div>
        ) : null}

        {activeTab === 'security' ? (
          <div className="space-y-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Session &amp; Connected Account Security
            </h2>
            <p>
              Authentication Mode:{' '}
              <strong className="font-mono text-[#0F172A] dark:text-white">{user.authMode}</strong>{' '}
              · Sessions use HttpOnly cookies with server-side verification.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${locale}/forgot-password`}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
              >
                Password Recovery Flow
              </Link>
              <Link
                href="/api/meta/oauth/start"
                prefetch={false}
                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-[#F8FAFC]"
              >
                Check Meta OAuth Connection Status
              </Link>
            </div>
          </div>
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
            <div className="rounded-2xl border border-rose-200 p-5 dark:border-rose-900/50">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-rose-600 dark:text-[#F87171]">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete Account
              </h3>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Permanently remove your profile and revoke active sessions via confirmed deletion.
              </p>
              <Link
                href={`/${locale}/dashboard/settings`}
                className="mt-4 inline-block rounded-xl border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
              >
                Open Deletion Controls
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
