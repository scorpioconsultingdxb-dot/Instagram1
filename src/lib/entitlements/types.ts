export type PlanCode = 'free' | 'starter' | 'premium' | 'pro' | 'agency';

export type BillingInterval = 'monthly' | 'quarterly' | 'annual';

export type CustomerSegment = 'personal' | 'business' | 'agency';

export type UserRole =
  | 'customer'
  | 'user'
  | 'analyst'
  | 'content_manager'
  | 'support_agent'
  | 'operations_admin'
  | 'admin'
  | 'super_admin';

export type FeatureKey =
  | 'daily_searches'
  | 'tracked_profiles'
  | 'historical_analytics_days'
  | 'follower_trends'
  | 'competitor_monitoring'
  | 'ai_profile_reports'
  | 'influencer_research'
  | 'email_notifications'
  | 'csv_export'
  | 'pdf_export'
  | 'workspaces'
  | 'team_seats'
  | 'agency_dashboard';

export interface EntitlementRule {
  featureKey: FeatureKey;
  enabled: boolean;
  numericLimit: number | null; // null = unlimited when enabled === true
  source: 'plan' | 'override' | 'feature_flag';
}

export interface BillingOptionConfig {
  interval: BillingInterval;
  months: 1 | 3 | 12;
  discountPercent: number;
}

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  description: string;
  monthlyPriceCents: number;
  currency: 'USD';
  targetSegment: CustomerSegment;
  displayOrder: number;
  isActive: boolean;
  isDemoPricing: boolean;
  highlighted?: boolean;
  billingOptions: BillingOptionConfig[];
  entitlements: Record<FeatureKey, { enabled: boolean; numericLimit: number | null }>;
}

export interface EntitlementOverride {
  featureKey: FeatureKey;
  enabled: boolean;
  numericLimit: number | null;
  reason?: string;
  expiresAt?: string | null;
}

export interface ResolvedEntitlements {
  planCode: PlanCode;
  planName: string;
  billingInterval: BillingInterval;
  rules: Record<FeatureKey, EntitlementRule>;
}
