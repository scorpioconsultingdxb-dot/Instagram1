import type { FeatureKey, PlanCode, ResolvedEntitlements } from './types';

export function hasEntitlement(
  resolved: ResolvedEntitlements,
  featureKey: FeatureKey,
  currentUsage?: number
): boolean {
  const rule = resolved.rules[featureKey];
  if (!rule || !rule.enabled) return false;
  if (typeof currentUsage === 'number' && rule.numericLimit !== null) {
    return currentUsage < rule.numericLimit;
  }
  return true;
}

export class EntitlementDeniedError extends Error {
  readonly featureKey: FeatureKey;
  readonly planCode: PlanCode;

  constructor(featureKey: FeatureKey, planCode: PlanCode) {
    super(`Feature "${featureKey}" is not enabled on your current "${planCode}" plan.`);
    this.name = 'EntitlementDeniedError';
    this.featureKey = featureKey;
    this.planCode = planCode;
  }
}

export function formatQuotaLimit(rule: {
  enabled: boolean;
  numericLimit: number | null;
}): string {
  if (!rule.enabled) return '0';
  return rule.numericLimit === null ? '∞' : String(rule.numericLimit);
}

export function assertEntitlement(
  resolved: ResolvedEntitlements,
  featureKey: FeatureKey,
  currentUsage?: number
): void {
  if (!hasEntitlement(resolved, featureKey, currentUsage)) {
    throw new EntitlementDeniedError(featureKey, resolved.planCode);
  }
}
