import { INITIAL_PLANS } from '@/lib/entitlements/catalog';
import { calculatePublishedPlanQuote } from '@/lib/billing/lifecycle';
import type { BillingInterval, PlanCode } from '@/lib/entitlements/types';

export interface FinancialModelAssumptions {
  paidConversionRate: number; // e.g. 0.08 = 8% of registered users are paid
  paidTierMix: Record<Exclude<PlanCode, 'free'>, number>; // must sum to 1.0
  billingIntervalMix: Record<BillingInterval, number>; // must sum to 1.0
  socialApiCostPerActiveUserUsd: number;
  aiCostPerPaidUserUsd: number;
  emailCostPerRegisteredUserUsd: number;
  supportCostPerPaidUserUsd: number;
  paymentProcessingPercent: number; // e.g. 0.029
  paymentProcessingFixedUsd: number; // e.g. 0.30
  fixedMonthlyCostsUsd: {
    hosting: number;
    managedPostgres: number;
    redis: number;
    monitoring: number;
  };
}

export const DEFAULT_FINANCIAL_ASSUMPTIONS: FinancialModelAssumptions = {
  paidConversionRate: 0.08,
  paidTierMix: {
    starter: 0.45,
    premium: 0.30,
    pro: 0.18,
    agency: 0.07,
  },
  billingIntervalMix: {
    monthly: 0.50,
    quarterly: 0.20,
    annual: 0.30,
  },
  socialApiCostPerActiveUserUsd: 0.45,
  aiCostPerPaidUserUsd: 0.85,
  emailCostPerRegisteredUserUsd: 0.015,
  supportCostPerPaidUserUsd: 0.60,
  paymentProcessingPercent: 0.029,
  paymentProcessingFixedUsd: 0.30,
  fixedMonthlyCostsUsd: {
    hosting: 45,
    managedPostgres: 65,
    redis: 15,
    monitoring: 25,
  },
};

