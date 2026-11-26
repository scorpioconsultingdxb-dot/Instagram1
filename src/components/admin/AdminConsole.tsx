'use client';

import {
  Activity,
  BarChart2,
  Bell,
  ClipboardList,
  CreditCard,
  FileText,
  Flag,
  HeartPulse,
  LifeBuoy,
  Lock,
  Mail,
  Pencil,
  Plug,
  Plus,
  Search,
  Shield,
  Sliders,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SessionUser } from '@/lib/auth/session';
import type { FeatureKey, PlanCode, PlanDefinition, UserRole } from '@/lib/entitlements/types';
import { FEATURE_LABELS, formatUsdCents, INITIAL_PLANS } from '@/lib/entitlements/catalog';
import type { ProviderHealth } from '@/lib/providers/types';
import type {
  ApiUsageMetric,
  AuditLogRecord,
  BroadcastNotificationRecord,
  CmsContentRecord,
  FeatureFlagRecord,
  SearchAnalyticsMetric,
  StorageUsageSummary,
  SupportTicketRecord,
} from '@/lib/admin/store';
import type { AffiliateApplicationRecord } from '@/lib/referrals/service';
import type { FunnelEventName } from '@/lib/analytics/funnel';
import type { ExperimentDefinition } from '@/lib/experiments/ab';
import type { DatabaseHealthResult } from '@/lib/db/prisma';
import type { BackupDirectorySummary } from '@/lib/admin/backup-status';
import type { IntegrationCenterSnapshot, IntegrationProviderId } from '@/lib/integrations/types';
import type { PersistentEmergencyStates } from '@/lib/integrations/distributed-store';
import {
  evaluateBudgetUtilization,
  PROVIDER_ACTIVATION_CHECKLIST_ITEMS,
  type AdminCustomerUsageSummary,
  type EmergencyHaltMetadataRecord,
  type ProviderApprovalMap,
} from '@/lib/integrations/financial-shared';
import type { AdminCommunicationOverview } from '@/lib/db/repositories/email.repo';
import { EMAIL_TEMPLATE_CATALOG } from '@/lib/email/catalog';
import { ConfirmDialog, StatusBanner } from '@/components/layout/PageShell';

export type AdminTab =
  | 'users'
  | 'plans'
  | 'entitlements'
  | 'integrations'
  | 'communications'
  | 'support'
  | 'cms'
  | 'notifications'
  | 'flags'
  | 'usage'
  | 'providers'
  | 'searches'
  | 'conversions'
  | 'audit';

export interface AdminConsoleProps {
  actor: SessionUser;
  initialTab?: AdminTab;
  initialUsers: SessionUser[];
  initialPlans: PlanDefinition[];
  providerHealth: ProviderHealth[];
  databaseHealth?: DatabaseHealthResult;
  backupSummary?: BackupDirectorySummary;
  integrationCenter?: IntegrationCenterSnapshot;
  distributedTelemetry?: PersistentEmergencyStates | null;
  communicationOverview?: AdminCommunicationOverview | null;
  customerUsageSummary?: AdminCustomerUsageSummary | null;
  haltMetadata?: EmergencyHaltMetadataRecord[];
  initialProviderApprovals?: ProviderApprovalMap;
  apiUsage: ApiUsageMetric[];
  searchAnalytics: SearchAnalyticsMetric[];
  conversionAnalytics: {
    counts: Record<FunnelEventName, number>;
    searchToSignupRate: number;
    signupToUpgradeIntentRate: number;
    isSample?: boolean;
  };
  experiments: ExperimentDefinition[];
  initialCms: CmsContentRecord[];
  initialTickets: SupportTicketRecord[];
  initialBroadcasts: BroadcastNotificationRecord[];
  initialAuditLogs: AuditLogRecord[];
  initialFlags: FeatureFlagRecord[];
  jobQueueSummary?: {
    total: number;
    queued: number;
    running: number;
    completed: number;
    deadLetter: number;
    cancelled: number;
    lastHeartbeatAt: string | null;
  };
  storageUsage?: StorageUsageSummary;
  referralOverview?: {
    payoutsEnabled: false;
    proposedCommissionPercent: number;
    proposedCommissionMonths: number;
    codesCount: number;
    attributionsCount: number;
    campaignsCount: number;
    applications: AffiliateApplicationRecord[];
  };
}

const SUPPORT_RESPONSE_TEMPLATES = [
  {
    label: 'Data Provenance Notice',
    text: 'Verified: Viewora only displays legitimately available public information or clearly labeled demo/user-provided datasets. Private accounts are never accessed.',
  },
  {
    label: 'Meta API Scope Guidance',
    text: 'Official Meta Business Discovery requires an Instagram Professional account linked to a Meta App with instagram_basic & pages_show_list permissions.',
  },
  {
    label: 'Entitlement Verified',
    text: 'Checked account entitlements and workspace quotas. Confirmed active tier limits match published plan configuration (live billing remains disabled).',
  },
] as const;

const ASSIGNABLE_ROLES: UserRole[] = [
  'user',
  'analyst',
  'support_agent',
  'content_manager',
  'operations_admin',
  'admin',
  'super_admin',
];

