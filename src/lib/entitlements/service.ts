import { getPlanByCode, INITIAL_PLANS } from './catalog';
import type {
  BillingInterval,
  EntitlementOverride,
  EntitlementRule,
  FeatureKey,
  PlanCode,
  PlanDefinition,
  ResolvedEntitlements,
} from './types';

// In-memory configurable runtime store (synced/overridden by Admin Dashboard & Supabase)
const runtimePlans: PlanDefinition[] = INITIAL_PLANS.map((plan) => ({
  ...plan,
  billingOptions: plan.billingOptions.map((o) => ({ ...o })),
  entitlements: Object.fromEntries(
    Object.entries(plan.entitlements).map(([k, v]) => [k, { ...v }])
  ) as PlanDefinition['entitlements'],
}));

const runtimeUserOverrides = new Map<string, EntitlementOverride[]>();

export function getConfiguredPlans(): PlanDefinition[] {
  return runtimePlans;
}

export function updateConfiguredPlan(
  planCode: PlanCode,
  patch: Partial<Pick<PlanDefinition, 'monthlyPriceCents' | 'isActive' | 'description'>> & {
    quarterlyDiscount?: number;
    annualDiscount?: number;
  }
): PlanDefinition | null {
  const target = runtimePlans.find((p) => p.code === planCode);
  if (!target) return null;

  if (typeof patch.monthlyPriceCents === 'number' && patch.monthlyPriceCents >= 0) {
    target.monthlyPriceCents = Math.round(patch.monthlyPriceCents);
  }
  if (typeof patch.isActive === 'boolean') {
    target.isActive = patch.isActive;
  }
  if (typeof patch.description === 'string' && patch.description.trim()) {
    target.description = patch.description.trim();
  }
  if (typeof patch.quarterlyDiscount === 'number') {
    const q = target.billingOptions.find((o) => o.interval === 'quarterly');
    if (q) q.discountPercent = Math.max(0, Math.min(90, patch.quarterlyDiscount));
  }
  if (typeof patch.annualDiscount === 'number') {
    const a = target.billingOptions.find((o) => o.interval === 'annual');
    if (a) a.discountPercent = Math.max(0, Math.min(90, patch.annualDiscount));
  }

  return target;
}

export function updatePlanEntitlement(
  planCode: PlanCode,
  featureKey: FeatureKey,
  enabled: boolean,
  numericLimit: number | null
): boolean {
  const target = runtimePlans.find((p) => p.code === planCode);
  if (!target) return false;
  target.entitlements[featureKey] = { enabled, numericLimit };
  return true;
}

export function setUserEntitlementOverride(
  userId: string,
  override: EntitlementOverride
): void {
  const existing = runtimeUserOverrides.get(userId) ?? [];
  const filtered = existing.filter((o) => o.featureKey !== override.featureKey);
  filtered.push(override);
  runtimeUserOverrides.set(userId, filtered);
}

export function getUserEntitlementOverrides(userId: string): EntitlementOverride[] {
  return runtimeUserOverrides.get(userId) ?? [];
}

/**
 * Centralized entitlement resolver.
 * All feature gating across UI and API routes flows through this function.
 */
export function resolveEntitlements(params: {
  planCode: PlanCode;
  billingInterval?: BillingInterval;
  overrides?: EntitlementOverride[];
  userId?: string;
  disabledFeatureFlags?: FeatureKey[];
  plans?: PlanDefinition[];
}): ResolvedEntitlements {
  const plans = params.plans ?? runtimePlans;
  const plan = getPlanByCode(params.planCode, plans);
  const now = Date.now();

  const combinedOverrides = [
    ...(params.userId ? getUserEntitlementOverrides(params.userId) : []),
    ...(params.overrides ?? []),
  ];

  const rules = {} as Record<FeatureKey, EntitlementRule>;

  (Object.keys(plan.entitlements) as FeatureKey[]).forEach((key) => {
    const base = plan.entitlements[key];
    rules[key] = {
      featureKey: key,
      enabled: base.enabled,
      numericLimit: base.numericLimit,
      source: 'plan',
    };
  });

  // Apply non-expired overrides
  for (const override of combinedOverrides) {
    if (override.expiresAt && new Date(override.expiresAt).getTime() < now) {
      continue;
    }
    rules[override.featureKey] = {
      featureKey: override.featureKey,
      enabled: override.enabled,
      numericLimit: override.numericLimit,
      source: 'override',
    };
  }

  // Apply global kill-switches / feature flags
  for (const disabledKey of params.disabledFeatureFlags ?? []) {
    rules[disabledKey] = {
      featureKey: disabledKey,
      enabled: false,
      numericLimit: 0,
      source: 'feature_flag',
    };
  }

  return {
    planCode: plan.code,
    planName: plan.name,
    billingInterval: params.billingInterval ?? 'monthly',
    rules,
  };
}

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

export function assertEntitlement(
  resolved: ResolvedEntitlements,
  featureKey: FeatureKey,
  currentUsage?: number
): void {
  if (!hasEntitlement(resolved, featureKey, currentUsage)) {
    throw new EntitlementDeniedError(featureKey, resolved.planCode);
  }
}