export interface ScenarioProjection {
  basis: 'planning_model_assumption_not_actuals';
  registeredCustomers: number;
  paidCustomers: number;
  freeCustomers: number;
  monthlyRecurringRevenueUsd: number;
  annualRunRateUsd: number;
  blendedPaidArpuUsd: number;
  revenueByIntervalUsd: Record<BillingInterval, number>;
  variableCostsUsd: {
    socialDataApi: number;
    aiTokens: number;
    transactionalEmail: number;
    paymentProcessing: number;
    customerSupport: number;
    totalVariable: number;
  };
  fixedCostsUsd: number;
  totalMonthlyCostUsd: number;
  grossProfitUsd: number;
  contributionMarginPercent: number;
  netMonthlyOperatingMarginUsd: number;
  breakEvenPaidCustomers: number;
  breakEvenRegisteredCustomers: number;
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Deterministic commercial profitability planner (Stage 55).
 * Strictly labeled as `planning_model_assumption_not_actuals` — NEVER represents
 * actual customers, invoices, or realized revenue.
 */
export function projectCommercialScenario(
  registeredCustomers: number,
  assumptions: FinancialModelAssumptions = DEFAULT_FINANCIAL_ASSUMPTIONS
): ScenarioProjection {
  const paidCustomers = Math.round(registeredCustomers * assumptions.paidConversionRate);
  const freeCustomers = Math.max(0, registeredCustomers - paidCustomers);

  const revenueByIntervalUsd: Record<BillingInterval, number> = {
    monthly: 0,
    quarterly: 0,
    annual: 0,
  };

  let mrr = 0;
  const paidTiers: Array<Exclude<PlanCode, 'free'>> = ['starter', 'premium', 'pro', 'agency'];
  const intervals: BillingInterval[] = ['monthly', 'quarterly', 'annual'];

  for (const tier of paidTiers) {
    const tierUsers = paidCustomers * assumptions.paidTierMix[tier];
    for (const interval of intervals) {
      const intervalUsers = tierUsers * assumptions.billingIntervalMix[interval];
      const quote = calculatePublishedPlanQuote(tier, interval, 0);
      const monthlyEquivUsd = (quote.effectiveMonthlyCents / 100) * intervalUsers;
      revenueByIntervalUsd[interval] += monthlyEquivUsd;
      mrr += monthlyEquivUsd;
    }
  }

  const blendedPaidArpuUsd = paidCustomers > 0 ? mrr / paidCustomers : 0;

  // Variable costs (scale with active/paid users)
  const activeFreeUsers = freeCustomers * 0.25;
  const socialDataApi = (paidCustomers + activeFreeUsers) * assumptions.socialApiCostPerActiveUserUsd;
  const aiTokens = paidCustomers * assumptions.aiCostPerPaidUserUsd;
  const transactionalEmail = registeredCustomers * assumptions.emailCostPerRegisteredUserUsd;
  const paymentProcessing =
    mrr * assumptions.paymentProcessingPercent + paidCustomers * assumptions.paymentProcessingFixedUsd;
  const customerSupport = paidCustomers * assumptions.supportCostPerPaidUserUsd;
  const totalVariable =
    socialDataApi + aiTokens + transactionalEmail + paymentProcessing + customerSupport;

  // Scale infrastructure tier modestly at 5,000+ registered users
  const infraScale = registeredCustomers >= 10000 ? 3.0 : registeredCustomers >= 5000 ? 2.0 : 1.0;
  const fixedCostsUsd =
    (assumptions.fixedMonthlyCostsUsd.hosting +
      assumptions.fixedMonthlyCostsUsd.managedPostgres +
      assumptions.fixedMonthlyCostsUsd.redis +
      assumptions.fixedMonthlyCostsUsd.monitoring) *
    infraScale;

  const totalMonthlyCostUsd = totalVariable + fixedCostsUsd;
  const grossProfitUsd = mrr - totalVariable;
  const contributionMarginPercent = mrr > 0 ? (grossProfitUsd / mrr) * 100 : 0;
  const netMonthlyOperatingMarginUsd = mrr - totalMonthlyCostUsd;

  const contributionPerPaidUser = paidCustomers > 0 ? grossProfitUsd / paidCustomers : 0;
  const breakEvenPaidCustomers =
    contributionPerPaidUser > 0 ? Math.ceil(fixedCostsUsd / contributionPerPaidUser) : 0;
  const breakEvenRegisteredCustomers =
    assumptions.paidConversionRate > 0
      ? Math.ceil(breakEvenPaidCustomers / assumptions.paidConversionRate)
      : 0;

  return {
    basis: 'planning_model_assumption_not_actuals',
    registeredCustomers,
    paidCustomers,
    freeCustomers,
    monthlyRecurringRevenueUsd: round2(mrr),
    annualRunRateUsd: round2(mrr * 12),
    blendedPaidArpuUsd: round2(blendedPaidArpuUsd),
    revenueByIntervalUsd: {
      monthly: round2(revenueByIntervalUsd.monthly),
      quarterly: round2(revenueByIntervalUsd.quarterly),
      annual: round2(revenueByIntervalUsd.annual),
    },
    variableCostsUsd: {
      socialDataApi: round2(socialDataApi),
      aiTokens: round2(aiTokens),
      transactionalEmail: round2(transactionalEmail),
      paymentProcessing: round2(paymentProcessing),
      customerSupport: round2(customerSupport),
      totalVariable: round2(totalVariable),
    },
    fixedCostsUsd: round2(fixedCostsUsd),
    totalMonthlyCostUsd: round2(totalMonthlyCostUsd),
    grossProfitUsd: round2(grossProfitUsd),
    contributionMarginPercent: round2(contributionMarginPercent),
    netMonthlyOperatingMarginUsd: round2(netMonthlyOperatingMarginUsd),
    breakEvenPaidCustomers,
    breakEvenRegisteredCustomers,
  };
}

export function evaluateTierUnitSustainability(): Array<{
  planCode: PlanCode;
  monthlyPriceUsd: number;
  annualEffectiveMonthlyUsd: number;
  aiMonthlyQuota: number;
  worstCaseAiCostUsd: number;
  sustainable: boolean;
}> {
  const estCostPerAiReportUsd = 0.005; // Gemini 2.5 Flash upper planning estimate
  return INITIAL_PLANS.map((p) => {
    const aiQuota = p.entitlements.ai_profile_reports.numericLimit ?? 0;
    const annualQuote = calculatePublishedPlanQuote(p.code, 'annual', 0);
    const worstCaseAiCostUsd = round2(aiQuota * estCostPerAiReportUsd);
    const annualEffectiveMonthlyUsd = round2(annualQuote.effectiveMonthlyCents / 100);
    return {
      planCode: p.code,
      monthlyPriceUsd: round2(p.monthlyPriceCents / 100),
      annualEffectiveMonthlyUsd,
      aiMonthlyQuota: aiQuota,
      worstCaseAiCostUsd,
      sustainable: p.code === 'free' ? aiQuota === 0 : worstCaseAiCostUsd < annualEffectiveMonthlyUsd * 0.25,
    };
  });
}
