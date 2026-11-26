import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db/prisma';
import { isDatabaseConfigured } from '@/lib/env';
import type { IntegrationProviderId } from './types';

export type BudgetAlertLevel = 'ok' | 'alert_50' | 'alert_75' | 'alert_90' | 'hard_limit_100';

export interface BudgetUtilizationStatus {
  scope: string;
  spentMicroUsd: number;
  capMicroUsd: number;
  spentUsd: number;
  capUsd: number;
  utilizationPercent: number;
  alertLevel: BudgetAlertLevel;
  blocked: boolean;
  costBasisDisclosure: 'estimated_not_confirmed_invoice';
}

export interface EmergencyHaltMetadataRecord {
  scope: string;
  active: boolean;
  reason: string;
  actorEmail: string;
  updatedAt: string;
}

export interface ProviderApprovalChecklistItem {
  key: string;
  label: string;
  description: string;
}

export const PROVIDER_ACTIVATION_CHECKLIST_ITEMS: readonly ProviderApprovalChecklistItem[] = [
  { key: 'owner_approval', label: 'Owner Approval', description: 'Explicit written owner approval obtained before enabling provider.' },
  { key: 'provider_account', label: 'Provider Account Configured', description: 'Official developer or commercial partner account verified.' },
  { key: 'credentials_present', label: 'Server Credentials Configured', description: 'Non-placeholder secrets stored strictly in server secret vault.' },
  { key: 'commercial_licensing', label: 'Commercial Licensing Approved', description: 'Redistribution, export, and AI-processing contract terms confirmed.' },
  { key: 'privacy_policy', label: 'Privacy Policy Compatibility', description: 'Public privacy notice and data disclosure aligned with provider scope.' },
  { key: 'retention_compatibility', label: 'Data Retention Compatibility', description: 'Cache TTL and snapshot retention windows respect vendor limits.' },
  { key: 'spending_limits', label: 'Spending Limits Configured', description: 'Daily/monthly USD caps and 50/75/90/100% alerts verified.' },
  { key: 'security_verification', label: 'Security Verification Complete', description: 'SSRF allowlist, bounded JSON, TLS, and token encryption tested.' },
  { key: 'capability_verification', label: 'Capability Verification', description: 'Provider capabilities mapped accurately without private-account access.' },
  { key: 'emergency_shutdown', label: 'Emergency Shutdown Available', description: 'Durable PostgreSQL global & per-provider halt controls verified.' },
] as const;

export interface AdminCustomerUsageSummary {
  backend: 'postgresql' | 'process_local';
  searches24h: number;
  aiReports30d: number;
  savedProfilesTotal: number;
  reportExports30d: number;
  privacyNotice: string;
}

/**
 * Fixed-precision integer micro-USD arithmetic (1 USD = 1,000,000 micro-USD)
 * avoiding IEEE-754 floating-point drift in financial cap enforcement.
 */
export function toMicroUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) return 0;
  return Math.round(usd * 1_000_000);
}

export function fromMicroUsd(microUsd: number): number {
  return Number((microUsd / 1_000_000).toFixed(6));
}

export function addMicroUsd(aMicro: number, bMicro: number): number {
  return Math.max(0, Math.round(aMicro) + Math.round(bMicro));
}

export function evaluateBudgetUtilization(
  scope: string,
  spentUsd: number,
  capUsd: number
): BudgetUtilizationStatus {
  const spentMicroUsd = toMicroUsd(spentUsd);
  const capMicroUsd = toMicroUsd(capUsd);
  const pct =
    capMicroUsd <= 0
      ? spentMicroUsd > 0
        ? 100
        : 0
      : Number(((spentMicroUsd / capMicroUsd) * 100).toFixed(1));

  let alertLevel: BudgetAlertLevel = 'ok';
  if (pct >= 100) alertLevel = 'hard_limit_100';
  else if (pct >= 90) alertLevel = 'alert_90';
  else if (pct >= 75) alertLevel = 'alert_75';
  else if (pct >= 50) alertLevel = 'alert_50';

  return {
    scope,
    spentMicroUsd,
    capMicroUsd,
    spentUsd: fromMicroUsd(spentMicroUsd),
    capUsd: fromMicroUsd(capMicroUsd),
    utilizationPercent: pct,
    alertLevel,
    blocked: capMicroUsd > 0 && spentMicroUsd >= capMicroUsd,
    costBasisDisclosure: 'estimated_not_confirmed_invoice',
  };
}

/**
 * Reconciles an earlier atomic spend reservation after an upstream request completes
 * or fails (e.g., settling actual cost vs. estimated cost, or refunding a failed call's
 * reserved estimate by writing a negative reconciliation adjustment in `operational_metrics`).
 */
