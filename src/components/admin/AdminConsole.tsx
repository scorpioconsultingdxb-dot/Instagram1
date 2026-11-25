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
  Pencil,
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
  SupportTicketRecord,
} from '@/lib/admin/store';
import type { FunnelEventName } from '@/lib/analytics/funnel';
import type { ExperimentDefinition } from '@/lib/experiments/ab';
import { StatusBanner } from '@/components/layout/PageShell';

export type AdminTab =
  | 'users'
  | 'plans'
  | 'entitlements'
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
}

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
  apiUsage,
  searchAnalytics,
  conversionAnalytics,
  experiments,
  initialCms,
  initialTickets,
  initialBroadcasts,
  initialAuditLogs,
  initialFlags,
}: AdminConsoleProps) {
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [users, setUsers] = useState(initialUsers);
  const [userSearch, setUserSearch] = useState('');
  const [plans, setPlans] = useState(initialPlans);
  const [editingEnt, setEditingEnt] = useState<{
    planCode: PlanCode;
    featureKey: FeatureKey;
  } | null>(null);
  const [entDraftLimit, setEntDraftLimit] = useState('');
  const [entDraftUnlimited, setEntDraftUnlimited] = useState(false);
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
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null
  );

  const canManageRoles = actor.role === 'super_admin' || actor.role === 'admin';

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
          </div>
          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Signed in as {actor.email} · Least-privilege RBAC enforced server-side · All mutations
            persist across restarts and append to immutable Audit Logs.
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
                  Customer &amp; Administrative Permissions
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Plan updates sync immediately with customer entitlements. Only Admin / Super Admin
                  roles can reassign permissions.
                </p>
              </div>
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                aria-label="Filter users by email, name, plan, or role"
                placeholder="Filter by email, name, plan…"
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:w-64 dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[#64748B] dark:border-[#263047]">
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Segment</th>
                    <th className="py-2 pr-4">Membership Plan</th>
                    <th className="py-2">RBAC Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#263047]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 pr-4">
                        <span className="block font-semibold text-[#0F172A] dark:text-white">
                          {u.fullName}
                        </span>
                        <span className="font-mono text-[11px] text-[#64748B]">{u.email}</span>
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
                      <td className="py-3">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                      const isBooleanFeature = baselineRule?.numericLimit === null;
                      const isEditingThis =
                        editingEnt?.planCode === plan.code && editingEnt?.featureKey === key;

                      const saveEntitlementLimit = async () => {
                        let parsedLimit: number | null = null;
                        if (!entDraftUnlimited) {
                          const num = Number(entDraftLimit.trim());
                          if (!Number.isInteger(num) || num < 0 || num > 100_000) {
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
                                  onClick={() => void saveEntitlementLimit()}
                                  className="viewora-btn-primary flex-1 rounded-md px-2 py-1 text-[10px] font-semibold"
                                >
                                  Save
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

        {tab === 'providers' ? (
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
    </div>
  );
}
