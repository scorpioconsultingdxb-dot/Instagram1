import type { HistoricalMetricPoint, PublicPostSample, PublicProfileData } from '@/lib/providers/types';

export interface MetricFormulaDefinition {
  id: string;
  label: string;
  formula: string;
  unit: string;
  notes: string;
}

export const METRIC_DEFINITIONS: Record<string, MetricFormulaDefinition> = {
  erf: {
    id: 'erf',
    label: 'Engagement Rate by Followers (ERF)',
    formula: '((Likes + Comments) / Followers) × 100',
    unit: '%',
    notes: 'Returns null when followers are missing or ≤ 0. Preserves 0% when interactions are zero.',
  },
  err: {
    id: 'err',
    label: 'Engagement Rate by Reach (ERR)',
    formula: '((Likes + Comments) / Reach) × 100',
    unit: '%',
    notes: 'Requires authorized or user-provided reach data; returns null if reach is unavailable.',
  },
  period_growth: {
    id: 'period_growth',
    label: 'Period Growth Rate',
    formula: '((Current − Previous) / Previous) × 100',
    unit: '%',
    notes: 'Computes absolute delta and percentage change across two recorded checkpoints.',
  },
  sma: {
    id: 'sma',
    label: 'Simple Moving Average (SMA)',
    formula: '(x[i−k+1] + ... + x[i]) / k',
    unit: 'count',
    notes: 'Smooths checkpoint noise over window size k; positions prior to k return null.',
  },
  consistency: {
    id: 'consistency',
    label: 'Publishing Consistency Score',
    formula: 'max(0, round((1 − min(CV, 1)) × 100)) where CV = σ(intervals) / μ(intervals)',
    unit: 'score (0–100)',
    notes: 'Measures regularity of inter-post intervals in hours. Requires at least 2 timestamped posts.',
  },
  completeness: {
    id: 'completeness',
    label: 'Data Completeness Score',
    formula: '(Populated Core Fields / Total Core Fields) × 100',
    unit: '%',
    notes: 'Distinguishes missing fields (null/empty) from true zero metrics.',
  },
};

function roundTo(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateEngagementRateByFollowers(
  interactions: number | null | undefined,
  followers: number | null | undefined
): number | null {
  if (
    interactions === null ||
    interactions === undefined ||
    followers === null ||
    followers === undefined ||
    !Number.isFinite(interactions) ||
    !Number.isFinite(followers) ||
    followers <= 0 ||
    interactions < 0
  ) {
    return null;
  }
  return roundTo((interactions / followers) * 100, 2);
}

export function calculateEngagementRateByReach(
  interactions: number | null | undefined,
  reach: number | null | undefined
): number | null {
  if (
    interactions === null ||
    interactions === undefined ||
    reach === null ||
    reach === undefined ||
    !Number.isFinite(interactions) ||
    !Number.isFinite(reach) ||
    reach <= 0 ||
    interactions < 0
  ) {
    return null;
  }
  return roundTo((interactions / reach) * 100, 2);
}

export interface PeriodGrowthResult {
  previous: number | null;
  current: number | null;
  delta: number | null;
  percentChange: number | null;
  direction: 'up' | 'down' | 'flat' | 'unavailable';
}

export function calculatePeriodGrowth(
  previous: number | null | undefined,
  current: number | null | undefined
): PeriodGrowthResult {
  if (
    previous === null ||
    previous === undefined ||
    current === null ||
    current === undefined ||
    !Number.isFinite(previous) ||
    !Number.isFinite(current)
  ) {
    return {
      previous: previous ?? null,
      current: current ?? null,
      delta: null,
      percentChange: null,
      direction: 'unavailable',
    };
  }

  const delta = roundTo(current - previous, 2);
  const percentChange =
    previous === 0 ? null : roundTo(((current - previous) / Math.abs(previous)) * 100, 2);
  const direction: PeriodGrowthResult['direction'] =
    delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  return {
    previous,
    current,
    delta,
    percentChange,
    direction,
  };
}

export function calculateMovingAverage(
  values: Array<number | null | undefined>,
  windowSize: number
): Array<number | null> {
  if (!Number.isInteger(windowSize) || windowSize < 1) {
    return values.map(() => null);
  }
  return values.map((_, idx) => {
    if (idx < windowSize - 1) return null;
    const slice = values.slice(idx - windowSize + 1, idx + 1);
    const valid = slice.filter(
      (v): v is number => v !== null && v !== undefined && Number.isFinite(v)
    );
    if (valid.length !== windowSize) return null;
    const sum = valid.reduce((acc, v) => acc + v, 0);
    return roundTo(sum / windowSize, 2);
  });
}

export interface StatisticalSummary {
  count: number;
  validCount: number;
  missingCount: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
}

export function calculateStatisticalSummary(
  values: Array<number | null | undefined>
): StatisticalSummary {
  const valid = values
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v))
    .sort((a, b) => a - b);

  const count = values.length;
  const validCount = valid.length;
  const missingCount = count - validCount;

  if (validCount === 0) {
    return {
      count,
      validCount: 0,
      missingCount,
      min: null,
      max: null,
      mean: null,
      median: null,
      stdDev: null,
    };
  }

  const min = valid[0]!;
  const max = valid[validCount - 1]!;
  const meanRaw = valid.reduce((acc, v) => acc + v, 0) / validCount;
  const mid = Math.floor(validCount / 2);
  const medianRaw =
    validCount % 2 === 1 ? valid[mid]! : (valid[mid - 1]! + valid[mid]!) / 2;

  const variance =
    valid.reduce((acc, v) => acc + Math.pow(v - meanRaw, 2), 0) / validCount;

  return {
    count,
    validCount,
    missingCount,
    min: roundTo(min, 2),
    max: roundTo(max, 2),
    mean: roundTo(meanRaw, 2),
    median: roundTo(medianRaw, 2),
    stdDev: roundTo(Math.sqrt(variance), 2),
  };
}