export async function reconcileApiSpendReservation(params: {
  providerId: IntegrationProviderId;
  reservedUsd: number;
  actualUsd: number;
  outcome: 'settled' | 'failed_refunded' | 'expired_recovered';
  client?: PrismaClient;
}): Promise<{ deltaUsd: number; recorded: boolean }> {
  const deltaMicro = toMicroUsd(params.actualUsd) - toMicroUsd(params.reservedUsd);
  const deltaUsd = fromMicroUsd(deltaMicro);
  if (deltaMicro === 0 || (!isDatabaseConfigured() && !params.client)) {
    return { deltaUsd, recorded: false };
  }
  const db = params.client ?? getPrismaClient();
  await db.operationalMetric.create({
    data: {
      metricName: 'api_spend_usd',
      value: deltaUsd,
      unit: 'usd',
      labels: {
        providerId: params.providerId,
        reconciliation: params.outcome,
      } as unknown as Prisma.InputJsonValue,
    },
  });
  return { deltaUsd, recorded: true };
}

const HALT_META_KEY = 'api_emergency_halt_metadata_v1';
const APPROVAL_CHECKLIST_KEY = 'provider_activation_approvals_v1';

export async function recordEmergencyHaltMetadata(
  record: EmergencyHaltMetadataRecord,
  client?: PrismaClient
): Promise<EmergencyHaltMetadataRecord[]> {
  if (!isDatabaseConfigured() && !client) return [record];
  const db = client ?? getPrismaClient();
  const existing = await loadEmergencyHaltMetadata(db);
  const next = [record, ...existing.filter((r) => r.scope !== record.scope)].slice(0, 30);
  await db.systemSetting.upsert({
    where: { key: HALT_META_KEY },
    update: { value: { records: next } as unknown as Prisma.InputJsonValue },
    create: { key: HALT_META_KEY, value: { records: next } as unknown as Prisma.InputJsonValue },
  });
  return next;
}

export async function loadEmergencyHaltMetadata(
  client?: PrismaClient
): Promise<EmergencyHaltMetadataRecord[]> {
  if (!isDatabaseConfigured() && !client) return [];
  const db = client ?? getPrismaClient();
  const row = await db.systemSetting.findUnique({ where: { key: HALT_META_KEY } });
  const raw = row?.value as { records?: EmergencyHaltMetadataRecord[] } | null;
  return Array.isArray(raw?.records) ? raw!.records : [];
}

export type ProviderApprovalMap = Record<string, Record<string, boolean>>;

export async function loadProviderApprovalMap(client?: PrismaClient): Promise<ProviderApprovalMap> {
  if (!isDatabaseConfigured() && !client) return {};
  const db = client ?? getPrismaClient();
  const row = await db.systemSetting.findUnique({ where: { key: APPROVAL_CHECKLIST_KEY } });
  const raw = row?.value as { approvals?: ProviderApprovalMap } | null;
  return raw?.approvals && typeof raw.approvals === 'object' ? raw.approvals : {};
}

export async function updateProviderApprovalCheck(
  providerId: string,
  checkKey: string,
  approved: boolean,
  client?: PrismaClient
): Promise<ProviderApprovalMap> {
  if (!isDatabaseConfigured() && !client) {
    return { [providerId]: { [checkKey]: approved } };
  }
  const db = client ?? getPrismaClient();
  const current = await loadProviderApprovalMap(db);
  const next: ProviderApprovalMap = {
    ...current,
    [providerId]: {
      ...(current[providerId] ?? {}),
      [checkKey]: approved,
    },
  };
  await db.systemSetting.upsert({
    where: { key: APPROVAL_CHECKLIST_KEY },
    update: { value: { approvals: next } as unknown as Prisma.InputJsonValue },
    create: {
      key: APPROVAL_CHECKLIST_KEY,
      value: { approvals: next } as unknown as Prisma.InputJsonValue,
    },
  });
  return next;
}

/**
 * Privacy-safe aggregate customer usage administration summary (Stage 49.5).
 * Returns ONLY numeric counts across tables — NEVER exposes private customer research
 * notes or AI conversation contents.
 */
export async function loadAdminCustomerUsageSummary(
  client?: PrismaClient
): Promise<AdminCustomerUsageSummary> {
  const privacyNotice =
    'Aggregate usage counters only. Private customer research notes and AI conversation contents remain strictly inaccessible to administrators.';
  if (!isDatabaseConfigured() && !client) {
    return {
      backend: 'process_local',
      searches24h: 0,
      aiReports30d: 0,
      savedProfilesTotal: 0,
      reportExports30d: 0,
      privacyNotice,
    };
  }
  const db = client ?? getPrismaClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [searches24h, aiReports30d, savedProfilesTotal, reportExports30d] = await Promise.all([
    db.searchEvent.count({ where: { createdAt: { gte: since24h } } }),
    db.aiUsageRecord.count({ where: { createdAt: { gte: since30d } } }),
    db.savedProfile.count(),
    db.reportExport.count({ where: { createdAt: { gte: since30d } } }),
  ]);
  return {
    backend: 'postgresql',
    searches24h,
    aiReports30d,
    savedProfilesTotal,
    reportExports30d,
    privacyNotice,
  };
}
