export type IntegrationProviderId =
  | 'meta_official'
  | 'authorized_insights'
  | 'licensed_third_party'
  | 'permitted_public_dataset'
  | 'gemini_ai'
  | 'resend_email'
  | 'demo_fixture';

export type IntegrationCategory =
  | 'social_data'
  | 'ai_analytics'
  | 'transactional_email'
  | 'internal_demo';

export type ProviderEffectiveState =
  | 'disabled_by_flag'
  | 'unconfigured'
  | 'enabled_ready'
  | 'active_demo'
  | 'circuit_open';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface ProviderCapabilities {
  publicProfiles: boolean;
  recentPublicPosts: boolean;
  authorizedOwnStories: boolean;
  historicalSnapshots: boolean;
  aiSummaries: boolean;
  emailDelivery: boolean;
  /** Permanent policy invariants: always false across every provider */
  supportsPrivateAccounts: false;
  requiresInstagramCredentials: false;
  commercialLicenseRequired: boolean;
}

export interface ProviderPolicyConfig {
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  maxRequestsPerMinute: number;
  cacheTtlSeconds: number;
  circuitFailureThreshold: number;
  circuitCooldownMs: number;
  estimatedCostPerCallUsd: number;
}

export interface ProviderCatalogEntry {
  id: IntegrationProviderId;
  name: string;
  category: IntegrationCategory;
  description: string;
  flagEnvVar: string;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  capabilities: ProviderCapabilities;
  defaultPolicy: ProviderPolicyConfig;
  commercialModel: string;
  complianceNotes: string;
  approvalRequiredBeforeActivation: boolean;
}

/**
 * Strictly non-secret readiness snapshot safe to display in Super Admin Integration Center.
 * NEVER includes raw tokens, API keys, passwords, or connection strings.
 */
export interface ProviderIntegrationStatus {
  id: IntegrationProviderId;
  name: string;
  category: IntegrationCategory;
  description: string;
  flagEnvVar: string;
  flagEnabled: boolean;
  credentialsConfigured: boolean;
  requiredEnvVars: string[];
  missingEnvVars: string[];
  effectiveState: ProviderEffectiveState;
  circuitState: CircuitState;
  capabilities: ProviderCapabilities;
  policy: ProviderPolicyConfig;
  commercialModel: string;
  complianceNotes: string;
  approvalRequiredBeforeActivation: boolean;
  usage: ProviderRuntimeUsage;
}

export interface ProviderRuntimeUsage {
  totalCalls: number;
  cacheHits: number;
  successes: number;
  errors: number;
  rateLimited: number;
  circuitBlocked: number;
  disabledRejections: number;
  avgLatencyMs: number;
  estimatedCostUsd: number;
  lastCalledAt: string | null;
}

export type ApiLogOutcome =
  | 'success'
  | 'cache_hit'
  | 'rate_limited'
  | 'circuit_open'
  | 'timeout'
  | 'http_error'
  | 'disabled'
  | 'validation_error'
  | 'budget_exceeded';

export interface SanitizedApiLogEntry {
  id: string;
  timestamp: string;
  providerId: IntegrationProviderId;
  operation: string;
  outcome: ApiLogOutcome;
  httpStatus: number | null;
  latencyMs: number;
  attempts: number;
  estimatedCostUsd: number;
  redactedMessage: string;
}

export interface ApiCostControlSummary {
  dailySpentUsd: number;
  monthlySpentUsd: number;
  dailyCapUsd: number;
  monthlyCapUsd: number;
  globalKillSwitchActive: boolean;
  perProviderKillSwitches: Record<IntegrationProviderId, boolean>;
  paidProvidersActiveCount: number;
}

export interface IntegrationCenterSnapshot {
  generatedAt: string;
  allPaidProvidersDisabled: boolean;
  paymentsEnabled: false;
  supabasePresent: false;
  providers: ProviderIntegrationStatus[];
  costControl: ApiCostControlSummary;
  recentLogs: SanitizedApiLogEntry[];
}
