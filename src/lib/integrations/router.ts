import type { PlanCode } from '@/lib/entitlements/types';
import { getProviderCatalog } from './catalog';
import { checkProviderCredentials } from './credentials';
import { defaultApiGateway } from './gateway';
import type { IntegrationProviderId, ProviderCapabilities } from './types';

export type RequiredCapabilityKey = keyof Pick<
  ProviderCapabilities,
  'publicProfiles' | 'recentPublicPosts' | 'authorizedOwnStories' | 'historicalSnapshots' | 'aiSummaries' | 'emailDelivery'
>;

export interface ProviderCommercialRights {
  saasRedistributionAllowed: boolean;
  customerDisplayAllowed: boolean;
  cachingAllowed: boolean;
  maxRetentionHours: number;
  exportAllowed: boolean;
  aiProcessingAllowed: boolean;
  requiresSignedVendorContract: boolean;
  geographicRestrictions: string;
}

export const COMMERCIAL_RIGHTS_BY_PROVIDER: Record<IntegrationProviderId, ProviderCommercialRights> = {
  meta_official: {
    saasRedistributionAllowed: true,
    customerDisplayAllowed: true,
    cachingAllowed: true,
    maxRetentionHours: 24,
    exportAllowed: true,
    aiProcessingAllowed: true,
    requiresSignedVendorContract: false,
    geographicRestrictions: 'Subject to Meta Platform Terms & EU/UK/BR data transfer clauses',
  },
  authorized_insights: {
    saasRedistributionAllowed: false, // First-party owner workspace ONLY
    customerDisplayAllowed: true,
    cachingAllowed: true,
    maxRetentionHours: 24,
    exportAllowed: true,
    aiProcessingAllowed: true,
    requiresSignedVendorContract: false,
    geographicRestrictions: 'First-party account owner only; deletion required on OAuth revoke',
  },
  licensed_third_party: {
    saasRedistributionAllowed: true, // Strictly contingent on signed vendor agreement
    customerDisplayAllowed: true,
    cachingAllowed: true,
    maxRetentionHours: 720,
    exportAllowed: true,
    aiProcessingAllowed: false, // Disabled until vendor license explicitly approves AI processing
    requiresSignedVendorContract: true,
    geographicRestrictions: 'Per signed commercial vendor contract',
  },
  permitted_public_dataset: {
    saasRedistributionAllowed: true,
    customerDisplayAllowed: true,
    cachingAllowed: true,
    maxRetentionHours: 720,
    exportAllowed: true,
    aiProcessingAllowed: true,
    requiresSignedVendorContract: false,
    geographicRestrictions: 'Per open dataset license attribution terms',
  },
  gemini_ai: {
    saasRedistributionAllowed: true,
    customerDisplayAllowed: true,
    cachingAllowed: true,
    maxRetentionHours: 24,
    exportAllowed: true,
    aiProcessingAllowed: true,
    requiresSignedVendorContract: false,
    geographicRestrictions: 'Subject to Google AI / Gemini API supported regions',
  },
  resend_email: {
    saasRedistributionAllowed: false,
    customerDisplayAllowed: false,
    cachingAllowed: false,
    maxRetentionHours: 0,
    exportAllowed: false,
    aiProcessingAllowed: false,
    requiresSignedVendorContract: false,
    geographicRestrictions: 'Transactional email delivery only',
  },
  demo_fixture: {
    saasRedistributionAllowed: false,
    customerDisplayAllowed: true,
    cachingAllowed: false,
    maxRetentionHours: 0,
    exportAllowed: true,
    aiProcessingAllowed: false,
    requiresSignedVendorContract: false,
    geographicRestrictions: 'Internal preview & automated QA only (explicitly labeled DEMO)',
  },
};

export interface ProviderRoutingContext {
  requiredCapability: RequiredCapabilityKey;
  planCode: PlanCode;
  hasAuthorizedAccountToken?: boolean;
  requireExportRights?: boolean;
  requireAiProcessingRights?: boolean;
  allowDemoFallback?: boolean;
  remainingCustomerQuota?: number | null;
  remainingDailyBudgetUsd?: number;
  killSwitchedProviders?: Set<IntegrationProviderId>;
}

export interface ProviderRoutingCandidate {
  providerId: IntegrationProviderId;
  eligible: boolean;
  priority: number;
  reason: string;
}

const ROUTING_PRIORITY: Record<IntegrationProviderId, number> = {
  authorized_insights: 1,
  meta_official: 2,
  licensed_third_party: 3,
  permitted_public_dataset: 4,
  gemini_ai: 5,
  resend_email: 6,
  demo_fixture: 99,
};

/**
 * Capability-based deterministic provider router (Stage 42).
 * Evaluates every registered adapter against authorization, capabilities, membership,
 * commercial licensing rights, health/circuit state, customer quota, and budget.
 * NEVER silently selects disabled, unauthorized, or unapproved sources.
 */
