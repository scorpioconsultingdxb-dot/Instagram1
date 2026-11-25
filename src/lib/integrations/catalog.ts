import { getEnv } from '@/lib/env';
import type { IntegrationProviderId, ProviderCatalogEntry, ProviderPolicyConfig } from './types';

export function buildDefaultPolicy(overrides: Partial<ProviderPolicyConfig> = {}): ProviderPolicyConfig {
  const env = getEnv();
  return {
    timeoutMs: overrides.timeoutMs ?? env.PROVIDER_TIMEOUT_MS,
    maxRetries: overrides.maxRetries ?? env.PROVIDER_MAX_RETRIES,
    retryBaseDelayMs: overrides.retryBaseDelayMs ?? 250,
    maxRequestsPerMinute: overrides.maxRequestsPerMinute ?? env.PROVIDER_RATE_LIMIT_PER_MIN,
    cacheTtlSeconds: overrides.cacheTtlSeconds ?? env.PROVIDER_CACHE_TTL_SECONDS,
    circuitFailureThreshold: overrides.circuitFailureThreshold ?? 3,
    circuitCooldownMs: overrides.circuitCooldownMs ?? 60_000,
    estimatedCostPerCallUsd: overrides.estimatedCostPerCallUsd ?? 0,
  };
}

export function getProviderCatalog(): ProviderCatalogEntry[] {
  return [
    {
      id: 'meta_official',
      name: 'Official Meta Instagram Graph API (Business Discovery)',
      category: 'social_data',
      description:
        'Official Meta Graph API Business Discovery endpoint for public Instagram Business and Creator accounts only.',
      flagEnvVar: 'PROVIDER_META_ENABLED',
      requiredEnvVars: ['META_GRAPH_API_ACCESS_TOKEN', 'META_INSTAGRAM_BUSINESS_ACCOUNT_ID'],
      optionalEnvVars: ['META_API_VERSION', 'META_APP_ID', 'META_APP_SECRET'],
      capabilities: {
        publicProfiles: true,
        recentPublicPosts: true,
        authorizedOwnStories: false,
        historicalSnapshots: false,
        aiSummaries: false,
        emailDelivery: false,
        supportsPrivateAccounts: false,
        requiresInstagramCredentials: false,
        commercialLicenseRequired: false,
      },
      defaultPolicy: buildDefaultPolicy({
        timeoutMs: 8000,
        maxRetries: 2,
        maxRequestsPerMinute: 30,
        cacheTtlSeconds: 600,
        estimatedCostPerCallUsd: 0,
      }),
      commercialModel: 'Official Meta Platform Terms ($0 API fee; Meta App Review & Business Verification required)',
      complianceNotes:
        'Public Business/Creator profiles only. Personal/private profiles and third-party Stories are intentionally excluded by Meta.',
      approvalRequiredBeforeActivation: true,
    },
    {
      id: 'authorized_insights',
      name: 'Authorized Connected-Account Insights (Meta OAuth)',
      category: 'social_data',
      description:
        'First-party Instagram Business/Creator OAuth insights and account-owner Stories authorized directly by the account owner.',
      flagEnvVar: 'PROVIDER_AUTHORIZED_INSIGHTS_ENABLED',
      requiredEnvVars: ['META_APP_ID', 'META_APP_SECRET', 'META_OAUTH_REDIRECT_URI'],
      optionalEnvVars: ['META_WEBHOOK_VERIFY_TOKEN'],
      capabilities: {
        publicProfiles: false,
        recentPublicPosts: true,
        authorizedOwnStories: true,
        historicalSnapshots: true,
        aiSummaries: false,
        emailDelivery: false,
        supportsPrivateAccounts: false,
        requiresInstagramCredentials: false,
        commercialLicenseRequired: false,
      },
      defaultPolicy: buildDefaultPolicy({
        timeoutMs: 8000,
        maxRetries: 2,
        maxRequestsPerMinute: 40,
        cacheTtlSeconds: 300,
        estimatedCostPerCallUsd: 0,
      }),
      commercialModel: 'Official Meta OAuth ($0 API fee; requires approved instagram_basic & instagram_manage_insights scopes)',
      complianceNotes:
        'Strictly first-party account-owner data. OAuth tokens encrypted at rest in Phase 5; never collects Instagram passwords.',
      approvalRequiredBeforeActivation: true,
    },
    {
      id: 'licensed_third_party',
      name: 'Licensed Commercial Social Intelligence Partner',
      category: 'social_data',
      description:
        'Pluggable adapter for a vetted commercial data partner whose written SLA explicitly authorizes SaaS display, caching, and PDF/CSV export.',
      flagEnvVar: 'PROVIDER_LICENSED_THIRD_PARTY_ENABLED',
      requiredEnvVars: ['LICENSED_PROVIDER_API_URL', 'LICENSED_DATA_PROVIDER_API_KEY'],
      optionalEnvVars: ['LICENSED_PROVIDER_NAME'],
      capabilities: {
        publicProfiles: true,
        recentPublicPosts: true,
        authorizedOwnStories: false,
        historicalSnapshots: true,
        aiSummaries: false,
        emailDelivery: false,
        supportsPrivateAccounts: false,
        requiresInstagramCredentials: false,
        commercialLicenseRequired: true,
      },
      defaultPolicy: buildDefaultPolicy({
        timeoutMs: 10_000,
        maxRetries: 2,
        maxRequestsPerMinute: 20,
        cacheTtlSeconds: 3600,
        estimatedCostPerCallUsd: 0.01,
      }),
      commercialModel: 'Paid Commercial Data License (per-lookup or tiered monthly SLA; requires signed vendor contract)',
      complianceNotes:
        'Prohibited to activate without written commercial redistribution, caching, and export rights. Private accounts blocked.',
      approvalRequiredBeforeActivation: true,
    },
    {
      id: 'permitted_public_dataset',
      name: 'Permitted Public Benchmark Dataset',
      category: 'social_data',
      description:
        'Read-only adapter for explicitly permitted open/opt-in creator benchmark directories.',
      flagEnvVar: 'PROVIDER_PUBLIC_DATASET_ENABLED',
      requiredEnvVars: ['PUBLIC_DATASET_ENDPOINT_URL'],
      optionalEnvVars: [],
      capabilities: {
        publicProfiles: true,
        recentPublicPosts: false,
        authorizedOwnStories: false,
        historicalSnapshots: false,
        aiSummaries: false,
        emailDelivery: false,
        supportsPrivateAccounts: false,
        requiresInstagramCredentials: false,
        commercialLicenseRequired: false,
      },
      defaultPolicy: buildDefaultPolicy({
        timeoutMs: 6000,
        maxRetries: 1,
        maxRequestsPerMinute: 60,
        cacheTtlSeconds: 7200,
        estimatedCostPerCallUsd: 0,
      }),
      commercialModel: 'Open / Opt-in Dataset ($0; subject to dataset attribution license)',
      complianceNotes: 'Static archived public metadata only; labeled CACHED with explicit dataset provenance.',
      approvalRequiredBeforeActivation: true,
    },
    {
      id: 'gemini_ai',
      name: 'Google Gemini AI Analytical Engine',
      category: 'ai_analytics',
      description:
        'Structured JSON analytical summaries over already-retrieved workspace metrics with prompt-injection envelopes and hard USD caps.',
      flagEnvVar: 'PROVIDER_GEMINI_ENABLED',
      requiredEnvVars: ['GEMINI_API_KEY'],
      optionalEnvVars: ['GEMINI_MODEL', 'AI_DAILY_BUDGET_USD', 'AI_MONTHLY_BUDGET_USD'],
      capabilities: {
        publicProfiles: false,
        recentPublicPosts: false,
        authorizedOwnStories: false,
        historicalSnapshots: false,
        aiSummaries: true,
        emailDelivery: false,
        supportsPrivateAccounts: false,
        requiresInstagramCredentials: false,
        commercialLicenseRequired: false,
      },
      defaultPolicy: buildDefaultPolicy({
        timeoutMs: 12_000,
        maxRetries: 1,
        maxRequestsPerMinute: 20,
        cacheTtlSeconds: 1800,
        estimatedCostPerCallUsd: 0.002,
      }),
      commercialModel: 'Pay-as-you-go token billing (capped by AI_DAILY_BUDGET_USD & AI_MONTHLY_BUDGET_USD)',
      complianceNotes:
        'Falls back transparently to deterministic Template-Generated reports when disabled or capped; never fabricates missing metrics.',
      approvalRequiredBeforeActivation: true,
    },
    {
      id: 'resend_email',
      name: 'Resend Transactional Email Delivery',
      category: 'transactional_email',
      description:
        'Transactional verification emails, password resets, and opt-in weekly workspace digests.',
      flagEnvVar: 'PROVIDER_RESEND_ENABLED',
      requiredEnvVars: ['RESEND_API_KEY', 'EMAIL_FROM_ADDRESS'],
      optionalEnvVars: ['EMAIL_REPLY_TO', 'EMAIL_NOTIFICATIONS_ENABLED'],
      capabilities: {
        publicProfiles: false,
        recentPublicPosts: false,
        authorizedOwnStories: false,
        historicalSnapshots: false,
        aiSummaries: false,
        emailDelivery: true,
        supportsPrivateAccounts: false,
        requiresInstagramCredentials: false,
        commercialLicenseRequired: false,
      },
      defaultPolicy: buildDefaultPolicy({
        timeoutMs: 8000,
        maxRetries: 2,
        maxRequestsPerMinute: 30,
        cacheTtlSeconds: 0,
        estimatedCostPerCallUsd: 0.001,
      }),
      commercialModel: 'Tiered SaaS email volume (SPF/DKIM/DMARC domain verification required)',
      complianceNotes: 'Disabled until owner configures verified sending domain and approves outbound email delivery.',
      approvalRequiredBeforeActivation: true,
    },
    {
      id: 'demo_fixture',
      name: 'Viewora Internal Demo Fixtures',
      category: 'internal_demo',
      description:
        'Deterministic internal preview dataset (4 labeled demo profiles + 1 private refusal sample) for UI preview and automated testing.',
      flagEnvVar: 'VIEWORA_ENABLE_DEMO_PROVIDER',
      requiredEnvVars: [],
      optionalEnvVars: ['VIEWORA_ENABLE_DEMO_PROVIDER'],
      capabilities: {
        publicProfiles: true,
        recentPublicPosts: true,
        authorizedOwnStories: false,
        historicalSnapshots: true,
        aiSummaries: false,
        emailDelivery: false,
        supportsPrivateAccounts: false,
        requiresInstagramCredentials: false,
        commercialLicenseRequired: false,
      },
      defaultPolicy: buildDefaultPolicy({
        timeoutMs: 1000,
        maxRetries: 0,
        maxRequestsPerMinute: 300,
        cacheTtlSeconds: 0,
        estimatedCostPerCallUsd: 0,
      }),
      commercialModel: 'Internal ($0 — strictly labeled DEMO, never labeled LIVE or CACHED)',
      complianceNotes: 'Always displays explicit DEMO provenance badge; never used for authentication or fabricated live outputs.',
      approvalRequiredBeforeActivation: false,
    },
  ];
}

export function getCatalogEntry(id: IntegrationProviderId): ProviderCatalogEntry {
  const found = getProviderCatalog().find((c) => c.id === id);
  if (!found) {
    throw new Error(`Unknown integration provider: ${id}`);
  }
  return found;
}
