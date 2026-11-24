import type {
  BillingInterval,
  BillingOptionConfig,
  FeatureKey,
  PlanCode,
  PlanDefinition,
} from './types';

/**
 * Authoritative Viewora plan & billing configuration (Section 22).
 * Single source of truth used by Public Pricing, Customer Dashboard,
 * Upgrade Previews, Centralized Entitlement Engine, Admin Dashboard,
 * and future Phase 7 Billing integration.
 */
export const DEFAULT_BILLING_OPTIONS: BillingOptionConfig[] = [
  { interval: 'monthly', months: 1, discountPercent: 0 },
  { interval: 'quarterly', months: 3, discountPercent: 15 },
  { interval: 'annual', months: 12, discountPercent: 30 },
];

export const FEATURE_LABELS: Record<FeatureKey, { label: string; unit?: string }> = {
  daily_searches: { label: 'Daily Public Profile Searches', unit: '/ day' },
  tracked_profiles: { label: 'Saved Eligible Profiles', unit: 'profiles' },
  historical_analytics_days: { label: 'Historical Lookback Window', unit: 'days' },
  follower_trends: { label: 'Public Follower-Count Trends', unit: 'days' },
  competitor_monitoring: { label: 'Competitor Comparisons', unit: 'sets' },
  ai_profile_reports: { label: 'Monthly AI Reports', unit: '/ mo' },
  influencer_research: { label: 'Influencer Research Lookups', unit: '/ mo' },
  email_notifications: { label: 'Email Notification Rules', unit: 'rules' },
  pdf_export: { label: 'PDF Report Exports' },
  csv_export: { label: 'CSV Data Exports' },
  team_seats: { label: 'Team Seats', unit: 'seats' },
  workspaces: { label: 'Multiple Workspaces', unit: 'workspaces' },
  agency_dashboard: { label: 'Agency Multi-Client Dashboard' },
};

