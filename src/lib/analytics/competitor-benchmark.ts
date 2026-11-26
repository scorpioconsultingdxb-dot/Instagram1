import type { SavedProfileRecord } from '@/lib/dashboard/store';
import { calculateDataCompleteness } from './engine';

export type BenchmarkDateRange = '30d' | '90d' | 'all';

export interface CompatibleBenchmarkRow {
  username: string;
  displayName: string;
  dataClass: SavedProfileRecord['dataClass'];
  providerLabel: string;
  capturedAt: string;
  followersCount: number | null;
  estimatedEngagementRate: number | null;
  deltaErVsComparableAvg: number | null;
  postingCadencePerWeek: number | null;
  followerGrowthDelta: number | null;
  completenessPercent: number;
}

export interface CompetitorBenchmarkAnalysis {
  rows: CompatibleBenchmarkRow[];
  comparableErCount: number;
  comparableAvgEr: number | null;
  comparableFollowersCount: number;
  comparableAvgFollowers: number | null;
  hasMixedSources: boolean;
  hasMixedCaptureDates: boolean;
  compatibilityWarnings: string[];
  methodologyNote: string;
}

function sliceTrendByRange<T>(items: T[], range: BenchmarkDateRange): T[] {
  if (range === '30d') return items.slice(-2);
  if (range === '90d') return items.slice(-4);
  return items;
}

/**
 * Compatibility-aware Competitor Benchmarking Engine (Stage 45).
 * - Never substitutes 0 for missing/null metrics when computing group averages.
 * - Flags mixed data sources (e.g. LIVE vs DEMO vs USER-PROVIDED) and divergent capture dates.
 * - Refuses misleading rankings when fewer than 2 profiles share a compatible metric.
 */
export function buildCompatibleCompetitorBenchmark(
  profiles: SavedProfileRecord[],
  dateRange: BenchmarkDateRange = 'all'
): CompetitorBenchmarkAnalysis {
  const validErs = profiles
    .map((p) => p.profile.estimatedEngagementRate)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const comparableAvgEr =
    validErs.length >= 2
      ? Number((validErs.reduce((sum, v) => sum + v, 0) / validErs.length).toFixed(2))
      : null;

  const validFollowers = profiles
    .map((p) => p.profile.followersCount)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const comparableAvgFollowers =
    validFollowers.length >= 2
      ? Math.round(validFollowers.reduce((sum, v) => sum + v, 0) / validFollowers.length)
      : null;

  const dataClasses = new Set(profiles.map((p) => p.dataClass));
  const providers = new Set(profiles.map((p) => p.providerLabel));
  const captureDays = new Set(profiles.map((p) => (p.updatedAt || p.savedAt).slice(0, 10)));

  const hasMixedSources = dataClasses.size > 1 || providers.size > 1;
  const hasMixedCaptureDates = captureDays.size > 1;

  const compatibilityWarnings: string[] = [];
  if (hasMixedSources) {
    compatibilityWarnings.push(
      `Mixed data sources detected (${Array.from(dataClasses)
        .map((c) => c.toUpperCase())
        .join(' vs ')}). Interpret cross-source comparisons with caution.`
    );
  }
  if (hasMixedCaptureDates) {
    compatibilityWarnings.push(
      `Profiles were captured on different dates (${Array.from(captureDays).sort().join(', ')}). Snapshot timing may influence deltas.`
    );
  }
  if (profiles.length >= 2 && validErs.length < profiles.length) {
    compatibilityWarnings.push(
      `${profiles.length - validErs.length} profile(s) lack engagement rate data; missing values are shown as Unavailable and excluded from group averages.`
    );
  }

  const rows: CompatibleBenchmarkRow[] = profiles.map((p) => {
    const er = p.profile.estimatedEngagementRate;
    const trendSlice = sliceTrendByRange(p.profile.historicalTrend, dateRange);
    const first = trendSlice[0];
    const last = trendSlice[trendSlice.length - 1];
    const followerGrowthDelta =
      trendSlice.length >= 2 && first && last ? last.followers - first.followers : null;

    return {
      username: p.username,
      displayName: p.profile.displayName,
      dataClass: p.dataClass,
      providerLabel: p.providerLabel,
      capturedAt: p.updatedAt || p.savedAt,
      followersCount: p.profile.followersCount,
      estimatedEngagementRate: er,
      deltaErVsComparableAvg:
        er !== null && comparableAvgEr !== null
          ? Number((er - comparableAvgEr).toFixed(2))
          : null,
      postingCadencePerWeek: p.profile.postingCadencePerWeek,
      followerGrowthDelta,
      completenessPercent: calculateDataCompleteness(p.profile).scorePercent,
    };
  });

  return {
    rows,
    comparableErCount: validErs.length,
    comparableAvgEr,
    comparableFollowersCount: validFollowers.length,
    comparableAvgFollowers,
    hasMixedSources,
    hasMixedCaptureDates,
    compatibilityWarnings,
    methodologyNote:
      'Group averages include only profiles with populated numeric metrics. Unavailable metrics are never converted to zero or ranked.',
  };
}
