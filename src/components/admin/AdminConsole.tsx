'use client';

import {
  Activity,
  BarChart2,
  ClipboardList,
  CreditCard,
  FileText,
  Flag,
  HeartPulse,
  LifeBuoy,
  Lock,
  Search,
  Shield,
  Sliders,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import type { SessionUser } from '@/lib/auth/session';
import type { FeatureKey, PlanCode, PlanDefinition } from '@/lib/entitlements/types';
import { FEATURE_LABELS, formatUsdCents } from '@/lib/entitlements/catalog';
import type { ProviderHealth } from '@/lib/providers/types';
import type {
  ApiUsageMetric,
  AuditLogRecord,
  CmsContentRecord,
  FeatureFlagRecord,
  SearchAnalyticsMetric,
  SupportTicketRecord,
} from '@/lib/admin/store';
import type { FunnelEventName } from '@/lib/analytics/funnel';
import type { ExperimentDefinition } from '@/lib/experiments/ab';

type AdminTab =
  | 'users'
  | 'plans'
  | 'entitlements'
  | 'usage'
  | 'providers'
  | 'searches'
  | 'conversions'
  | 'cms'
  | 'support'
  | 'audit'
  | 'flags';

export interface AdminConsoleProps {
  actor: SessionUser;
  initialUsers: SessionUser[];
  initialPlans: PlanDefinition[];
  providerHealth: ProviderHealth[];
  apiUsage: ApiUsageMetric[];
  searchAnalytics: SearchAnalyticsMetric[];
  conversionAnalytics: {
    counts: Record<FunnelEventName, number>;
    searchToSignupRate: number;
    signupToUpgradeIntentRate: number;
  };
  experiments: ExperimentDefinition[];
  initialCms: CmsContentRecord[];
  initialTickets: SupportTicketRecord[];
  initialAuditLogs: AuditLogRecord[];
  initialFlags: FeatureFlagRecord[];
}

export function AdminConsole({
  actor,
  initialUsers,
  initialPlans,
  providerHealth,
  apiUsage,
  searchAnalytics,
  conversionAnalytics,
  experiments,
  initialCms,
  initialTickets,
  initialAuditLogs,
  initialFlags,
}: AdminConsoleProps) {
  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState(initialUsers);
  const [plans, setPlans] = useState(initialPlans);
  const [cmsItems, setCmsItems] = useState(initialCms);
  const [tickets, setTickets] = useState(initialTickets);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [flags, setFlags] = useState(initialFlags);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const runAction = async (payload: Record<string, unknown>, successMsg: string) => {
    setStatusMessage(null);
    const res = await fetch('/api/admin/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as {
      ok: boolean;
      error?: string;
      audit?: AuditLogRecord;
    };
    if (!json.ok) {
      setStatusMessage(json.error ?? 'Admin action failed.');
      return false;
    }
    if (json.audit) {
      setAuditLogs((prev) => [json.audit!, ...prev]);
    }
    setStatusMessage(successMsg);
    return true;
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: typeof Users }> = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'plans', label: 'Plans', icon: CreditCard },
    { id: 'entitlements', label: 'Entitlements', icon: Sliders },
    { id: 'usage', label: 'API Usage', icon: Activity },
    { id: 'providers', label: 'Provider Health', icon: HeartPulse },
    { id: 'searches', label: 'Search Analytics', icon: Search },
    { id: 'conversions', label: 'Conversions & A/B', icon: BarChart2 },
    { id: 'cms', label: 'CMS Content', icon: FileText },
    { id: 'support', label: 'Support', icon: LifeBuoy },
    { id: 'audit', label: 'Audit Logs', icon: ClipboardList },
    { id: 'flags', label: 'Feature Flags', icon: Flag },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Viewora Admin Control Plane
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {actor.role}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Signed in as {actor.email} · Server-side RBAC enforced on every endpoint · All mutations
            recorded in Audit Logs.
          </p>
        </div>
      </div>

      {statusMessage ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-medium text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200"
        >
          {statusMessage}
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
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {tab === 'users' ? (
          <div className="overflow-x-auto">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">User Management</h2>
            <table className="mt-4 w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Segment</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 pr-4">
                      <span className="block font-semibold text-slate-900 dark:text-white">
                        {u.fullName}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">{u.email}</span>
                    </td>
                    <td className="py-3 pr-4 capitalize">{u.segment}</td>
                    <td className="py-3 pr-4">
                      <select
                        aria-label={`Plan for ${u.email}`}
                        value={u.planCode}
                        onChange={async (e) => {
                          const planCode = e.target.value as PlanCode;
                          const ok = await runAction(
                            { type: 'update_user', userId: u.id, planCode },
                            `Updated plan for ${u.email} to ${planCode}.`
                          );
                          if (ok) {
                            setUsers((prev) =>
                              prev.map((x) => (x.id === u.id ? { ...x, planCode } : x))
                            );
                          }
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
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
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] dark:bg-slate-800">
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'plans' ? (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Subscription Plan Configuration (Demo Pricing Only)
            </h2>
            <div className="grid gap-4 md:grid-cols-5">
              {plans.map((p) => {
                const q = p.billingOptions.find((o) => o.interval === 'quarterly')?.discountPercent ?? 10;
                const a = p.billingOptions.find((o) => o.interval === 'annual')?.discountPercent ?? 20;
                return (
                  <div
                    key={p.code}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                    <p className="mt-1 text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                      {formatUsdCents(p.monthlyPriceCents)}/mo
                    </p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Quarterly: {q}% off · Annual: {a}% off
                    </p>
                    {p.code !== 'free' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const nextAnnual = a === 20 ? 25 : 20;
                          const ok = await runAction(
                            { type: 'update_plan', planCode: p.code, annualDiscount: nextAnnual },
                            `Updated ${p.name} annual discount to ${nextAnnual}%.`
                          );
                          if (ok) {
                            setPlans((prev) =>
                              prev.map((item) =>
                                item.code === p.code
                                  ? {
                                      ...item,
                                      billingOptions: item.billingOptions.map((o) =>
                                        o.interval === 'annual'
                                          ? { ...o, discountPercent: nextAnnual }
                                          : o
                                      ),
                                    }
                                  : item
                              )
                            );
                          }
                        }}
                        className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
                      >
                        Toggle Annual Discount ({a}% ↔ {a === 20 ? 25 : 20}%)
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {tab === 'entitlements' ? (
          <div className="overflow-x-auto">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Centralized Entitlement Management
            </h2>
            <table className="mt-4 w-full min-w-[680px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                  <th className="py-2 pr-4">Feature Key</th>
                  {plans.map((p) => (
                    <th key={p.code} className="py-2 text-center">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((key) => (
                  <tr key={key}>
                    <td className="py-2.5 pr-4 font-mono text-[11px]">{key}</td>
                    {plans.map((plan) => {
                      const rule = plan.entitlements[key];
                      return (
                        <td key={plan.code} className="py-2.5 text-center">
                          <button
                            type="button"
                            onClick={async () => {
                              const nextEnabled = !rule.enabled;
                              const nextLimit = nextEnabled ? rule.numericLimit ?? 10 : 0;
                              const ok = await runAction(
                                {
                                  type: 'update_entitlement',
                                  planCode: plan.code,
                                  featureKey: key,
                                  enabled: nextEnabled,
                                  numericLimit: nextLimit,
                                },
                                `${nextEnabled ? 'Enabled' : 'Disabled'} ${key} on ${plan.name}.`
                              );
                              if (ok) {
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
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                              rule.enabled
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {rule.enabled ? (rule.numericLimit ?? '∞') : 'Off'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'usage' ? (
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              API Usage Monitoring (Last 24h)
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {apiUsage.map((m) => (
                <div
                  key={m.providerId}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950"
                >
                  <p className="font-mono font-semibold text-slate-900 dark:text-white">
                    {m.providerId}
                  </p>
                  <p className="mt-2 text-2xl font-extrabold">{m.requests24h}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Err: {m.errorRatePercent}% · Avg: {m.avgLatencyMs}ms
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === 'providers' ? (
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Data-Provider Health Status
            </h2>
            <div className="mt-4 space-y-2.5">
              {providerHealth.map((p) => (
                <div
                  key={p.providerId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {p.providerLabel}
                    </p>
                    <p className="mt-0.5 text-slate-500">{p.message}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                      p.status === 'healthy'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
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
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Search Analytics (Aggregated / Privacy-Safe)
            </h2>
            <div className="mt-4 space-y-2">
              {searchAnalytics.map((row) => (
                <div
                  key={row.normalizedUsername}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-950"
                >
                  <span className="font-mono font-semibold">@{row.normalizedUsername}</span>
                  <span>{row.searches24h} searches / 24h</span>
                  <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] dark:bg-slate-800">
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
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Conversion Funnel Analytics
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs text-slate-500">Search → Signup Rate</p>
                  <p className="mt-1 text-2xl font-extrabold">
                    {conversionAnalytics.searchToSignupRate}%
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs text-slate-500">Signup → Upgrade Intent Rate</p>
                  <p className="mt-1 text-2xl font-extrabold">
                    {conversionAnalytics.signupToUpgradeIntentRate}%
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs text-slate-500">Total Upgrade Intents (Demo)</p>
                  <p className="mt-1 text-2xl font-extrabold">
                    {conversionAnalytics.counts.upgrade_intent}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Active A/B Experiments
              </h3>
              <div className="mt-3 space-y-2">
                {experiments.map((exp) => (
                  <div
                    key={exp.key}
                    className="flex flex-wrap items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{exp.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {exp.key} · Variants: {exp.variants.join(' / ')} ({exp.weights.join('% / ')}
                        %)
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {exp.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'cms' ? (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Content Management (Localized Disclosures &amp; Guides)
            </h2>
            {cmsItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {item.title} ({item.locale})
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      const nextPub = !item.isPublished;
                      const ok = await runAction(
                        { type: 'update_cms', id: item.id, isPublished: nextPub },
                        `${nextPub ? 'Published' : 'Unpublished'} "${item.title}".`
                      );
                      if (ok) {
                        setCmsItems((prev) =>
                          prev.map((c) => (c.id === item.id ? { ...c, isPublished: nextPub } : c))
                        );
                      }
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold dark:border-slate-700 dark:bg-slate-900"
                  >
                    {item.isPublished ? 'Published' : 'Draft'}
                  </button>
                </div>
                <p className="mt-1.5 text-slate-600 dark:text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'support' ? (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Customer Support Requests
            </h2>
            {tickets.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{t.subject}</p>
                    <p className="font-mono text-[11px] text-slate-500">
                      {t.id} · {t.email}
                    </p>
                  </div>
                  <select
                    aria-label={`Status for ${t.id}`}
                    value={t.status}
                    onChange={async (e) => {
                      const status = e.target.value as SupportTicketRecord['status'];
                      const ok = await runAction(
                        { type: 'update_ticket', id: t.id, status },
                        `Updated support ticket ${t.id} to ${status}.`
                      );
                      if (ok) {
                        setTickets((prev) =>
                          prev.map((item) => (item.id === t.id ? { ...item, status } : item))
                        );
                      }
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <p className="mt-2 text-slate-600 dark:text-slate-300">{t.message}</p>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'audit' ? (
          <div className="space-y-2.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Immutable Audit Logs ({auditLogs.length})
            </h2>
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-300">
                    {log.action}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {log.actorEmail} · {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  Target: {log.targetType} ({log.targetId}) · Diff: {JSON.stringify(log.diff)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'flags' ? (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Feature Flags</h2>
            {flags.map((f) => (
              <div
                key={f.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {f.key}
                    </span>
                    {f.locked ? (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        LOCKED
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">{f.description}</p>
                </div>
                <button
                  type="button"
                  disabled={f.locked}
                  onClick={async () => {
                    const nextEnabled = !f.enabled;
                    const ok = await runAction(
                      { type: 'toggle_flag', key: f.key, enabled: nextEnabled },
                      `Set flag ${f.key} to ${nextEnabled ? 'enabled' : 'disabled'}.`
                    );
                    if (ok) {
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
                      : 'border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  {f.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