export interface FormatDistributionResult {
  total: number;
  counts: { reel: number; carousel: number; image: number };
  percentages: { reel: number; carousel: number; image: number };
}

export function calculateFormatDistribution(posts: PublicPostSample[]): FormatDistributionResult {
  const counts = posts.reduce(
    (acc, post) => {
      acc[post.mediaType] += 1;
      return acc;
    },
    { reel: 0, carousel: 0, image: 0 }
  );
  const total = posts.length;
  if (total === 0) {
    return {
      total: 0,
      counts,
      percentages: { reel: 0, carousel: 0, image: 0 },
    };
  }
  const reel = roundTo((counts.reel / total) * 100, 1);
  const carousel = roundTo((counts.carousel / total) * 100, 1);
  const image = roundTo(Math.max(0, 100 - reel - carousel), 1);

  return {
    total,
    counts,
    percentages: { reel, carousel, image },
  };
}

export interface PostingConsistencyResult {
  sampledPosts: number;
  intervalCount: number;
  avgIntervalHours: number | null;
  stdDevIntervalHours: number | null;
  estimatedPostsPerWeek: number | null;
  consistencyScore: number | null; // 0..100
  label: 'High' | 'Moderate' | 'Irregular' | 'Insufficient data';
}

export function calculatePostingConsistency(posts: PublicPostSample[]): PostingConsistencyResult {
  const timestamps = posts
    .map((p) => new Date(p.publishedAt).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  if (timestamps.length < 2) {
    return {
      sampledPosts: timestamps.length,
      intervalCount: 0,
      avgIntervalHours: null,
      stdDevIntervalHours: null,
      estimatedPostsPerWeek: null,
      consistencyScore: null,
      label: 'Insufficient data',
    };
  }

  const intervalsHours: number[] = [];
  for (let i = 1; i < timestamps.length; i += 1) {
    const diffHours = (timestamps[i]! - timestamps[i - 1]!) / (1000 * 60 * 60);
    if (diffHours >= 0) intervalsHours.push(diffHours);
  }

  const stats = calculateStatisticalSummary(intervalsHours);
  if (stats.mean === null || stats.stdDev === null) {
    return {
      sampledPosts: timestamps.length,
      intervalCount: intervalsHours.length,
      avgIntervalHours: null,
      stdDevIntervalHours: null,
      estimatedPostsPerWeek: null,
      consistencyScore: null,
      label: 'Insufficient data',
    };
  }

  const cv = stats.mean > 0 ? stats.stdDev / stats.mean : 0;
  const consistencyScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(cv, 1)) * 100)));
  const estimatedPostsPerWeek = stats.mean > 0 ? roundTo(168 / stats.mean, 1) : null;
  const label: PostingConsistencyResult['label'] =
    consistencyScore >= 75 ? 'High' : consistencyScore >= 45 ? 'Moderate' : 'Irregular';

  return {
    sampledPosts: timestamps.length,
    intervalCount: intervalsHours.length,
    avgIntervalHours: stats.mean,
    stdDevIntervalHours: stats.stdDev,
    estimatedPostsPerWeek,
    consistencyScore,
    label,
  };
}

export interface BenchmarkComparisonResult {
  target: number | null;
  peerCount: number;
  peerMean: number | null;
  peerMedian: number | null;
  deltaVsMean: number | null;
  percentileRank: number | null; // 0..100
}

