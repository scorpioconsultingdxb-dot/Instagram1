import { DEFAULT_BILLING_OPTIONS, getPlanByCode, INITIAL_PLANS } from './catalog';
import { isSupabaseConfigured } from '@/lib/env';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { readJsonStore, writeJsonStore } from '@/lib/storage/persistence';
import type {
  BillingInterval,
  BillingOptionConfig,
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

async function getSupabaseForEntitlements() {
  return createSupabaseAdminClient() ?? (await createSupabaseServerClient());
}

/**
 * Database-backed plan loader using Supabase Postgres (`plans`, `plan_billing_options`,
 * `plan_entitlements`) when configured, with automatic fallback to atomic local JSON.
 */
export async function loadConfiguredPlans(): Promise<PlanDefinition[]> {
  if (!isSupabaseConfigured()) {
    return loadPlans();
  }
  try {
    const supabase = await getSupabaseForEntitlements();
    if (!supabase) return loadPlans();

    const { data: planRows, error: planErr } = await supabase
      .from('plans')
      .select(
        'id, code, name, description, monthly_price_cents, currency, target_segment, display_order, is_active, is_demo_pricing'
      )
      .order('display_order', { ascending: true });

    if (planErr || !planRows || planRows.length === 0) {
      return loadPlans();
    }

    const [{ data: billingRows }, { data: entRows }] = await Promise.all([
      supabase
        .from('plan_billing_options')
        .select('plan_id, billing_interval, discount_percent, is_active'),
      supabase
        .from('plan_entitlements')
        .select('plan_id, feature_key, enabled, numeric_limit'),
    ]);

    const baseByCode = new Map(cloneInitialPlans().map((p) => [p.code, p]));
    const assembled: PlanDefinition[] = [];

    for (const row of planRows as Array<Record<string, unknown>>) {
      const code = row.code as PlanCode;
      const base = baseByCode.get(code);
      if (!base) continue;

      const planId = String(row.id);
      const rowBilling = (billingRows as Array<Record<string, unknown>> | null)?.filter(
        (b) => String(b.plan_id) === planId && b.is_active !== false
      );
      const billingOptions: BillingOptionConfig[] =
        rowBilling && rowBilling.length > 0
          ? (['monthly', 'quarterly', 'annual'] as BillingInterval[]).map((interval) => {
              const found = rowBilling.find((b) => b.billing_interval === interval);
              const def = DEFAULT_BILLING_OPTIONS.find((d) => d.interval === interval)!;
              return {
                interval,
                months: def.months,
                discountPercent:
                  found && typeof found.discount_percent === 'number'
                    ? Number(found.discount_percent)
                    : Number(found?.discount_percent ?? def.discountPercent),
              };
            })
          : base.billingOptions;

      const entitlements = { ...base.entitlements };
      const rowEnts = (entRows as Array<Record<string, unknown>> | null)?.filter(
        (e) => String(e.plan_id) === planId
      );
      if (rowEnts) {
        for (const e of rowEnts) {
          const fk = e.feature_key as FeatureKey;
          if (fk in entitlements) {
            entitlements[fk] = {
              enabled: Boolean(e.enabled),
              numericLimit:
                e.numeric_limit === null || e.numeric_limit === undefined
                  ? null
                  : Number(e.numeric_limit),
            };
          }
        }
      }

      assembled.push({
        ...base,
        name: String(row.name ?? base.name),
        description: String(row.description ?? base.description),
        monthlyPriceCents: Number(row.monthly_price_cents ?? base.monthlyPriceCents),
        currency: 'USD',
        targetSegment: (row.target_segment as PlanDefinition['targetSegment']) ?? base.targetSegment,
        displayOrder: Number(row.display_order ?? base.displayOrder),
        isActive: Boolean(row.is_active ?? base.isActive),
        isDemoPricing: Boolean(row.is_demo_pricing ?? base.isDemoPricing),
        billingOptions,
        entitlements,
      });
    }

    return assembled.length > 0 ? assembled : loadPlans();
  } catch {
    return loadPlans();
  }
}

export async function persistConfiguredPlan(
  planCode: PlanCode,
  patch: Partial<Pick<PlanDefinition, 'monthlyPriceCents' | 'isActive' | 'description'>> & {
    quarterlyDiscount?: number;
    annualDiscount?: number;
  }
): Promise<PlanDefinition | null> {
  if (!isSupabaseConfigured()) {
    return updateConfiguredPlan(planCode, patch);
  }
  const supabase = await getSupabaseForEntitlements();
  if (!supabase) return updateConfiguredPlan(planCode, patch);

  const { data: planRow, error: findErr } = await supabase
    .from('plans')
    .select('id')
    .eq('code', planCode)
    .maybeSingle();

  if (findErr || !planRow) {
    return null;
  }
  const planId = String(planRow.id);

  const planPatch: Record<string, unknown> = {};
  if (typeof patch.monthlyPriceCents === 'number' && patch.monthlyPriceCents >= 0) {
    planPatch.monthly_price_cents = Math.round(patch.monthlyPriceCents);
  }
  if (typeof patch.isActive === 'boolean') {
    planPatch.is_active = patch.isActive;
  }
  if (typeof patch.description === 'string' && patch.description.trim()) {
    planPatch.description = patch.description.trim();
  }

  if (Object.keys(planPatch).length > 0) {
    const { error } = await supabase.from('plans').update(planPatch).eq('id', planId);
    if (error) return null;
  }

  if (typeof patch.quarterlyDiscount === 'number') {
    const clamped = Math.max(0, Math.min(90, patch.quarterlyDiscount));
    const { error } = await supabase.from('plan_billing_options').upsert(
      {
        plan_id: planId,
        billing_interval: 'quarterly',
        discount_percent: clamped,
        is_active: true,
      },
      { onConflict: 'plan_id,billing_interval' }
    );
    if (error) return null;
  }

  if (typeof patch.annualDiscount === 'number') {
    const clamped = Math.max(0, Math.min(90, patch.annualDiscount));
    const { error } = await supabase.from('plan_billing_options').upsert(
      {
        plan_id: planId,
        billing_interval: 'annual',
        discount_percent: clamped,
        is_active: true,
      },
      { onConflict: 'plan_id,billing_interval' }
    );
    if (error) return null;
  }

  const freshPlans = await loadConfiguredPlans();
  return freshPlans.find((p) => p.code === planCode) ?? null;
}

export async function persistPlanEntitlement(
  planCode: PlanCode,
  featureKey: FeatureKey,
  enabled: boolean,
  numericLimit: number | null
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return updatePlanEntitlement(planCode, featureKey, enabled, numericLimit);
  }
  const supabase = await getSupabaseForEntitlements();
  if (!supabase) {
    return updatePlanEntitlement(planCode, featureKey, enabled, numericLimit);
  }

  const { data: planRow, error: findErr } = await supabase
    .from('plans')
    .select('id')
    .eq('code', planCode)
    .maybeSingle();

  if (findErr || !planRow) {
    return false;
  }

  const { error } = await supabase.from('plan_entitlements').upsert(
    {
      plan_id: String(planRow.id),
      feature_key: featureKey,
      enabled,
      numeric_limit: numericLimit,
    },
    { onConflict: 'plan_id,feature_key' }
  );

  return !error;
}

export async function loadUserEntitlementOverrides(userId: string): Promise<EntitlementOverride[]> {
  if (!isSupabaseConfigured()) {
    return getUserEntitlementOverrides(userId);
  }
  try {
    const supabase = await getSupabaseForEntitlements();
    if (!supabase) return getUserEntitlementOverrides(userId);

    const { data, error } = await supabase
      .from('user_entitlement_overrides')
      .select('feature_key, enabled, numeric_limit, reason, expires_at')
      .eq('user_id', userId);

    if (error || !data) return getUserEntitlementOverrides(userId);

    return (data as Array<Record<string, unknown>>).map((row) => ({
      featureKey: row.feature_key as FeatureKey,
      enabled: Boolean(row.enabled),
      numericLimit:
        row.numeric_limit === null || row.numeric_limit === undefined
          ? null
          : Number(row.numeric_limit),
      reason: (row.reason as string | null) ?? undefined,
      expiresAt: (row.expires_at as string | null) ?? null,
    }));
  } catch {
    return getUserEntitlementOverrides(userId);
  }
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

export {
  assertEntitlement,
  EntitlementDeniedError,
  hasEntitlement,
} from './helpers';
