import { COMMERCIAL_RIGHTS_BY_PROVIDER } from '@/lib/integrations/router';
import type { IntegrationProviderId } from '@/lib/integrations/types';
import type { ProviderResponse, PublicProfileData } from '@/lib/providers/types';
import type { HistoricalTrendAnalysis } from '@/lib/db/repositories/snapshots.repo';
import type { CompetitorBenchmarkAnalysis } from '@/lib/analytics/competitor-benchmark';
import type { AiCapabilityResult } from '@/lib/ai/studio';

export interface AcceptanceCheckResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ProviderAcceptanceReport {
  providerId: IntegrationProviderId;
  verificationMode: 'fixture_contract_test' | 'live_provider_verified';
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  checks: AcceptanceCheckResult[];
  evaluatedAt: string;
  honestyDisclosure: string;
}

/**
 * Evaluates Stage 53 Data Quality & Provider Acceptance criteria against an observed
 * provider response, historical trend, competitor benchmark, and AI output.
 * STRICTLY separates `fixture_contract_test` from `live_provider_verified` so fixture
 * tests can NEVER be misrepresented as live external provider verification.
 */
export function runProviderAcceptanceSuite(params: {
  providerId: IntegrationProviderId;
  verificationMode: 'fixture_contract_test' | 'live_provider_verified';
  profileResponse: ProviderResponse<PublicProfileData>;
  historicalTrend?: HistoricalTrendAnalysis | null;
  competitorBenchmark?: CompetitorBenchmarkAnalysis | null;
  aiResult?: AiCapabilityResult | null;
}): ProviderAcceptanceReport {
  const checks: AcceptanceCheckResult[] = [];
  const { profileResponse, providerId } = params;
  const rights = COMMERCIAL_RIGHTS_BY_PROVIDER[providerId];

  // 1. Source attribution visible
  checks.push({
    id: 'source_attribution_visible',
    label: 'Source attribution & dataClass present',
    passed: Boolean(profileResponse.meta.providerLabel && profileResponse.meta.dataClass),
    detail: `providerLabel="${profileResponse.meta.providerLabel}", dataClass="${profileResponse.meta.dataClass}"`,
  });

  // 2. Collection timestamp visible
  const validTs = Boolean(
    profileResponse.meta.freshness?.fetchedAt &&
      Number.isFinite(Date.parse(profileResponse.meta.freshness.fetchedAt))
  );
  checks.push({
    id: 'collection_date_visible',
    label: 'Valid ISO-8601 collection timestamp present',
    passed: validTs,
    detail: `fetchedAt="${profileResponse.meta.freshness?.fetchedAt ?? 'missing'}"`,
  });

  // 3. Private account refusal invariant
  const privateSafe =
    profileResponse.meta.availability !== 'private_account' || profileResponse.data === null;
  checks.push({
    id: 'private_account_blocked',
    label: 'Private account data strictly excluded',
    passed: privateSafe && profileResponse.data?.isPrivate !== true,
    detail: `availability="${profileResponse.meta.availability}", isPrivate=${String(profileResponse.data?.isPrivate ?? false)}`,
  });

  // 4. Missing metrics preserved as null (not fabricated or coerced to 0 when unavailable)
  const missingSafe =
    profileResponse.meta.availability !== 'unavailable' || profileResponse.data === null;
  checks.push({
    id: 'missing_metrics_unavailable',
    label: 'Unavailable responses never fabricate profile metrics',
    passed: missingSafe,
    detail: `availability="${profileResponse.meta.availability}", dataPresent=${Boolean(profileResponse.data)}`,
  });

  // 5. Licensing & retention policy registered
  checks.push({
    id: 'licensing_policy_enforced',
    label: 'Commercial licensing & retention metadata defined',
    passed: Boolean(rights && typeof rights.maxRetentionHours === 'number'),
    detail: `maxRetentionHours=${rights?.maxRetentionHours ?? 'unset'}, aiProcessingAllowed=${String(rights?.aiProcessingAllowed)}`,
  });

  // 6. Historical trend non-fabrication check
  if (params.historicalTrend) {
    const histValid =
      params.historicalTrend.observedCount >= 2
        ? params.historicalTrend.status === 'ok'
        : params.historicalTrend.status === 'insufficient_history' &&
          params.historicalTrend.followerGrowth.direction === 'unavailable';
    checks.push({
      id: 'historical_non_fabrication',
      label: 'Historical trends require >= 2 real observations',
      passed: histValid,
      detail: `observedCount=${params.historicalTrend.observedCount}, status="${params.historicalTrend.status}"`,
    });
  }

  // 7. Competitor methodology disclosure check
  if (params.competitorBenchmark) {
    const compValid =
      (!params.competitorBenchmark.hasMixedSources ||
        params.competitorBenchmark.compatibilityWarnings.length > 0) &&
      Boolean(params.competitorBenchmark.methodologyNote);
    checks.push({
      id: 'competitor_methodology_disclosed',
      label: 'Competitor mixed-source & null-exclusion disclosures active',
      passed: compValid,
      detail: `hasMixedSources=${params.competitorBenchmark.hasMixedSources}, warnings=${params.competitorBenchmark.compatibilityWarnings.length}`,
    });
  }

  // 8. AI attribution honesty check
  if (params.aiResult) {
    const aiHonest =
      params.aiResult.providerStatus !== 'provider_disabled_deterministic_fallback' ||
      params.aiResult.contentOrigin === 'template_generated';
    checks.push({
      id: 'ai_attribution_honest',
      label: 'Deterministic fallback never mislabeled as AI-generated',
      passed: aiHonest && params.aiResult.requiresHumanReview,
      detail: `providerStatus="${params.aiResult.providerStatus}", contentOrigin="${params.aiResult.contentOrigin}"`,
    });
  }

  const passedCount = checks.filter((c) => c.passed).length;
  return {
    providerId,
    verificationMode: params.verificationMode,
    allPassed: passedCount === checks.length,
    passedCount,
    totalCount: checks.length,
    checks,
    evaluatedAt: new Date().toISOString(),
    honestyDisclosure:
      params.verificationMode === 'fixture_contract_test'
        ? 'FIXTURE CONTRACT TEST ONLY — NOT live external provider data verification.'
        : 'LIVE PROVIDER VERIFICATION — executed against authorized live upstream response.',
  };
}