export const INITIAL_PLANS: PlanDefinition[] = [
  {
    code: 'free',
    name: 'Free',
    description: 'Public profile search, 12 free analytics tools, and 1 saved eligible profile.',
    monthlyPriceCents: 0,
    currency: 'USD',
    targetSegment: 'personal',
    displayOrder: 1,
    isActive: true,
    isDemoPricing: true,
    billingOptions: DEFAULT_BILLING_OPTIONS,
    entitlements: {
      daily_searches: { enabled: true, numericLimit: 5 },
      tracked_profiles: { enabled: true, numericLimit: 1 },
      historical_analytics_days: { enabled: false, numericLimit: 0 },
      follower_trends: { enabled: false, numericLimit: 0 },
      competitor_monitoring: { enabled: false, numericLimit: 0 },
      ai_profile_reports: { enabled: false, numericLimit: 0 },
      influencer_research: { enabled: false, numericLimit: 0 },
      email_notifications: { enabled: false, numericLimit: 0 },
      pdf_export: { enabled: false, numericLimit: 0 },
      csv_export: { enabled: false, numericLimit: 0 },
      team_seats: { enabled: true, numericLimit: 1 },
      workspaces: { enabled: true, numericLimit: 1 },
      agency_dashboard: { enabled: false, numericLimit: 0 },
    },
  },
  {
    code: 'starter',
    name: 'Starter',
    description: '30-day historical lookback, daily refresh eligibility, and 3 monthly AI reports.',
    monthlyPriceCents: 999,
    currency: 'USD',
    targetSegment: 'personal',
    displayOrder: 2,
    isActive: true,
    isDemoPricing: true,
    billingOptions: DEFAULT_BILLING_OPTIONS,
    entitlements: {
      daily_searches: { enabled: true, numericLimit: 25 },
      tracked_profiles: { enabled: true, numericLimit: 1 },
      historical_analytics_days: { enabled: true, numericLimit: 30 },
      follower_trends: { enabled: true, numericLimit: 30 },
      competitor_monitoring: { enabled: false, numericLimit: 0 },
      ai_profile_reports: { enabled: true, numericLimit: 3 },
      influencer_research: { enabled: true, numericLimit: 10 },
      email_notifications: { enabled: true, numericLimit: 5 },
      pdf_export: { enabled: false, numericLimit: 0 },
      csv_export: { enabled: false, numericLimit: 0 },
      team_seats: { enabled: true, numericLimit: 1 },
      workspaces: { enabled: true, numericLimit: 1 },
      agency_dashboard: { enabled: false, numericLimit: 0 },
    },
  },
  {
    code: 'premium',
    name: 'Premium',
    description: '3 saved profiles, 90-day lookback, competitor comparisons, 15 AI reports, and PDF exports.',
    monthlyPriceCents: 1999,
    currency: 'USD',
    targetSegment: 'business',
    displayOrder: 3,
    isActive: true,
    isDemoPricing: true,
    highlighted: true,
    billingOptions: DEFAULT_BILLING_OPTIONS,
    entitlements: {
      daily_searches: { enabled: true, numericLimit: 100 },
      tracked_profiles: { enabled: true, numericLimit: 3 },
      historical_analytics_days: { enabled: true, numericLimit: 90 },
      follower_trends: { enabled: true, numericLimit: 90 },
      competitor_monitoring: { enabled: true, numericLimit: 5 },
      ai_profile_reports: { enabled: true, numericLimit: 15 },
      influencer_research: { enabled: true, numericLimit: 30 },
      email_notifications: { enabled: true, numericLimit: 20 },
      pdf_export: { enabled: true, numericLimit: null },
      csv_export: { enabled: false, numericLimit: 0 },
      team_seats: { enabled: true, numericLimit: 1 },
      workspaces: { enabled: true, numericLimit: 1 },
      agency_dashboard: { enabled: false, numericLimit: 0 },
    },
  },
  {
    code: 'pro',
    name: 'Pro',
    description: '10 saved profiles, 180-day history, 50 AI reports, PDF & CSV exports, and 3 team seats.',
    monthlyPriceCents: 3999,
    currency: 'USD',
    targetSegment: 'business',
    displayOrder: 4,
    isActive: true,
    isDemoPricing: true,
    billingOptions: DEFAULT_BILLING_OPTIONS,
    entitlements: {
      daily_searches: { enabled: true, numericLimit: 300 },
      tracked_profiles: { enabled: true, numericLimit: 10 },
      historical_analytics_days: { enabled: true, numericLimit: 180 },
      follower_trends: { enabled: true, numericLimit: 180 },
      competitor_monitoring: { enabled: true, numericLimit: 20 },
      ai_profile_reports: { enabled: true, numericLimit: 50 },
      influencer_research: { enabled: true, numericLimit: 100 },
      email_notifications: { enabled: true, numericLimit: 50 },
      pdf_export: { enabled: true, numericLimit: null },
      csv_export: { enabled: true, numericLimit: null },
      team_seats: { enabled: true, numericLimit: 3 },
      workspaces: { enabled: true, numericLimit: 1 },
      agency_dashboard: { enabled: false, numericLimit: 0 },
    },
  },
  {
    code: 'agency',
    name: 'Agency',
    description: '30 saved profiles, 365-day lookback, 150 AI reports, 15 team seats, and multiple client workspaces.',
    monthlyPriceCents: 9999,
    currency: 'USD',
    targetSegment: 'agency',
    displayOrder: 5,
    isActive: true,
    isDemoPricing: true,
    billingOptions: DEFAULT_BILLING_OPTIONS,
    entitlements: {
      daily_searches: { enabled: true, numericLimit: 1000 },
      tracked_profiles: { enabled: true, numericLimit: 30 },
      historical_analytics_days: { enabled: true, numericLimit: 365 },
      follower_trends: { enabled: true, numericLimit: 365 },
      competitor_monitoring: { enabled: true, numericLimit: 50 },
      ai_profile_reports: { enabled: true, numericLimit: 150 },
      influencer_research: { enabled: true, numericLimit: 500 },
      email_notifications: { enabled: true, numericLimit: null },
      pdf_export: { enabled: true, numericLimit: null },
      csv_export: { enabled: true, numericLimit: null },
      team_seats: { enabled: true, numericLimit: 15 },
      workspaces: { enabled: true, numericLimit: 25 },
      agency_dashboard: { enabled: true, numericLimit: null },
    },
  },
];

export interface CalculatedPrice {
  monthlyEquivalentCents: number;
  billedTotalCents: number;
  discountPercent: number;
  months: number;
  formattedMonthly: string;
  formattedTotal: string;
}

export function formatUsdCents(cents: number): string {
  if (cents === 0) return '$0';
  return `$${(cents / 100).toFixed(2)}`;
}

export function calculateIntervalPrice(
  plan: PlanDefinition,
  interval: BillingInterval
): CalculatedPrice {
  const option =
    plan.billingOptions.find((o) => o.interval === interval) ?? DEFAULT_BILLING_OPTIONS[0]!;
  const discountMultiplier = 1 - option.discountPercent / 100;
  const monthlyEquivalentCents = Math.round(plan.monthlyPriceCents * discountMultiplier);
  const billedTotalCents = monthlyEquivalentCents * option.months;

  return {
    monthlyEquivalentCents,
    billedTotalCents,
    discountPercent: option.discountPercent,
    months: option.months,
    formattedMonthly: formatUsdCents(monthlyEquivalentCents),
    formattedTotal: formatUsdCents(billedTotalCents),
  };
}

export function getPlanByCode(code: PlanCode, plans: PlanDefinition[] = INITIAL_PLANS): PlanDefinition {
  return plans.find((p) => p.code === code) ?? INITIAL_PLANS[0]!;
}
