import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db/prisma';
import { DEFAULT_BILLING_OPTIONS, INITIAL_PLANS } from '@/lib/entitlements/catalog';
import type {
  BillingInterval,
  BillingOptionConfig,
  EntitlementOverride,
  FeatureKey,
  PlanCode,
  PlanDefinition,
} from '@/lib/entitlements/types';

function cloneInitialPlans(): PlanDefinition[] {
  return INITIAL_PLANS.map((plan) => ({
    ...plan,
    billingOptions: plan.billingOptions.map((o) => ({ ...o })),
    entitlements: Object.fromEntries(
      Object.entries(plan.entitlements).map(([k, v]) => [k, { ...v }])
    ) as PlanDefinition['entitlements'],
  }));
}

export async function loadDbPlans(
  client: PrismaClient = getPrismaClient()
): Promise<PlanDefinition[]> {
  const rows = await client.plan.findMany({
    orderBy: { displayOrder: 'asc' },
    include: {
      billingOptions: { where: { isActive: true } },
      entitlements: true,
    },
  });

  if (rows.length === 0) return [];

  const baseByCode = new Map(cloneInitialPlans().map((p) => [p.code, p]));
  const assembled: PlanDefinition[] = [];

  for (const row of rows) {
    const code = row.code as PlanCode;
    const base = baseByCode.get(code);
    if (!base) continue;

    const billingOptions: BillingOptionConfig[] =
      row.billingOptions.length > 0
        ? (['monthly', 'quarterly', 'annual'] as BillingInterval[]).map((interval) => {
            const found = row.billingOptions.find((b) => b.billingInterval === interval);
            const def = DEFAULT_BILLING_OPTIONS.find((d) => d.interval === interval)!;
            return {
              interval,
              months: def.months,
              discountPercent: found ? Number(found.discountPercent) : def.discountPercent,
            };
          })
        : base.billingOptions;

    const entitlements = { ...base.entitlements };
    for (const e of row.entitlements) {
      const fk = e.featureKey as FeatureKey;
      if (fk in entitlements) {
        entitlements[fk] = {
          enabled: Boolean(e.enabled),
          numericLimit: e.numericLimit === null ? null : Number(e.numericLimit),
        };
      }
    }

    assembled.push({
      ...base,
      name: row.name,
      description: row.description,
      monthlyPriceCents: row.monthlyPriceCents,
      currency: 'USD',
      targetSegment: row.targetSegment as PlanDefinition['targetSegment'],
      displayOrder: row.displayOrder,
      isActive: row.isActive,
      isDemoPricing: row.isDemoPricing,
      billingOptions,
      entitlements,
    });
  }

  return assembled;
}

export async function persistDbPlanUpdate(
  planCode: PlanCode,
  patch: Partial<Pick<PlanDefinition, 'monthlyPriceCents' | 'isActive' | 'description'>> & {
    quarterlyDiscount?: number;
    annualDiscount?: number;
  },
  client: PrismaClient = getPrismaClient()
): Promise<PlanDefinition | null> {
  const plan = await client.plan.findUnique({ where: { code: planCode } });
  if (!plan) return null;

  await client.$transaction(async (tx) => {
    const planUpdate: {
      monthlyPriceCents?: number;
      isActive?: boolean;
      description?: string;
    } = {};

    if (typeof patch.monthlyPriceCents === 'number' && patch.monthlyPriceCents >= 0) {
      planUpdate.monthlyPriceCents = Math.round(patch.monthlyPriceCents);
    }
    if (typeof patch.isActive === 'boolean') {
      planUpdate.isActive = patch.isActive;
    }
    if (typeof patch.description === 'string' && patch.description.trim()) {
      planUpdate.description = patch.description.trim();
    }

    if (Object.keys(planUpdate).length > 0) {
      await tx.plan.update({
        where: { id: plan.id },
        data: planUpdate,
      });
    }

    if (typeof patch.quarterlyDiscount === 'number') {
      const clamped = Math.max(0, Math.min(90, patch.quarterlyDiscount));
      await tx.planBillingOption.upsert({
        where: { planId_billingInterval: { planId: plan.id, billingInterval: 'quarterly' } },
        update: { discountPercent: clamped, isActive: true },
        create: { planId: plan.id, billingInterval: 'quarterly', discountPercent: clamped, isActive: true },
      });
    }

    if (typeof patch.annualDiscount === 'number') {
      const clamped = Math.max(0, Math.min(90, patch.annualDiscount));
      await tx.planBillingOption.upsert({
        where: { planId_billingInterval: { planId: plan.id, billingInterval: 'annual' } },
        update: { discountPercent: clamped, isActive: true },
        create: { planId: plan.id, billingInterval: 'annual', discountPercent: clamped, isActive: true },
      });
    }
  });

  const fresh = await loadDbPlans(client);
  return fresh.find((p) => p.code === planCode) ?? null;
}

export async function persistDbPlanEntitlement(
  planCode: PlanCode,
  featureKey: FeatureKey,
  enabled: boolean,
  numericLimit: number | null,
  client: PrismaClient = getPrismaClient()
): Promise<boolean> {
  const plan = await client.plan.findUnique({ where: { code: planCode } });
  if (!plan) return false;

  await client.planEntitlement.upsert({
    where: { planId_featureKey: { planId: plan.id, featureKey } },
    update: { enabled, numericLimit },
    create: { planId: plan.id, featureKey, enabled, numericLimit },
  });
  return true;
}

export async function loadDbUserOverrides(
  userId: string,
  client: PrismaClient = getPrismaClient()
): Promise<EntitlementOverride[]> {
  const rows = await client.userEntitlementOverride.findMany({
    where: { userId },
  });
  return rows.map((row) => ({
    featureKey: row.featureKey as FeatureKey,
    enabled: row.enabled,
    numericLimit: row.numericLimit === null ? null : Number(row.numericLimit),
    reason: row.reason ?? undefined,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  }));
}
