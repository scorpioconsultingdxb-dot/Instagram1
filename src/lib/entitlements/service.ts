import { getPlanByCode, INITIAL_PLANS } from './catalog';
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import {
  loadDbPlans,
  loadDbUserOverrides,
  persistDbPlanEntitlement,
  persistDbPlanUpdate,
} from '@/lib/db/repositories/entitlements.repo';
import { readJsonStore, writeJsonStore } from '@/lib/storage/persistence';
import type {
  BillingInterval,
  EntitlementOverride,
  EntitlementRule,
  FeatureKey,
  PlanCode,
  PlanDefinition,
  ResolvedEntitlements,
} from './types';

const PLANS_STORE = 'plans-config.json';
const OVERRIDES_STORE = 'user-overrides.json';

function cloneInitialPlans(): PlanDefinition[] {
  return INITIAL_PLANS.map((plan) => ({
    ...plan,
    billingOptions: plan.billingOptions.map((o) => ({ ...o })),
    entitlements: Object.fromEntries(
      Object.entries(plan.entitlements).map(([k, v]) => [k, { ...v }])
    ) as PlanDefinition['entitlements'],
  }));
}

function loadPlans(): PlanDefinition[] {
  const stored = readJsonStore<PlanDefinition[]>(PLANS_STORE, () => cloneInitialPlans());
  if (!Array.isArray(stored) || stored.length !== INITIAL_PLANS.length) {
    return cloneInitialPlans();
  }
  return stored;
}

function savePlans(plans: PlanDefinition[]): void {
  writeJsonStore(PLANS_STORE, plans);
}

function loadOverrides(): Record<string, EntitlementOverride[]> {
  return readJsonStore<Record<string, EntitlementOverride[]>>(OVERRIDES_STORE, () => ({}));
}

function saveOverrides(overrides: Record<string, EntitlementOverride[]>): void {
  writeJsonStore(OVERRIDES_STORE, overrides);
}

export function getConfiguredPlans(): PlanDefinition[] {
  return loadPlans();
}

export function resetConfiguredPlansToDefaults(): PlanDefinition[] {
  const fresh = cloneInitialPlans();
  savePlans(fresh);
  return fresh;
}

export function updateConfiguredPlan(
  planCode: PlanCode,
  patch: Partial<Pick<PlanDefinition, 'monthlyPriceCents' | 'isActive' | 'description'>> & {
    quarterlyDiscount?: number;
    annualDiscount?: number;
  }
): PlanDefinition | null {
  const plans = loadPlans();
  const target = plans.find((p) => p.code === planCode);
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

  savePlans(plans);
  return target;
}

export function updatePlanEntitlement(
  planCode: PlanCode,
  featureKey: FeatureKey,
  enabled: boolean,
  numericLimit: number | null
): boolean {
  const plans = loadPlans();
  const target = plans.find((p) => p.code === planCode);
  if (!target) return false;
  target.entitlements[featureKey] = { enabled, numericLimit };
  savePlans(plans);
  return true;
}

export function setUserEntitlementOverride(
  userId: string,
  override: EntitlementOverride
): void {
  const all = loadOverrides();
  const existing = all[userId] ?? [];
  const filtered = existing.filter((o) => o.featureKey !== override.featureKey);
  filtered.push(override);
  all[userId] = filtered;
  saveOverrides(all);
}

export function getUserEntitlementOverrides(userId: string): EntitlementOverride[] {
  const all = loadOverrides();
  return all[userId] ?? [];
}

/**
 * Independent PostgreSQL (Prisma) plan loader with local dev fallback when unconfigured.
 */
export async function loadConfiguredPlans(): Promise<PlanDefinition[]> {
  if (isDatabaseConfigured()) {
    try {
      const plans = await loadDbPlans();
      if (plans.length > 0) return plans;
    } catch {
      // Fall back to static catalog for public pricing display if DB is temporarily unreachable
    }
  }
  return loadPlans();
}

export async function persistConfiguredPlan(
  planCode: PlanCode,
  patch: Partial<Pick<PlanDefinition, 'monthlyPriceCents' | 'isActive' | 'description'>> & {
    quarterlyDiscount?: number;
    annualDiscount?: number;
  }
): Promise<PlanDefinition | null> {
  if (isDatabaseConfigured()) {
    return persistDbPlanUpdate(planCode, patch);
  }
  if (!isLocalDevFallbackAllowed()) return null;
  return updateConfiguredPlan(planCode, patch);
}

export async function persistPlanEntitlement(
  planCode: PlanCode,
  featureKey: FeatureKey,
  enabled: boolean,
  numericLimit: number | null
): Promise<boolean> {
  if (isDatabaseConfigured()) {
    return persistDbPlanEntitlement(planCode, featureKey, enabled, numericLimit);
  }
  if (!isLocalDevFallbackAllowed()) return false;
  return updatePlanEntitlement(planCode, featureKey, enabled, numericLimit);
}

export async function loadUserEntitlementOverrides(userId: string): Promise<EntitlementOverride[]> {
  if (isDatabaseConfigured()) {
    try {
      return await loadDbUserOverrides(userId);
    } catch {
      return [];
    }
  }
  return getUserEntitlementOverrides(userId);
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
  const plans = params.plans ?? loadPlans();
  const plan = getPlanByCode(params.planCode, plans);
  const now = Date.now();

  const combinedOverrides = [
    ...(params.userId && !isDatabaseConfigured() ? getUserEntitlementOverrides(params.userId) : []),
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

export {
  assertEntitlement,
  EntitlementDeniedError,
  hasEntitlement,
} from './helpers';
