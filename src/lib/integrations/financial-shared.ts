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

export type ProviderApprovalMap = Record<string, Record<string, boolean>>;

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