export function evaluateProviderRouting(ctx: ProviderRoutingContext): ProviderRoutingCandidate[] {
  const catalog = getProviderCatalog();
  const candidates: ProviderRoutingCandidate[] = [];

  for (const entry of catalog) {
    const priority = ROUTING_PRIORITY[entry.id] ?? 50;
    const rights = COMMERCIAL_RIGHTS_BY_PROVIDER[entry.id];

    if (!entry.capabilities[ctx.requiredCapability]) {
      candidates.push({
        providerId: entry.id,
        eligible: false,
        priority,
        reason: `Lacks required capability "${ctx.requiredCapability}".`,
      });
      continue;
    }

    if (entry.id === 'demo_fixture' && !ctx.allowDemoFallback) {
      candidates.push({
        providerId: entry.id,
        eligible: false,
        priority,
        reason: 'Demo fallback explicitly disabled for this request.',
      });
      continue;
    }

    if (ctx.killSwitchedProviders?.has(entry.id)) {
      candidates.push({
        providerId: entry.id,
        eligible: false,
        priority,
        reason: 'Provider emergency kill switch is active.',
      });
      continue;
    }

    const cred = checkProviderCredentials(entry.id);
    if (!cred.effectivelyEnabled) {
      candidates.push({
        providerId: entry.id,
        eligible: false,
        priority,
        reason: !cred.flagEnabled
          ? `Disabled by feature flag (${cred.flagEnvVar}=false).`
          : `Missing server credentials (${cred.missingEnvVars.join(', ')}).`,
      });
      continue;
    }

    if (entry.id === 'authorized_insights' && !ctx.hasAuthorizedAccountToken) {
      candidates.push({
        providerId: entry.id,
        eligible: false,
        priority,
        reason: 'Requires an active connected Instagram OAuth account owned by the caller.',
      });
      continue;
    }

    if (entry.id === 'licensed_third_party' && ctx.planCode === 'free') {
      candidates.push({
        providerId: entry.id,
        eligible: false,
        priority,
        reason: 'Paid licensed data provider lookups require Starter or higher membership tier.',
      });
      continue;
    }

    if (ctx.requireExportRights && !rights.exportAllowed) {
      candidates.push({
        providerId: entry.id,
        eligible: false,
        priority,
        reason: 'Provider commercial license does not permit customer exports.',
      });
      continue;
    }

    if (ctx.requireAiProcessingRights && !rights.aiProcessingAllowed) {
      candidates.push({
        providerId: entry.id,
        eligible: false,
        priority,
        reason: 'Provider commercial license does not permit AI downstream processing.',
      });
      continue;
    }

    if (ctx.remainingCustomerQuota !== undefined && ctx.remainingCustomerQuota !== null && ctx.remainingCustomerQuota <= 0) {
      candidates.push({
        providerId: entry.id,
        eligible: false,
        priority,
        reason: 'Customer membership quota exhausted.',
      });
      continue;
    }

    if (
      ctx.remainingDailyBudgetUsd !== undefined &&
      entry.defaultPolicy.estimatedCostPerCallUsd > ctx.remainingDailyBudgetUsd
    ) {
      candidates.push({
        providerId: entry.id,
        eligible: false,
        priority,
        reason: 'Remaining daily API budget insufficient for estimated call cost.',
      });
      continue;
    }

    if (defaultApiGateway.getCircuitState(entry.id) === 'open') {
      candidates.push({
        providerId: entry.id,
        eligible: false,
        priority,
        reason: 'Provider circuit breaker is OPEN.',
      });
      continue;
    }

    candidates.push({
      providerId: entry.id,
      eligible: true,
      priority,
      reason: 'Eligible (authorized, capable, healthy, and within quota/budget).',
    });
  }

  return candidates.sort((a, b) => a.priority - b.priority);
}

/**
 * Builds tenant-scoped cache keys so authorized first-party data can NEVER bleed across
 * users or workspaces. Public shared lookups still isolate by provider & capability scope.
 */
export function buildTenantScopedCacheKey(params: {
  providerId: IntegrationProviderId;
  operation: string;
  subject: string;
  authorizationScope: 'public' | 'authorized_owner';
  workspaceId?: string | null;
  userId?: string | null;
}): string {
  const cleanSubject = params.subject.trim().toLowerCase();
  if (params.authorizationScope === 'authorized_owner') {
    const ownerTag = `${params.userId ?? 'anon'}:${params.workspaceId ?? 'default'}`;
    return `${params.providerId}:auth:${ownerTag}:${params.operation}:${cleanSubject}`;
  }
  return `${params.providerId}:public:${params.operation}:${cleanSubject}`;
}