export function calculateBenchmarkComparison(
  target: number | null | undefined,
  peerValues: Array<number | null | undefined>
): BenchmarkComparisonResult {
  const validPeers = peerValues.filter(
    (v): v is number => v !== null && v !== undefined && Number.isFinite(v)
  );
  if (
    target === null ||
    target === undefined ||
    !Number.isFinite(target) ||
    validPeers.length === 0
  ) {
    return {
      target: target ?? null,
      peerCount: validPeers.length,
      peerMean: null,
      peerMedian: null,
      deltaVsMean: null,
      percentileRank: null,
    };
  }

  const peerStats = calculateStatisticalSummary(validPeers);
  const belowOrEqual = validPeers.filter((v) => v <= target).length;
  const percentileRank = Math.round((belowOrEqual / validPeers.length) * 100);

  return {
    target: roundTo(target, 2),
    peerCount: validPeers.length,
    peerMean: peerStats.mean,
    peerMedian: peerStats.median,
    deltaVsMean: peerStats.mean !== null ? roundTo(target - peerStats.mean, 2) : null,
    percentileRank,
  };
}

export interface DataCompletenessResult {
  scorePercent: number;
  populatedFields: number;
  totalFields: number;
  missingFields: string[];
}

export function calculateDataCompleteness(profile: PublicProfileData): DataCompletenessResult {
  const checks: Array<{ label: string; present: boolean }> = [
    { label: 'Followers count', present: profile.followersCount !== null },
    { label: 'Following count', present: profile.followingCount !== null },
    { label: 'Posts count', present: profile.postsCount !== null },
    { label: 'Estimated engagement rate', present: profile.estimatedEngagementRate !== null },
    { label: 'Posting cadence', present: profile.postingCadencePerWeek !== null },
    { label: 'Bio text', present: profile.bio.trim().length > 0 },
    { label: 'Category', present: profile.category.trim().length > 0 },
    { label: 'Recent posts sample', present: profile.recentPosts.length > 0 },
    { label: 'Historical checkpoints', present: profile.historicalTrend.length > 0 },
  ];

  const populatedFields = checks.filter((c) => c.present).length;
  const missingFields = checks.filter((c) => !c.present).map((c) => c.label);
  const scorePercent = Math.round((populatedFields / checks.length) * 100);

  return {
    scorePercent,
    populatedFields,
    totalFields: checks.length,
    missingFields,
  };
}

export interface DeterministicProfileAnalysis {
  username: string;
  followersGrowth: PeriodGrowthResult;
  engagementRateByFollowers: number | null;
  engagementRateByReach: number | null;
  followerStats: StatisticalSummary;
  engagementStats: StatisticalSummary;
  followersMovingAvg3: Array<number | null>;
  engagementMovingAvg3: Array<number | null>;
  formatDistribution: FormatDistributionResult;
  postingConsistency: PostingConsistencyResult;
  completeness: DataCompletenessResult;
  erBenchmark: BenchmarkComparisonResult | null;
}

export function analyzeProfileDeterministic(
  profile: PublicProfileData,
  pointsOverride?: HistoricalMetricPoint[],
  peerProfiles?: PublicProfileData[]
): DeterministicProfileAnalysis {
  const points = pointsOverride ?? profile.historicalTrend;
  const first = points[0];
  const last = points[points.length - 1];

  const followersSeries = points.map((p) => p.followers);
  const erSeries = points.map((p) => p.engagementRate);

  const avgInteractions =
    profile.recentPosts.length > 0
      ? profile.recentPosts.reduce((sum, p) => sum + p.likes + p.comments, 0) /
        profile.recentPosts.length
      : null;

  const postsWithReach = profile.recentPosts.filter(
    (p) => typeof p.estimatedReach === 'number' && p.estimatedReach > 0
  );
  const avgReach =
    postsWithReach.length > 0
      ? postsWithReach.reduce((sum, p) => sum + (p.estimatedReach ?? 0), 0) /
        postsWithReach.length
      : null;

  const computedErf =
    avgInteractions !== null
      ? calculateEngagementRateByFollowers(avgInteractions, profile.followersCount)
      : profile.estimatedEngagementRate;
  const computedErr =
    avgInteractions !== null && avgReach !== null
      ? calculateEngagementRateByReach(avgInteractions, avgReach)
      : null;

  const erBenchmark =
    peerProfiles && peerProfiles.length > 0
      ? calculateBenchmarkComparison(
          computedErf,
          peerProfiles.map((p) => p.estimatedEngagementRate)
        )
      : null;

  return {
    username: profile.username,
    followersGrowth: calculatePeriodGrowth(first?.followers ?? null, last?.followers ?? null),
    engagementRateByFollowers: computedErf,
    engagementRateByReach: computedErr,
    followerStats: calculateStatisticalSummary(followersSeries),
    engagementStats: calculateStatisticalSummary(erSeries),
    followersMovingAvg3: calculateMovingAverage(followersSeries, Math.min(3, Math.max(1, points.length))),
    engagementMovingAvg3: calculateMovingAverage(erSeries, Math.min(3, Math.max(1, points.length))),
    formatDistribution: calculateFormatDistribution(profile.recentPosts),
    postingConsistency: calculatePostingConsistency(profile.recentPosts),
    completeness: calculateDataCompleteness(profile),
    erBenchmark,
  };
}