export function AdminConsole({
  actor,
  initialTab = 'users',
  initialUsers,
  initialPlans,
  providerHealth,
  databaseHealth,
  backupSummary,
  integrationCenter,
  distributedTelemetry,
  communicationOverview,
  customerUsageSummary,
  haltMetadata = [],
  initialProviderApprovals = {},
  apiUsage,
  searchAnalytics,
  conversionAnalytics,
  experiments,
  initialCms,
  initialTickets,
  initialBroadcasts,
  initialAuditLogs,
  initialFlags,
  jobQueueSummary,
  storageUsage,
  referralOverview,
}: AdminConsoleProps) {
  const [affiliateApps, setAffiliateApps] = useState<AffiliateApplicationRecord[]>(
    referralOverview?.applications ?? []
  );
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [users, setUsers] = useState(initialUsers);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState<'all' | PlanCode>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');
  const [detailUser, setDetailUser] = useState<SessionUser | null>(null);
  const [revokeSessionsTarget, setRevokeSessionsTarget] = useState<SessionUser | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<SessionUser | null>(null);
  const [suspendedIds, setSuspendedIds] = useState<Record<string, boolean>>({});
  const [overrideTarget, setOverrideTarget] = useState<SessionUser | null>(null);
  const [overrideFeature, setOverrideFeature] = useState<FeatureKey>('tracked_profiles');
  const [overrideLimit, setOverrideLimit] = useState('25');
  const [overrideReason, setOverrideReason] = useState('');
  const [plans, setPlans] = useState(initialPlans);
  const [editingEnt, setEditingEnt] = useState<{
    planCode: PlanCode;
    featureKey: FeatureKey;
  } | null>(null);
  const [entDraftLimit, setEntDraftLimit] = useState('');
  const [entDraftUnlimited, setEntDraftUnlimited] = useState(false);
  const [entSaving, setEntSaving] = useState(false);
  const [cmsItems, setCmsItems] = useState(initialCms);
  const [editingCmsId, setEditingCmsId] = useState<string | null>(null);
  const [cmsDraftTitle, setCmsDraftTitle] = useState('');
  const [cmsDraftBody, setCmsDraftBody] = useState('');

  const [tickets, setTickets] = useState(initialTickets);
  const [ticketFilter, setTicketFilter] = useState<'all' | SupportTicketRecord['status']>('all');
  const [ticketNotesDraft, setTicketNotesDraft] = useState<Record<string, string>>({});

  const [broadcasts, setBroadcasts] = useState(initialBroadcasts);
  const [newBcastTitle, setNewBcastTitle] = useState('');
  const [newBcastBody, setNewBcastBody] = useState('');
  const [newBcastSegment, setNewBcastSegment] =
    useState<BroadcastNotificationRecord['targetSegment']>('all');

  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [auditSearch, setAuditSearch] = useState('');
  const [flags, setFlags] = useState(initialFlags);
  const [globalKillSwitch, setGlobalKillSwitch] = useState<boolean>(
    distributedTelemetry?.globalKillSwitchActive ??
      integrationCenter?.costControl.globalKillSwitchActive ??
      false
  );
  const [providerKillSwitches, setProviderKillSwitches] = useState<Record<string, boolean>>({
    ...(integrationCenter?.costControl.perProviderKillSwitches ?? {}),
    ...(distributedTelemetry?.providerKillSwitches ?? {}),
  });
  const [killSwitchConfirm, setKillSwitchConfirm] = useState<{
    scope: 'global' | IntegrationProviderId;
    label: string;
    nextActive: boolean;
  } | null>(null);
  const [killSwitchBusy, setKillSwitchBusy] = useState(false);
  const [providerApprovals, setProviderApprovals] = useState<ProviderApprovalMap>(
    initialProviderApprovals
  );
  const [selectedApprovalProvider, setSelectedApprovalProvider] = useState<
    'meta_official' | 'authorized_insights' | 'licensed_third_party' | 'gemini_ai' | 'resend_email'
  >('meta_official');
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null
  );

  const canManageRoles = actor.role === 'super_admin' || actor.role === 'admin';
  const canManageUsers =
    actor.role === 'super_admin' || actor.role === 'admin' || actor.role === 'operations_admin';
  const canManageEntitlements = actor.role === 'super_admin' || actor.role === 'admin';

  const planDistribution = useMemo(() => {
    const counts: Record<PlanCode, number> = {
      free: 0,
      starter: 0,
      premium: 0,
      pro: 0,
      agency: 0,
    };
    for (const u of users) {
      if (u.planCode in counts) counts[u.planCode] += 1;
    }
    return counts;
  }, [users]);

  const runAction = async (
    payload: Record<string, unknown>,
    successMsg: string
  ): Promise<{ ok: boolean; data?: Record<string, unknown> }> => {
    setBanner(null);
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as
        | ({ ok: boolean; error?: string; audit?: AuditLogRecord } & Record<string, unknown>)
        | null;
      if (!res.ok || !json?.ok) {
        setBanner({
          tone: 'error',
          message: json?.error ?? `Admin action failed (HTTP ${res.status}).`,
        });
        return { ok: false };
      }
      if (json.audit) {
        setAuditLogs((prev) => [json.audit!, ...prev]);
      }
      setBanner({ tone: 'success', message: successMsg });
      return { ok: true, data: json };
    } catch {
      setBanner({ tone: 'error', message: 'Network error while executing administrative action.' });
      return { ok: false };
    }
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: typeof Users }> = [
    { id: 'users', label: 'Customers', icon: Users },
    { id: 'plans', label: 'Plans', icon: CreditCard },
    { id: 'entitlements', label: 'Entitlements', icon: Sliders },
    { id: 'integrations', label: 'Integration Center', icon: Plug },
    { id: 'communications', label: 'Communications', icon: Mail },
    { id: 'support', label: 'Support', icon: LifeBuoy },
    { id: 'cms', label: 'Content CMS', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'flags', label: 'Feature Flags', icon: Flag },
    { id: 'usage', label: 'API Usage', icon: Activity },
    { id: 'providers', label: 'Operational Status', icon: HeartPulse },
    { id: 'searches', label: 'Search Metrics', icon: Search },
    { id: 'conversions', label: 'Conversions & A/B', icon: BarChart2 },
    { id: 'audit', label: 'Audit Logs', icon: ClipboardList },
  ];

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.planCode.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredTickets = useMemo(() => {
    if (ticketFilter === 'all') return tickets;
    return tickets.filter((t) => t.status === ticketFilter);
  }, [tickets, ticketFilter]);

  const filteredAudits = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (a) =>
        a.action.toLowerCase().includes(q) ||
        a.actorEmail.toLowerCase().includes(q) ||
        a.targetId.toLowerCase().includes(q)
    );
  }, [auditLogs, auditSearch]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="viewora-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Shield className="h-5 w-5 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
            <h1 className="font-display text-xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
              Viewora Business Operations &amp; Admin Console
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase text-emerald-800 dark:bg-emerald-950 dark:text-[#34D399]">
              {actor.role}
            </span>
            {databaseHealth ? (
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                  databaseHealth.status === 'healthy'
                    ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200'
                }`}
              >
                PG: {databaseHealth.status}
                {databaseHealth.latencyMs !== null ? ` · ${databaseHealth.latencyMs}ms` : ''}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Signed in as {actor.email} · Least-privilege RBAC enforced server-side · Append-only Audit Logs enforced by PostgreSQL privileges &amp; trigger.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right tabular-nums">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#263047] dark:bg-[#0F172A]">
            <p className="text-[10px] font-semibold text-[#64748B] uppercase">Accounts</p>
            <p className="font-display text-base font-extrabold text-[#0F172A] dark:text-white">
              {users.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#263047] dark:bg-[#0F172A]">
            <p className="text-[10px] font-semibold text-[#64748B] uppercase">Open Tickets</p>
            <p className="font-display text-base font-extrabold text-[#0F172A] dark:text-white">
              {tickets.filter((t) => t.status === 'open').length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-[#263047] dark:bg-[#0F172A]">
            <p className="text-[10px] font-semibold text-[#64748B] uppercase">Audit Trail</p>
            <p className="font-display text-base font-extrabold text-[#0F172A] dark:text-white">
              {auditLogs.length}
            </p>
          </div>
        </div>
      </div>

      {banner ? (
        <div className="mt-4">
          <StatusBanner
            tone={banner.tone}
            message={banner.message}
            onDismiss={() => setBanner(null)}
          />
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="Admin sections"
        className="mt-5 flex gap-1.5 overflow-x-auto pb-2"
      >
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-[#7957FF] text-white shadow-sm'
                  : 'viewora-card text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="viewora-card mt-4 rounded-2xl p-6">
        {tab === 'users' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                  Customer &amp; Administrative Permissions ({users.length} recorded accounts)
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Plan updates sync immediately with customer entitlements. Private customer
                  research notes remain strictly inaccessible to administrators.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter users by membership plan"
                  value={userPlanFilter}
                  onChange={(e) => setUserPlanFilter(e.target.value as 'all' | PlanCode)}
                  className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                >
                  <option value="all">All plans</option>
                  {(['free', 'starter', 'premium', 'pro', 'agency'] as PlanCode[]).map((c) => (
                    <option key={c} value={c}>
                      {c} ({planDistribution[c]})
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter users by role"
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value as 'all' | UserRole)}
                  className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                >
                  <option value="all">All roles</option>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  aria-label="Filter users by email, name, plan, or role"
                  placeholder="Filter by email, name, plan…"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:w-56 dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                />
              </div>
            </div>

            {/* Genuine Recorded Membership Distribution */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(['free', 'starter', 'premium', 'pro', 'agency'] as PlanCode[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setUserPlanFilter(userPlanFilter === code ? 'all' : code)}
                  className={`rounded-xl border p-3 text-left transition ${
                    userPlanFilter === code
                      ? 'border-[#7957FF] bg-violet-50/70 dark:bg-[#192337]'
                      : 'border-slate-200 bg-slate-50/70 dark:border-[#263047] dark:bg-[#0F172A]'
                  }`}
                >
                  <span className="block text-[10px] font-bold tracking-wider text-[#64748B] uppercase">
                    {code}
                  </span>
                  <span className="mt-0.5 block font-display text-lg font-extrabold tabular-nums text-[#0F172A] dark:text-white">
                    {planDistribution[code]}
                  </span>
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[#64748B] dark:border-[#263047]">
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Segment</th>
                    <th className="py-2 pr-4">Membership Plan</th>
                    <th className="py-2 pr-4">RBAC Role</th>
                    <th className="py-2">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#263047]">
                  {filteredUsers
                    .filter((u) => (userPlanFilter === 'all' ? true : u.planCode === userPlanFilter))
                    .filter((u) => (userRoleFilter === 'all' ? true : u.role === userRoleFilter))
                    .map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 pr-4">
                        <span className="block font-semibold text-[#0F172A] dark:text-white">
                          {u.fullName}
                        </span>
                        <span className="font-mono text-[11px] text-[#64748B]">{u.email}</span>
                        {suspendedIds[u.id] ? (
                          <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            Suspended
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 capitalize text-[#0F172A] dark:text-slate-300">
                        {u.segment}
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          aria-label={`Plan for ${u.email}`}
                          value={u.planCode}
                          onChange={async (e) => {
                            const planCode = e.target.value as PlanCode;
                            const res = await runAction(
                              { type: 'update_user', userId: u.id, planCode },
                              `Persisted membership tier "${planCode}" for ${u.email}.`
                            );
                            if (res.ok) {
                              setUsers((prev) =>
                                prev.map((x) => (x.id === u.id ? { ...x, planCode } : x))
                              );
                            }
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                        >
                          {(['free', 'starter', 'premium', 'pro', 'agency'] as PlanCode[]).map(
                            (code) => (
                              <option key={code} value={code}>
                                {code}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        {canManageRoles &&
                        u.id !== actor.id &&
                        (actor.role === 'super_admin' || u.role !== 'super_admin') ? (
                          <select
                            aria-label={`Role for ${u.email}`}
                            value={u.role}
                            onChange={async (e) => {
                              const role = e.target.value as UserRole;
                              const res = await runAction(
                                { type: 'update_user', userId: u.id, role },
                                `Updated role for ${u.email} to ${role}.`
                              );
                              if (res.ok) {
                                setUsers((prev) =>
                                  prev.map((x) => (x.id === u.id ? { ...x, role } : x))
                                );
                              }
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-mono text-[11px] dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                          >
                            {ASSIGNABLE_ROLES.filter(
                              (r) => actor.role === 'super_admin' || r !== 'super_admin'
                            ).map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] dark:bg-[#0F172A]">
                            {u.role}
                            {u.id === actor.id ? ' (you)' : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailUser(u)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-slate-200"
                          >
                            Details
                          </button>
                          {canManageEntitlements ? (
                            <button
                              type="button"
                              onClick={() => setOverrideTarget(u)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-[#6941EF] hover:border-[#7957FF] dark:border-[#263047] dark:text-[#A99AFF]"
                            >
                              Override
                            </button>
                          ) : null}
                          {canManageUsers && u.id !== actor.id ? (
                            suspendedIds[u.id] ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await runAction(
                                    { type: 'reactivate_user', userId: u.id },
                                    `Reactivated ${u.email}.`
                                  );
                                  if (res.ok) {
                                    setSuspendedIds((prev) => ({ ...prev, [u.id]: false }));
                                  }
                                }}
                                className="rounded-lg border border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-[#34D399]"
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSuspendTarget(u)}
                                className="rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300"
                              >
                                Suspend
                              </button>
                            )
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {overrideTarget ? (
              <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 text-xs dark:border-[#263047] dark:bg-[#192337]/60">
                <p className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Grant Per-User Entitlement Override — {overrideTarget.email}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <select
                    aria-label="Override feature key"
                    value={overrideFeature}
                    onChange={(e) => setOverrideFeature(e.target.value as FeatureKey)}
                    className="h-9 rounded-xl border border-slate-300 bg-white px-2.5 text-xs dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                  >
                    {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((fk) => (
                      <option key={fk} value={fk}>
                        {FEATURE_LABELS[fk].label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={overrideLimit}
                    onChange={(e) => setOverrideLimit(e.target.value)}
                    placeholder="Numeric limit (blank = unlimited)"
                    aria-label="Override numeric limit"
                    className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                  />
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Audit reason (optional)"
                    aria-label="Override audit reason"
                    className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const num = overrideLimit.trim() === '' ? null : Number(overrideLimit);
                      const res = await runAction(
                        {
                          type: 'grant_user_override',
                          userId: overrideTarget.id,
                          featureKey: overrideFeature,
                          enabled: true,
                          numericLimit: Number.isNaN(num) ? null : num,
                          reason: overrideReason.trim() || undefined,
                        },
                        `Saved entitlement override (${overrideFeature}) for ${overrideTarget.email}.`
                      );
                      if (res.ok) {
                        setOverrideTarget(null);
                        setOverrideReason('');
                      }
                    }}
                    className="viewora-btn-primary rounded-xl px-4 py-1.5 text-xs font-semibold"
                  >
                    Apply Override
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverrideTarget(null)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#64748B] dark:border-[#263047]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {detailUser ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-5 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-white">
                      Customer Account Details — {detailUser.fullName}
                    </h3>
                    <p className="mt-0.5 font-mono text-[11px] text-[#64748B]">
                      ID: {detailUser.id} · {detailUser.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailUser(null)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-[#64748B] hover:text-[#0F172A] dark:border-[#263047] dark:text-slate-300"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#263047] dark:bg-[#131C2E]">
                    <span className="block text-[10px] font-semibold uppercase text-[#64748B]">Plan</span>
                    <span className="font-bold uppercase text-[#0F172A] dark:text-white">{detailUser.planCode}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#263047] dark:bg-[#131C2E]">
                    <span className="block text-[10px] font-semibold uppercase text-[#64748B]">RBAC Role</span>
                    <span className="font-mono font-bold text-[#0F172A] dark:text-white">{detailUser.role}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#263047] dark:bg-[#131C2E]">
                    <span className="block text-[10px] font-semibold uppercase text-[#64748B]">Email Status</span>
                    <span className="font-semibold text-[#0F172A] dark:text-white">
                      {detailUser.emailVerified ? 'Verified' : 'Pending Verification'}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#263047] dark:bg-[#131C2E]">
                    <span className="block text-[10px] font-semibold uppercase text-[#64748B]">Segment</span>
                    <span className="font-semibold capitalize text-[#0F172A] dark:text-white">{detailUser.segment}</span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Privacy boundary: Private customer research notes and saved profile commentary are protected by PostgreSQL RLS and remain strictly inaccessible to administrators.
                </p>
                {canManageUsers && detailUser.id !== actor.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRevokeSessionsTarget(detailUser)}
                      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                    >
                      Revoke All Active Sessions
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <ConfirmDialog
              open={revokeSessionsTarget !== null}
              destructive
              title={`Revoke all active sessions for ${revokeSessionsTarget?.email ?? ''}?`}
              description="This immediately invalidates all database-backed sessions for this customer across every device and appends an entry to the immutable audit log."
              confirmLabel="Revoke All Sessions"
              onCancel={() => setRevokeSessionsTarget(null)}
              onConfirm={async () => {
                if (!revokeSessionsTarget) return;
                await runAction(
                  { type: 'revoke_user_sessions', userId: revokeSessionsTarget.id },
                  `Revoked all active sessions for ${revokeSessionsTarget.email}.`
                );
                setRevokeSessionsTarget(null);
              }}
            />

            <ConfirmDialog
              open={suspendTarget !== null}
              destructive
              title={`Suspend account ${suspendTarget?.email ?? ''}?`}
              description="Suspending this account immediately revokes all active database sessions and prevents sign-in until reactivated."
              confirmLabel="Suspend Account"
              onCancel={() => setSuspendTarget(null)}
              onConfirm={async () => {
                if (!suspendTarget) return;
                const res = await runAction(
                  { type: 'suspend_user', userId: suspendTarget.id },
                  `Suspended ${suspendTarget.email} and revoked all active sessions.`
                );
                if (res.ok) {
                  setSuspendedIds((prev) => ({ ...prev, [suspendTarget.id]: true }));
                }
                setSuspendTarget(null);
              }}
            />
          </div>
        ) : null}

        {tab === 'plans' ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                5-Tier Plan Configuration (Synchronized · Payments Disabled)
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Adjusting demo prices or quarterly/annual discounts persists immediately across
                Homepage, Public Pricing, and Dashboard previews.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {plans.map((p) => {
                const q =
                  p.billingOptions.find((o) => o.interval === 'quarterly')?.discountPercent ?? 15;
                const a =
                  p.billingOptions.find((o) => o.interval === 'annual')?.discountPercent ?? 30;
                return (
                  <div
                    key={p.code}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                  >
                    <div>
                      <p className="font-display text-sm font-bold text-[#0F172A] dark:text-white">
                        {p.name}
                      </p>
                      <p className="mt-1 font-display text-xl font-extrabold tabular-nums text-[#6941EF] dark:text-[#A99AFF]">
                        {formatUsdCents(p.monthlyPriceCents)}/mo
                      </p>
                      <p className="mt-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        Quarterly: <strong>{q}%</strong> off · Annual: <strong>{a}%</strong> off
                      </p>
                    </div>
                    {p.code !== 'free' ? (
                      <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-[#263047]">
                        <label className="block text-[11px] font-semibold text-[#64748B]">
                          Quarterly Discount %
                          <select
                            aria-label={`${p.name} quarterly discount`}
                            value={q}
                            onChange={async (e) => {
                              const quarterlyDiscount = Number(e.target.value);
                              const res = await runAction(
                                { type: 'update_plan', planCode: p.code, quarterlyDiscount },
                                `Persisted ${p.name} quarterly discount to ${quarterlyDiscount}%.`
                              );
                              if (res.ok) {
                                setPlans((prev) =>
                                  prev.map((item) =>
                                    item.code === p.code
                                      ? {
                                          ...item,
                                          billingOptions: item.billingOptions.map((o) =>
                                            o.interval === 'quarterly'
                                              ? { ...o, discountPercent: quarterlyDiscount }
                                              : o
                                          ),
                                        }
                                      : item
                                  )
                                );
                              }
                            }}
                            className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                          >
                            {[0, 10, 15, 20, 25].map((pct) => (
                              <option key={pct} value={pct}>
                                {pct}% off
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-[11px] font-semibold text-[#64748B]">
                          Annual Discount %
                          <select
                            aria-label={`${p.name} annual discount`}
                            value={a}
                            onChange={async (e) => {
                              const annualDiscount = Number(e.target.value);
                              const res = await runAction(
                                { type: 'update_plan', planCode: p.code, annualDiscount },
                                `Persisted ${p.name} annual discount to ${annualDiscount}%.`
                              );
                              if (res.ok) {
                                setPlans((prev) =>
                                  prev.map((item) =>
                                    item.code === p.code
                                      ? {
                                          ...item,
                                          billingOptions: item.billingOptions.map((o) =>
                                            o.interval === 'annual'
                                              ? { ...o, discountPercent: annualDiscount }
                                              : o
                                          ),
                                        }
                                      : item
                                  )
                                );
                              }
                            }}
                            className="mt-1 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                          >
                            {[0, 15, 20, 25, 30, 35, 40].map((pct) => (
                              <option key={pct} value={pct}>
                                {pct}% off
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : (
                      <p className="mt-3 text-[11px] text-[#64748B]">Permanent free tier ($0)</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {tab === 'entitlements' ? (
          <div className="overflow-x-auto">
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
              Centralized Entitlement Matrix (Persisted)
            </h2>
            <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Toggle feature activation or click any quota to edit numeric or unlimited (∞) limits
              inline. Updates persist immediately across public pricing and server-side quota
              enforcement.
            </p>
            <table className="mt-4 w-full min-w-[780px] text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-[#64748B] dark:border-[#263047]">
                  <th className="py-2 pr-4">Feature Key</th>
                  {plans.map((p) => (
                    <th key={p.code} className="py-2 text-center">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#263047]">
                {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((key) => (
                  <tr key={key}>
                    <td className="py-2.5 pr-4">
                      <span className="block font-semibold text-[#0F172A] dark:text-slate-200">
                        {FEATURE_LABELS[key].label}
                      </span>
                      <span className="font-mono text-[10px] text-[#64748B]">{key}</span>
                    </td>
                    {plans.map((plan) => {
                      const rule = plan.entitlements[key];
                      const baselineRule = INITIAL_PLANS.find((p) => p.code === plan.code)?.entitlements[key];
                      const isBooleanFeature = INITIAL_PLANS.every(
                        (p) => p.entitlements[key].numericLimit === null
                      );
                      const isEditingThis =
                        editingEnt?.planCode === plan.code && editingEnt?.featureKey === key;

                      const saveEntitlementLimit = async () => {
                        if (entSaving) return;
                        let parsedLimit: number | null = null;
                        if (!entDraftUnlimited) {
                          const trimmed = entDraftLimit.trim();
                          const num = Number(trimmed);
                          if (!trimmed || !Number.isInteger(num) || num < 0 || num > 100_000) {
                            setBanner({
                              tone: 'error',
                              message:
                                'Quota limit must be a whole number between 0 and 100,000, or set Unlimited (∞).',
                            });
                            return;
                          }
                          parsedLimit = num;
                        }
                        const nextEnabled = entDraftUnlimited ? true : parsedLimit !== 0;
                        setEntSaving(true);
                        try {
                          const res = await runAction(
                            {
                              type: 'update_entitlement',
                              planCode: plan.code,
                              featureKey: key,
                              enabled: nextEnabled,
                              numericLimit: parsedLimit,
                            },
                            `Updated ${key} on ${plan.name} → ${
                              nextEnabled ? (parsedLimit === null ? 'Unlimited (∞)' : parsedLimit) : 'Off'
                            }.`
                          );
                          if (res.ok) {
                            setPlans((prev) =>
                              prev.map((item) =>
                                item.code === plan.code
                                  ? {
                                      ...item,
                                      entitlements: {
                                        ...item.entitlements,
                                        [key]: { enabled: nextEnabled, numericLimit: parsedLimit },
                                      },
                                    }
                                  : item
                              )
                            );
                            setEditingEnt(null);
                          }
                        } finally {
                          setEntSaving(false);
                        }
                      };

                      return (
                        <td key={plan.code} className="px-1.5 py-2.5 text-center align-middle">
                          {isEditingThis ? (
                            <div className="mx-auto flex w-36 flex-col gap-1.5 rounded-xl border border-[#7957FF]/60 bg-white p-2 text-left shadow-sm dark:bg-[#0F172A]">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={100000}
                                  step={1}
                                  disabled={entDraftUnlimited}
                                  value={entDraftUnlimited ? '' : entDraftLimit}
                                  onChange={(e) => setEntDraftLimit(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      void saveEntitlementLimit();
                                    } else if (e.key === 'Escape') {
                                      setEditingEnt(null);
                                    }
                                  }}
                                  placeholder={entDraftUnlimited ? '∞' : 'Quota'}
                                  aria-label={`Numeric limit for ${plan.name} ${key}`}
                                  className="h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-[#0F172A] disabled:bg-slate-100 disabled:text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                                />
                              </div>
                              <label className="flex items-center gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                                <input
                                  type="checkbox"
                                  checked={entDraftUnlimited}
                                  onChange={(e) => setEntDraftUnlimited(e.target.checked)}
                                />
                                <span>Unlimited (∞)</span>
                              </label>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={entSaving}
                                  onClick={() => void saveEntitlementLimit()}
                                  className="viewora-btn-primary flex-1 rounded-md px-2 py-1 text-[10px] font-semibold disabled:opacity-60"
                                >
                                  {entSaving ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingEnt(null)}
                                  className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-[#64748B] hover:text-[#0F172A] dark:border-[#263047] dark:text-[#94A3B8]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                aria-label={`Toggle ${plan.name} ${key}`}
                                onClick={async () => {
                                  const nextEnabled = !rule.enabled;
                                  let nextLimit: number | null;
                                  if (!nextEnabled) {
                                    nextLimit = isBooleanFeature ? null : 0;
                                  } else if (isBooleanFeature) {
                                    nextLimit = null;
                                  } else {
                                    const restored =
                                      rule.numericLimit && rule.numericLimit > 0
                                        ? rule.numericLimit
                                        : baselineRule?.numericLimit && baselineRule.numericLimit > 0
                                          ? baselineRule.numericLimit
                                          : 10;
                                    nextLimit = restored;
                                  }
                                  const res = await runAction(
                                    {
                                      type: 'update_entitlement',
                                      planCode: plan.code,
                                      featureKey: key,
                                      enabled: nextEnabled,
                                      numericLimit: nextLimit,
                                    },
                                    `${nextEnabled ? 'Enabled' : 'Disabled'} ${key} on ${plan.name}.`
                                  );
                                  if (res.ok) {
                                    setPlans((prev) =>
                                      prev.map((item) =>
                                        item.code === plan.code
                                          ? {
                                              ...item,
                                              entitlements: {
                                                ...item.entitlements,
                                                [key]: { enabled: nextEnabled, numericLimit: nextLimit },
                                              },
                                            }
                                          : item
                                      )
                                    );
                                  }
                                }}
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                                  rule.enabled
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-[#34D399]'
                                    : 'bg-slate-100 text-[#64748B] hover:bg-slate-200 dark:bg-[#0F172A] dark:text-[#94A3B8]'
                                }`}
                              >
                                {rule.enabled
                                  ? rule.numericLimit === null
                                    ? '∞'
                                    : rule.numericLimit
                                  : 'Off'}
                              </button>
                              <button
                                type="button"
                                title={`Edit limit for ${plan.name} ${key}`}
                                aria-label={`Edit limit for ${plan.name} ${key}`}
                                onClick={() => {
                                  setEditingEnt({ planCode: plan.code, featureKey: key });
                                  const isInf = rule.enabled && rule.numericLimit === null;
                                  setEntDraftUnlimited(isInf);
                                  setEntDraftLimit(
                                    rule.numericLimit !== null ? String(rule.numericLimit) : '10'
                                  );
                                }}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-[#64748B] transition hover:border-[#7957FF] hover:text-[#6941EF] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#A99AFF]"
                              >
                                <Pencil className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'support' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                Support Ticket Workflows ({filteredTickets.length})
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTicketFilter(st)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize ${
                      ticketFilter === st
                        ? 'bg-[#7957FF] text-white'
                        : 'bg-slate-100 text-[#64748B] dark:bg-[#0F172A] dark:text-[#94A3B8]'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredTickets.map((t) => {
                const draftNote = ticketNotesDraft[t.id] ?? t.adminNotes;
                return (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-[#0F172A] dark:text-white">{t.subject}</p>
                          {t.isSample ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              SAMPLE
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-[#64748B]">
                          {t.id} · {t.email} · Priority: {t.priority}
                        </p>
                      </div>
                      <select
                        aria-label={`Status for ${t.id}`}
                        value={t.status}
                        onChange={async (e) => {
                          const status = e.target.value as SupportTicketRecord['status'];
                          const res = await runAction(
                            { type: 'update_ticket', id: t.id, status },
                            `Persisted ticket ${t.id} status → ${status}.`
                          );
                          if (res.ok) {
                            setTickets((prev) =>
                              prev.map((item) => (item.id === t.id ? { ...item, status } : item))
                            );
                          }
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <p className="mt-2 text-[#64748B] dark:text-slate-300">{t.message}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#64748B]">
                        Response Templates:
                      </span>
                      {SUPPORT_RESPONSE_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.label}
                          type="button"
                          onClick={() =>
                            setTicketNotesDraft({ ...ticketNotesDraft, [t.id]: tpl.text })
                          }
                          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-[#6941EF] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#A99AFF]"
                        >
                          + {tpl.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={draftNote}
                        onChange={(e) =>
                          setTicketNotesDraft({ ...ticketNotesDraft, [t.id]: e.target.value })
                        }
                        placeholder="Add internal/customer support resolution note…"
                        aria-label={`Admin notes for ${t.id}`}
                        className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await runAction(
                            { type: 'update_ticket', id: t.id, adminNotes: draftNote },
                            `Saved support notes for ticket ${t.id}.`
                          );
                          if (res.ok) {
                            setTickets((prev) =>
                              prev.map((item) =>
                                item.id === t.id ? { ...item, adminNotes: draftNote } : item
                              )
                            );
                          }
                        }}
                        className="viewora-btn-primary h-9 rounded-lg px-3.5 text-xs font-semibold"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {tab === 'cms' ? (
          <div className="space-y-4">
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
              Content Editing (Localized Disclosures &amp; Guides)
            </h2>
            {cmsItems.map((item) => {
              const editing = editingCmsId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[#0F172A] dark:text-white">
                      {item.title} ({item.locale}) ·{' '}
                      <span className="font-mono text-[11px] font-normal text-[#64748B]">
                        {item.slug}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (editing) {
                            setEditingCmsId(null);
                          } else {
                            setEditingCmsId(item.id);
                            setCmsDraftTitle(item.title);
                            setCmsDraftBody(item.body);
                          }
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold dark:border-[#263047] dark:bg-[#131C2E]"
                      >
                        {editing ? 'Cancel' : 'Edit Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const nextPub = !item.isPublished;
                          const res = await runAction(
                            { type: 'update_cms', id: item.id, isPublished: nextPub },
                            `${nextPub ? 'Published' : 'Unpublished'} "${item.title}".`
                          );
                          if (res.ok) {
                            setCmsItems((prev) =>
                              prev.map((c) =>
                                c.id === item.id ? { ...c, isPublished: nextPub } : c
                              )
                            );
                          }
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                          item.isPublished
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-[#34D399]'
                            : 'border border-slate-300 bg-white text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E]'
                        }`}
                      >
                        {item.isPublished ? 'Published' : 'Draft'}
                      </button>
                    </div>
                  </div>
                  {editing ? (
                    <div className="mt-3 space-y-2.5">
                      <input
                        type="text"
                        value={cmsDraftTitle}
                        onChange={(e) => setCmsDraftTitle(e.target.value)}
                        aria-label="CMS title"
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                      />
                      <textarea
                        rows={3}
                        value={cmsDraftBody}
                        onChange={(e) => setCmsDraftBody(e.target.value)}
                        aria-label="CMS body"
                        className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await runAction(
                            {
                              type: 'update_cms',
                              id: item.id,
                              title: cmsDraftTitle,
                              body: cmsDraftBody,
                            },
                            `Saved copy updates for "${cmsDraftTitle}".`
                          );
                          if (res.ok) {
                            setCmsItems((prev) =>
                              prev.map((c) =>
                                c.id === item.id
                                  ? { ...c, title: cmsDraftTitle, body: cmsDraftBody }
                                  : c
                              )
                            );
                            setEditingCmsId(null);
                          }
                        }}
                        className="viewora-btn-primary rounded-lg px-3.5 py-1.5 text-xs font-semibold"
                      >
                        Save Copy
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[#64748B] dark:text-slate-300">{item.body}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {tab === 'notifications' ? (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                Customer Notification Management
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Active broadcasts appear in customers&apos; Notification Centers filtered by target
                segment.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
              <p className="text-xs font-bold text-[#0F172A] dark:text-white">
                Publish New Customer Announcement
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={newBcastTitle}
                  onChange={(e) => setNewBcastTitle(e.target.value)}
                  placeholder="Announcement title"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs sm:col-span-2 dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                />
                <select
                  value={newBcastSegment}
                  onChange={(e) =>
                    setNewBcastSegment(
                      e.target.value as BroadcastNotificationRecord['targetSegment']
                    )
                  }
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                >
                  <option value="all">Target: All Customers</option>
                  <option value="personal">Target: Personal</option>
                  <option value="business">Target: Business</option>
                  <option value="agency">Target: Agency</option>
                </select>
              </div>
              <textarea
                rows={2}
                value={newBcastBody}
                onChange={(e) => setNewBcastBody(e.target.value)}
                placeholder="Announcement body…"
                className="mt-2.5 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
              />
              <button
                type="button"
                onClick={async () => {
                  const res = await runAction(
                    {
                      type: 'create_broadcast',
                      title: newBcastTitle,
                      body: newBcastBody,
                      targetSegment: newBcastSegment,
                    },
                    `Published announcement "${newBcastTitle}".`
                  );
                  const created = res.data?.broadcast as BroadcastNotificationRecord | undefined;
                  if (res.ok && created) {
                    setBroadcasts((prev) => [created, ...prev]);
                    setNewBcastTitle('');
                    setNewBcastBody('');
                  }
                }}
                className="viewora-btn-primary mt-2.5 inline-flex items-center gap-1 rounded-lg px-3.5 py-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Publish Announcement
              </button>
            </div>

            <div className="space-y-2.5">
              {broadcasts.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <div>
                    <p className="font-bold text-[#0F172A] dark:text-white">
                      {b.title}{' '}
                      <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-700 dark:bg-[#192337] dark:text-slate-300">
                        {b.targetSegment}
                      </span>
                    </p>
                    <p className="mt-1 text-[#64748B] dark:text-[#94A3B8]">{b.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const nextActive = !b.isActive;
                      const res = await runAction(
                        { type: 'toggle_broadcast', id: b.id, isActive: nextActive },
                        `${nextActive ? 'Activated' : 'Paused'} announcement "${b.title}".`
                      );
                      if (res.ok) {
                        setBroadcasts((prev) =>
                          prev.map((x) => (x.id === b.id ? { ...x, isActive: nextActive } : x))
                        );
                      }
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      b.isActive
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-300 bg-white text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E]'
                    }`}
                  >
                    {b.isActive ? 'Active' : 'Paused'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === 'flags' ? (
          <div className="space-y-3">
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
              Feature Flags (Persisted)
            </h2>
            {flags.map((f) => (
              <div
                key={f.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-[#0F172A] dark:text-white">
                      {f.key}
                    </span>
                    {f.locked ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        LOCKED FALSE
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[#64748B] dark:text-[#94A3B8]">{f.description}</p>
                </div>
                <button
                  type="button"
                  disabled={f.locked}
                  onClick={async () => {
                    const nextEnabled = !f.enabled;
                    const res = await runAction(
                      { type: 'toggle_flag', key: f.key, enabled: nextEnabled },
                      `Persisted flag ${f.key} → ${nextEnabled ? 'enabled' : 'disabled'}.`
                    );
                    if (res.ok) {
                      setFlags((prev) =>
                        prev.map((item) =>
                          item.key === f.key ? { ...item, enabled: nextEnabled } : item
                        )
                      );
                    }
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                    f.enabled
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-300 bg-white text-[#64748B] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-300'
                  }`}
                >
                  {f.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'usage' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                Provider API Usage
              </h2>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {apiUsage.some((m) => m.isSample) ? 'Sample Baseline Data' : 'Recorded Runtime Metrics'}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {apiUsage.map((m) => (
                <div
                  key={m.providerId}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <p className="font-mono font-semibold text-[#0F172A] dark:text-white">
                    {m.providerId}
                  </p>
                  <p className="mt-2 font-display text-2xl font-extrabold tabular-nums">
                    {m.requests24h}
                  </p>
                  <p className="mt-1 text-[11px] text-[#64748B]">
                    Err: {m.errorRatePercent}% · Avg: {m.avgLatencyMs}ms
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === 'integrations' ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                  Super Admin External API Integration Center (Phase 5 Readiness)
                </h2>
                <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Centralized governance for official, licensed, AI, and email providers. Every external provider remains disabled by default until explicitly enabled via server feature flag and configured credentials. Raw secrets are never exposed here.
                </p>
              </div>
              {integrationCenter ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                      distributedTelemetry?.backend === 'postgresql'
                        ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200'
                        : 'bg-slate-200 text-slate-700 dark:bg-[#192337] dark:text-slate-300'
                    }`}
                  >
                    Coordination: {distributedTelemetry?.backend === 'postgresql' ? 'PostgreSQL Durable' : 'Process-Local Fallback'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-700 dark:bg-[#192337] dark:text-slate-300">
                    Redis: {distributedTelemetry?.redisAdapterConfigured ? 'Configured (Standby)' : 'Standby / Inactive'}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-800 dark:bg-emerald-950 dark:text-[#34D399]">
                    {integrationCenter.allPaidProvidersDisabled
                      ? 'All Paid APIs Disabled'
                      : `${integrationCenter.costControl.paidProvidersActiveCount} External Active`}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Payments Locked: False
                  </span>
                </div>
              ) : null}
            </div>

            {integrationCenter ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs tabular-nums">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#263047] dark:bg-[#0F172A]">
                    <p className="text-[10px] font-semibold uppercase text-[#64748B]">Daily Spend / Cap</p>
                    <p className="mt-1 font-display text-base font-extrabold text-[#0F172A] dark:text-white">
                      ${(distributedTelemetry?.dailySpentUsd ?? integrationCenter.costControl.dailySpentUsd).toFixed(2)} / ${(distributedTelemetry?.dailyCapUsd ?? integrationCenter.costControl.dailyCapUsd).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#263047] dark:bg-[#0F172A]">
                    <p className="text-[10px] font-semibold uppercase text-[#64748B]">Monthly Spend / Cap</p>
                    <p className="mt-1 font-display text-base font-extrabold text-[#0F172A] dark:text-white">
                      ${(distributedTelemetry?.monthlySpentUsd ?? integrationCenter.costControl.monthlySpentUsd).toFixed(2)} / ${(distributedTelemetry?.monthlyCapUsd ?? integrationCenter.costControl.monthlyCapUsd).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#263047] dark:bg-[#0F172A]">
                    <p className="text-[10px] font-semibold uppercase text-[#64748B]">Persisted 24h Calls / Err</p>
                    <p className="mt-1 font-display text-base font-extrabold text-[#0F172A] dark:text-white">
                      {distributedTelemetry?.persistedApiCalls24h ?? 0} / {distributedTelemetry?.persistedApiErrors24h ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#263047] dark:bg-[#0F172A]">
                    <p className="text-[10px] font-semibold uppercase text-[#64748B]">Global Kill Switch</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span
                        className={`font-display text-base font-extrabold ${
                          globalKillSwitch
                            ? 'text-rose-600 dark:text-[#F87171]'
                            : 'text-[#0F172A] dark:text-white'
                        }`}
                      >
                        {globalKillSwitch ? 'ACTIVE' : 'Standby'}
                      </span>
                      {canManageEntitlements ? (
                        <button
                          type="button"
                          onClick={() =>
                            setKillSwitchConfirm({
                              scope: 'global',
                              label: 'Global External API Kill Switch',
                              nextActive: !globalKillSwitch,
                            })
                          }
                          className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${
                            globalKillSwitch
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-600 text-white'
                          }`}
                        >
                          {globalKillSwitch ? 'Resume' : 'Halt All'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#263047] dark:bg-[#0F172A]">
                    <p className="text-[10px] font-semibold uppercase text-[#64748B]">Registered Adapters</p>
                    <p className="mt-1 font-display text-base font-extrabold text-[#0F172A] dark:text-white">
                      {integrationCenter.providers.length}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {integrationCenter.providers.map((prov) => {
                    const isKilled = Boolean(providerKillSwitches[prov.id]);
                    return (
                    <div
                      key={prov.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-[#0F172A] dark:text-white">{prov.name}</h3>
                            <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] dark:bg-[#192337]">
                              {prov.id}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                                isKilled
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200'
                                  : prov.effectiveState === 'enabled_ready'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-[#34D399]'
                                    : prov.effectiveState === 'active_demo'
                                      ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200'
                                      : prov.effectiveState === 'circuit_open'
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200'
                                        : 'bg-slate-200 text-slate-700 dark:bg-[#192337] dark:text-slate-300'
                              }`}
                            >
                              {isKilled ? 'EMERGENCY HALTED' : prov.effectiveState.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="mt-1 text-[#64748B] dark:text-[#94A3B8]">{prov.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase text-[#64748B]">
                            Circuit: {prov.circuitState}
                          </span>
                          {canManageEntitlements ? (
                            <button
                              type="button"
                              onClick={() =>
                                setKillSwitchConfirm({
                                  scope: prov.id,
                                  label: `${prov.name} (${prov.id})`,
                                  nextActive: !isKilled,
                                })
                              }
                              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${
                                isKilled
                                  ? 'bg-emerald-600 text-white'
                                  : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}
                            >
                              {isKilled ? 'Clear Halt' : 'Emergency Halt'}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11px]">
                        <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#263047] dark:bg-[#131C2E]">
                          <p className="font-semibold text-[#0F172A] dark:text-white">Flag &amp; Credentials</p>
                          <p className="mt-0.5 font-mono text-[10px] text-[#64748B]">
                            {prov.flagEnvVar}: {prov.flagEnabled ? 'true' : 'false'}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[#64748B]">
                            {prov.credentialsConfigured
                              ? 'Server credentials present'
                              : `Missing: ${prov.missingEnvVars.join(', ')}`}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#263047] dark:bg-[#131C2E]">
                          <p className="font-semibold text-[#0F172A] dark:text-white">Resilience &amp; Cache Policy</p>
                          <p className="mt-0.5 font-mono text-[10px] text-[#64748B]">
                            Timeout: {prov.policy.timeoutMs}ms · Retries: {prov.policy.maxRetries} · Rate: {prov.policy.maxRequestsPerMinute}/min · TTL: {prov.policy.cacheTtlSeconds}s
                          </p>
                          <p className="mt-0.5 text-[10px] text-[#64748B]">
                            Calls: {prov.usage.totalCalls} · Cache hits: {prov.usage.totalCalls > 0 ? prov.usage.cacheHits : 'Unavailable'} · Avg Latency: {prov.usage.totalCalls > 0 ? `${prov.usage.avgLatencyMs}ms` : 'Unavailable'} · Last Request: {prov.usage.lastCalledAt ? new Date(prov.usage.lastCalledAt).toLocaleTimeString() : 'Unavailable'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#263047] dark:bg-[#131C2E]">
                          <p className="font-semibold text-[#0F172A] dark:text-white">Licensing &amp; Privacy Guard</p>
                          <p className="mt-0.5 text-[10px] text-[#64748B]">{prov.commercialModel}</p>
                          <p className="mt-0.5 font-semibold text-emerald-700 dark:text-[#34D399]">
                            Private accounts: BLOCKED · IG passwords: NEVER COLLECTED
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>

                {distributedTelemetry && distributedTelemetry.recentPersistedErrors.length > 0 ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-xs dark:border-rose-900/50 dark:bg-rose-950/20">
                    <h3 className="font-bold text-rose-900 dark:text-rose-200">
                      Recent Persisted PostgreSQL API Errors ({distributedTelemetry.recentPersistedErrors.length})
                    </h3>
                    <div className="mt-2 space-y-1.5 font-mono text-[10px]">
                      {distributedTelemetry.recentPersistedErrors.slice(0, 8).map((err) => (
                        <div
                          key={err.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200/70 bg-white px-3 py-1.5 dark:border-rose-900/40 dark:bg-[#131C2E]"
                        >
                          <span>
                            [{err.providerId}] {err.endpoint} → HTTP {err.statusCode}
                            {err.latencyMs !== null ? ` (${err.latencyMs}ms)` : ''}
                          </span>
                          <span className="text-[#64748B]">
                            {new Date(err.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-[#0F172A] dark:text-white">
                      Budget Utilization &amp; Threshold Alerts (50% / 75% / 90% / 100%)
                    </h3>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Estimated API Cost — Not Confirmed Provider Invoice
                    </span>
                  </div>
                  {(() => {
                    const dailyUtil = evaluateBudgetUtilization(
                      'global_daily',
                      distributedTelemetry?.dailySpentUsd ?? integrationCenter.costControl.dailySpentUsd,
                      distributedTelemetry?.dailyCapUsd ?? integrationCenter.costControl.dailyCapUsd
                    );
                    const monthlyUtil = evaluateBudgetUtilization(
                      'global_monthly',
                      distributedTelemetry?.monthlySpentUsd ?? integrationCenter.costControl.monthlySpentUsd,
                      distributedTelemetry?.monthlyCapUsd ?? integrationCenter.costControl.monthlyCapUsd
                    );
                    return (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {[
                          { label: 'Daily Global Budget', util: dailyUtil },
                          { label: 'Monthly Global Budget', util: monthlyUtil },
                        ].map(({ label, util }) => (
                          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[#263047] dark:bg-[#131C2E]">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[#0F172A] dark:text-white">{label}</span>
                              <span className="font-mono text-[10px] font-bold uppercase text-[#6941EF] dark:text-[#A99AFF]">
                                {util.utilizationPercent}% · {util.alertLevel.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-[#0F172A]">
                              <div
                                className="h-full rounded-full bg-[#7957FF]"
                                style={{ width: `${Math.min(100, util.utilizationPercent)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {haltMetadata.length > 0 ? (
                    <div className="mt-3 space-y-1 font-mono text-[10px] text-[#64748B]">
                      {haltMetadata.slice(0, 4).map((hm) => (
                        <p key={hm.scope}>
                          Halt Log [{hm.scope}]: {hm.active ? 'HALTED' : 'CLEARED'} by {hm.actorEmail} — {hm.reason} ({new Date(hm.updatedAt).toLocaleString()})
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>

                {customerUsageSummary ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                    <h3 className="font-bold text-[#0F172A] dark:text-white">
                      Customer Usage Administration (Privacy-Safe Aggregates)
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">{customerUsageSummary.privacyNotice}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 tabular-nums">
                      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[#263047] dark:bg-[#131C2E]">
                        <p className="text-[10px] text-[#64748B]">Searches (24h)</p>
                        <p className="font-display text-lg font-extrabold">{customerUsageSummary.searches24h}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[#263047] dark:bg-[#131C2E]">
                        <p className="text-[10px] text-[#64748B]">AI Usage (30d)</p>
                        <p className="font-display text-lg font-extrabold">{customerUsageSummary.aiReports30d}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[#263047] dark:bg-[#131C2E]">
                        <p className="text-[10px] text-[#64748B]">Saved Profiles</p>
                        <p className="font-display text-lg font-extrabold">{customerUsageSummary.savedProfilesTotal}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[#263047] dark:bg-[#131C2E]">
                        <p className="text-[10px] text-[#64748B]">Report Exports (30d)</p>
                        <p className="font-display text-lg font-extrabold">{customerUsageSummary.reportExports30d}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* 10-Point Provider Activation Approval Workflow (Stage 49.6) */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-[#0F172A] dark:text-white">
                        Provider Activation Readiness Checklist (10-Point Gate)
                      </h3>
                      <p className="mt-0.5 text-[11px] text-[#64748B]">
                        Providers never auto-activate when credentials are detected. Track all 10 governance checks before flipping server flags.
                      </p>
                    </div>
                    <select
                      aria-label="Select provider approval checklist"
                      value={selectedApprovalProvider}
                      onChange={(e) =>
                        setSelectedApprovalProvider(e.target.value as typeof selectedApprovalProvider)
                      }
                      className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
                    >
                      <option value="meta_official">meta_official</option>
                      <option value="authorized_insights">authorized_insights</option>
                      <option value="licensed_third_party">licensed_third_party</option>
                      <option value="gemini_ai">gemini_ai</option>
                      <option value="resend_email">resend_email</option>
                    </select>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {PROVIDER_ACTIVATION_CHECKLIST_ITEMS.map((item) => {
                      const checked = Boolean(providerApprovals[selectedApprovalProvider]?.[item.key]);
                      return (
                        <label
                          key={item.key}
                          className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#263047] dark:bg-[#131C2E]"
                        >
                          <input
                            type="checkbox"
                            disabled={!canManageEntitlements}
                            checked={checked}
                            onChange={async () => {
                              const nextVal = !checked;
                              const res = await runAction(
                                {
                                  type: 'update_provider_approval_check',
                                  providerId: selectedApprovalProvider,
                                  checkKey: item.key,
                                  approved: nextVal,
                                },
                                `Updated ${selectedApprovalProvider} approval check "${item.label}".`
                              );
                              if (res.ok && res.data?.approvals) {
                                setProviderApprovals(res.data.approvals as ProviderApprovalMap);
                              }
                            }}
                            className="mt-0.5"
                          />
                          <span>
                            <strong className="block text-[#0F172A] dark:text-white">{item.label}</strong>
                            <span className="text-[10px] text-[#64748B]">{item.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                  <h3 className="font-bold text-[#0F172A] dark:text-white">
                    Recent Redacted External API Logs ({integrationCenter.recentLogs.length})
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">
                    All tokens, API keys, emails, and database URLs are scrubbed before logging.
                  </p>
                  {integrationCenter.recentLogs.length === 0 ? (
                    <p className="mt-2 text-[11px] text-[#64748B]">
                      No outbound external API calls recorded in this process (all paid providers disabled).
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1.5 font-mono text-[10px]">
                      {integrationCenter.recentLogs.slice(0, 10).map((log) => (
                        <div
                          key={log.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-[#263047] dark:bg-[#131C2E]"
                        >
                          <span>
                            [{log.providerId}] {log.operation} → <strong>{log.outcome}</strong> ({log.latencyMs}ms) — {log.redactedMessage}
                          </span>
                          <span className="text-[#64748B]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-[#64748B]">Integration Center telemetry unavailable.</p>
            )}
          </div>
        ) : null}

        {tab === 'communications' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                  Admin Communication &amp; Transactional Email Center (Stage 47)
                </h2>
                <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Durable PostgreSQL email lifecycle tracking across Resend. API keys, verification tokens, and private message bodies are strictly excluded from this view.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                    communicationOverview?.providerEnabled
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-[#34D399]'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  Resend: {communicationOverview?.providerEnabled ? 'Enabled' : 'Disabled By Flag'}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-700 dark:bg-[#192337] dark:text-slate-300">
                  From: {communicationOverview?.fromAddress ?? 'noreply@viewora.app'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7 text-xs tabular-nums">
              {(
                [
                  ['queued', 'Queued'],
                  ['accepted_by_provider', 'Accepted'],
                  ['delivered', 'Delivered'],
                  ['bounced', 'Bounced'],
                  ['failed', 'Failed'],
                  ['suppressed', 'Suppressed'],
                  ['disabled', 'Disabled'],
                ] as const
              ).map(([k, label]) => (
                <div
                  key={k}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <p className="text-[10px] font-semibold uppercase text-[#64748B]">{label}</p>
                  <p className="mt-1 font-display text-lg font-extrabold text-[#0F172A] dark:text-white">
                    {communicationOverview?.countsByStatus[k] ?? 0}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-[#0F172A] dark:text-white">
                  Multilingual Email Template Catalog ({EMAIL_TEMPLATE_CATALOG.length} Templates × 5 Locales)
                </h3>
                <span className="font-mono text-[10px] text-[#64748B]">
                  en · pt-BR · es · de · fr · HTML + Plain Text · Suppressed Addresses: {communicationOverview?.suppressedCount ?? 0}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {EMAIL_TEMPLATE_CATALOG.map((tpl) => (
                  <div
                    key={tpl.key}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#263047] dark:bg-[#131C2E]"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[11px] font-bold text-[#0F172A] dark:text-white">
                        {tpl.key}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          tpl.category === 'mandatory_security'
                            ? 'bg-violet-100 text-[#6941EF] dark:bg-violet-950 dark:text-[#A99AFF]'
                            : 'bg-slate-100 text-slate-600 dark:bg-[#0F172A] dark:text-slate-300'
                        }`}
                      >
                        {tpl.category === 'mandatory_security' ? 'Security' : 'Engagement'}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-[#64748B]">{tpl.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'providers' ? (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                Live Operational Status &amp; Provider Health
              </h2>
              <div className="mt-4 space-y-2.5">
                {providerHealth.map((p) => (
                  <div
                    key={p.providerId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                  >
                    <div>
                      <p className="font-semibold text-[#0F172A] dark:text-white">
                        {p.providerLabel}
                      </p>
                      <p className="mt-0.5 text-[#64748B] dark:text-[#94A3B8]">{p.message}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                        p.status === 'healthy'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-[#34D399]'
                          : 'bg-slate-200 text-slate-700 dark:bg-[#192337] dark:text-slate-300'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stage 29 & 40.8 Operational Telemetry: PostgreSQL Health, Backups, Job Queue & Storage */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <h3 className="font-bold text-[#0F172A] dark:text-white">
                  Live PostgreSQL Database Health
                </h3>
                {databaseHealth ? (
                  <p className="mt-2 font-mono text-[11px] text-[#64748B] dark:text-slate-300">
                    Engine: {databaseHealth.engine.toUpperCase()} · Status: {databaseHealth.status.toUpperCase()} ·
                    Reachable: {databaseHealth.reachable ? 'YES' : 'NO'} · Latency:{' '}
                    {databaseHealth.latencyMs !== null ? `${databaseHealth.latencyMs}ms` : 'N/A'}
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-[#64748B]">Health probe unavailable.</p>
                )}
                <p className="mt-1 text-[11px] text-[#64748B]">
                  RLS enforced on 23 policies under restricted runtime role; audit_logs append-only enforced by PostgreSQL trigger.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <h3 className="font-bold text-[#0F172A] dark:text-white">
                  Database Backup Archive Status (Read-Only)
                </h3>
                {backupSummary ? (
                  <p className="mt-2 font-mono text-[11px] text-[#64748B] dark:text-slate-300">
                    Snapshots: {backupSummary.backupCount} · Latest: {backupSummary.latestFileName ?? 'None'} ·
                    Size:{' '}
                    {backupSummary.latestSizeBytes !== null
                      ? `${(backupSummary.latestSizeBytes / 1024).toFixed(1)} KB`
                      : 'N/A'}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-[#64748B]">
                  {backupSummary?.latestModifiedAt
                    ? `Last snapshot recorded: ${new Date(backupSummary.latestModifiedAt).toLocaleString()}`
                    : 'Run npm run db:backup to capture a protected snapshot.'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <h3 className="font-bold text-[#0F172A] dark:text-white">
                  Background Job Queue Health (Recorded Runtime)
                </h3>
                {jobQueueSummary ? (
                  <p className="mt-2 font-mono text-[11px] text-[#64748B] dark:text-slate-300">
                    Total: {jobQueueSummary.total} · Queued: {jobQueueSummary.queued} · Running:{' '}
                    {jobQueueSummary.running} · Completed: {jobQueueSummary.completed} · Dead-letter:{' '}
                    {jobQueueSummary.deadLetter} · Cancelled: {jobQueueSummary.cancelled}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-[#64748B]">
                  Worker heartbeat: {jobQueueSummary?.lastHeartbeatAt ?? 'No jobs executed in this process yet'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
                <h3 className="font-bold text-[#0F172A] dark:text-white">
                  Isolated Customer File Storage Footprint
                </h3>
                {storageUsage ? (
                  <p className="mt-2 font-mono text-[11px] text-[#64748B] dark:text-slate-300">
                    Root: {storageUsage.storageRootLabel} · Files: {storageUsage.fileCount} · Bytes:{' '}
                    {(storageUsage.totalBytes / 1024).toFixed(1)} KB
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-[#64748B]">
                  Private customer research notes are strictly isolated and excluded from admin views.
                </p>
              </div>
            </div>

            {/* Affiliate & Partner Applications Review (Payouts Disabled) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-[#0F172A] dark:text-white">
                  Referral &amp; Partner Program Governance
                </h3>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Payouts Disabled
                </span>
              </div>
              {referralOverview ? (
                <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Active Codes: {referralOverview.codesCount} · Attributions:{' '}
                  {referralOverview.attributionsCount} · UTM Campaigns:{' '}
                  {referralOverview.campaignsCount} · Proposed Terms:{' '}
                  {referralOverview.proposedCommissionPercent}% /{' '}
                  {referralOverview.proposedCommissionMonths} mo (Inactive)
                </p>
              ) : null}

              {affiliateApps.length === 0 ? (
                <p className="mt-2 text-[11px] text-[#64748B]">
                  No partner applications submitted yet.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {affiliateApps.map((app) => (
                    <div
                      key={app.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-[#263047] dark:bg-[#131C2E]"
                    >
                      <div>
                        <p className="font-semibold text-[#0F172A] dark:text-white">
                          {app.organization} ({app.email})
                        </p>
                        <p className="text-[11px] text-[#64748B]">
                          {app.channelUrl} · Status: {app.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await runAction(
                              {
                                type: 'review_affiliate_application',
                                id: app.id,
                                status: 'approved_inactive_payouts',
                              },
                              `Approved partner ${app.organization} (payouts remain inactive).`
                            );
                            if (res.ok) {
                              setAffiliateApps((prev) =>
                                prev.map((x) =>
                                  x.id === app.id
                                    ? { ...x, status: 'approved_inactive_payouts' }
                                    : x
                                )
                              );
                            }
                          }}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          Approve (No Payouts)
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await runAction(
                              {
                                type: 'review_affiliate_application',
                                id: app.id,
                                status: 'declined',
                              },
                              `Declined partner application ${app.organization}.`
                            );
                            if (res.ok) {
                              setAffiliateApps((prev) =>
                                prev.map((x) =>
                                  x.id === app.id ? { ...x, status: 'declined' } : x
                                )
                              );
                            }
                          }}
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:border-rose-900/60 dark:text-rose-300"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {tab === 'searches' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                Search Analytics (Privacy-Safe Aggregated)
              </h2>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {searchAnalytics.some((s) => s.isSample)
                  ? 'Sample Baseline Data'
                  : 'Recorded Runtime Metrics'}
              </span>
            </div>
            <div className="space-y-2">
              {searchAnalytics.map((row) => (
                <div
                  key={row.normalizedUsername}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <span className="font-mono font-semibold">@{row.normalizedUsername}</span>
                  <span className="tabular-nums">{row.searches24h} searches</span>
                  <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] dark:bg-[#192337]">
                    {row.lastAvailability} · {row.dataClass}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === 'conversions' ? (
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                  Recorded Funnel Analytics
                </h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {conversionAnalytics.isSample ? 'Sample Baseline Data' : 'Recorded Runtime Metrics'}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
                  <p className="text-xs text-[#64748B]">Search → Signup Rate</p>
                  <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                    {conversionAnalytics.searchToSignupRate}%
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
                  <p className="text-xs text-[#64748B]">Signup → Upgrade Intent Rate</p>
                  <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                    {conversionAnalytics.signupToUpgradeIntentRate}%
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263047] dark:bg-[#0F172A]">
                  <p className="text-xs text-[#64748B]">Recorded Upgrade Intents</p>
                  <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">
                    {conversionAnalytics.counts.upgrade_intent}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ['onboarding_completed', 'Onboarding Done'],
                    ['first_saved_profile', 'First Saved Profile'],
                    ['first_project_created', 'First Research Project'],
                    ['first_report_created', 'First Report Draft'],
                  ] as const
                ).map(([key, label]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#263047] dark:bg-[#0F172A]"
                  >
                    <p className="text-[11px] text-[#64748B]">{label}</p>
                    <p className="mt-0.5 font-display text-lg font-extrabold tabular-nums text-[#0F172A] dark:text-white">
                      {conversionAnalytics.counts[key] ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                Active A/B Experiments
              </h3>
              <div className="mt-3 space-y-2">
                {experiments.map((exp) => (
                  <div
                    key={exp.key}
                    className="flex flex-wrap items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                  >
                    <div>
                      <p className="font-semibold text-[#0F172A] dark:text-white">{exp.name}</p>
                      <p className="font-mono text-[11px] text-[#64748B]">
                        {exp.key} · Variants: {exp.variants.join(' / ')} ({exp.weights.join('% / ')}
                        %)
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800 dark:bg-emerald-950 dark:text-[#34D399]">
                      {exp.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'audit' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                Immutable Audit Logs ({filteredAudits.length})
              </h2>
              <input
                type="search"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                aria-label="Filter audit logs"
                placeholder="Filter by action, actor, target…"
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:w-64 dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
              />
            </div>
            {filteredAudits.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-[#6941EF] dark:text-[#A99AFF]">
                    {log.action}
                  </span>
                  <span className="text-[11px] text-[#64748B]">
                    {log.actorEmail} · {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Target: {log.targetType} ({log.targetId}) · Diff: {JSON.stringify(log.diff)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={killSwitchConfirm !== null}
        destructive={Boolean(killSwitchConfirm?.nextActive)}
        busy={killSwitchBusy}
        title={
          killSwitchConfirm?.nextActive
            ? `Activate emergency halt for ${killSwitchConfirm.label}?`
            : `Clear emergency halt for ${killSwitchConfirm?.label ?? ''}?`
        }
        description={
          killSwitchConfirm?.nextActive
            ? 'This immediately persists the kill switch to PostgreSQL cost_budgets across all instances and blocks outbound requests for this scope.'
            : 'This clears the persisted emergency halt in PostgreSQL. Providers still remain gated by their explicit PROVIDER_*_ENABLED server flags.'
        }
        confirmLabel={killSwitchConfirm?.nextActive ? 'Confirm Emergency Halt' : 'Clear Halt'}
        onCancel={() => setKillSwitchConfirm(null)}
        onConfirm={async () => {
          if (!killSwitchConfirm) return;
          setKillSwitchBusy(true);
          const { scope, label, nextActive } = killSwitchConfirm;
          const res = await runAction(
            { type: 'toggle_api_kill_switch', scope, active: nextActive },
            `${nextActive ? 'Activated' : 'Cleared'} persisted kill switch for ${label}.`
          );
          if (res.ok) {
            if (scope === 'global') {
              setGlobalKillSwitch(nextActive);
            } else {
              setProviderKillSwitches((prev) => ({ ...prev, [scope]: nextActive }));
            }
          }
          setKillSwitchBusy(false);
          setKillSwitchConfirm(null);
        }}
      />
    </div>
  );
}
