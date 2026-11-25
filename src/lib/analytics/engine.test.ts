import { describe, expect, it } from 'vitest';
import {
  analyzeProfileDeterministic,
  calculateBenchmarkComparison,
  calculateDataCompleteness,
  calculateEngagementRateByFollowers,
  calculateEngagementRateByReach,
  calculateFormatDistribution,
  calculateMovingAverage,
  calculatePeriodGrowth,
  calculatePostingConsistency,
  calculateStatisticalSummary,
  METRIC_DEFINITIONS,
} from './engine';
import type { PublicProfileData } from '@/lib/providers/types';

describe('Stage 24 — Deterministic Analytics & Intelligence Engine', () => {
  it('computes ERF and ERR accurately while preserving exact zero vs null semantics', () => {
    expect(calculateEngagementRateByFollowers(450, 10000)).toBe(4.5);
    expect(calculateEngagementRateByFollowers(0, 10000)).toBe(0);
    expect(calculateEngagementRateByFollowers(450, 0)).toBeNull();
    expect(calculateEngagementRateByFollowers(450, null)).toBeNull();
    expect(calculateEngagementRateByFollowers(-5, 1000)).toBeNull();

    expect(calculateEngagementRateByReach(250, 5000)).toBe(5);
    expect(calculateEngagementRateByReach(0, 5000)).toBe(0);
    expect(calculateEngagementRateByReach(250, 0)).toBeNull();
    expect(calculateEngagementRateByReach(250, undefined)).toBeNull();
  });

  it('computes period growth cleanly including zero denominators and missing checkpoints', () => {
    expect(calculatePeriodGrowth(1000, 1250)).toEqual({
      previous: 1000,
      current: 1250,
      delta: 250,
      percentChange: 25,
      direction: 'up',
    });
    expect(calculatePeriodGrowth(1000, 800)).toEqual({
      previous: 1000,
      current: 800,
      delta: -200,
      percentChange: -20,
      direction: 'down',
    });
    expect(calculatePeriodGrowth(0, 50)).toEqual({
      previous: 0,
      current: 50,
      delta: 50,
      percentChange: null,
      direction: 'up',
    });
    expect(calculatePeriodGrowth(null, 50).direction).toBe('unavailable');
  });

  it('computes simple moving averages and statistical summaries deterministically', () => {
    expect(calculateMovingAverage([10, 20, 30, 40, 50], 3)).toEqual([null, null, 20, 30, 40]);
    expect(calculateMovingAverage([10, null, 30, 40], 2)).toEqual([null, null, null, 35]);

    const stats = calculateStatisticalSummary([10, 20, 30, 40, null]);
    expect(stats.count).toBe(5);
    expect(stats.validCount).toBe(4);
    expect(stats.missingCount).toBe(1);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(40);
    expect(stats.mean).toBe(25);
    expect(stats.median).toBe(25);
    expect(stats.stdDev).toBe(11.18);
  });

  it('computes format mix, posting consistency, benchmark percentiles, and data completeness', () => {
    const sampleProfile: PublicProfileData = {
      username: 'metric.lab',
      displayName: 'Metric Lab',
      bio: 'Deterministic analytics test fixture',
      category: 'Analytics',
      externalUrl: 'https://viewora.example',
      isVerified: false,
      isBusinessAccount: true,
      isPrivate: false,
      avatarInitials: 'ML',
      avatarAccent: '#7957FF',
      followersCount: 10000,
      followingCount: 300,
      postsCount: 120,
      estimatedEngagementRate: 4.5,
      postingCadencePerWeek: 3.5,
      recentPosts: [
        {
          id: 'p1',
          captionExcerpt: 'Post 1',
          mediaType: 'reel',
          likes: 400,
          comments: 50,
          estimatedReach: 5000,
          publishedAt: '2026-11-01T12:00:00.000Z',
          hashtags: ['#analytics'],
        },
        {
          id: 'p2',
          captionExcerpt: 'Post 2',
          mediaType: 'carousel',
          likes: 350,
          comments: 50,
          estimatedReach: 4000,
          publishedAt: '2026-11-03T12:00:00.000Z',
          hashtags: ['#growth'],
        },
        {
          id: 'p3',
          captionExcerpt: 'Post 3',
          mediaType: 'reel',
          likes: 500,
          comments: 50,
          estimatedReach: 6000,
          publishedAt: '2026-11-05T12:00:00.000Z',
          hashtags: ['#reels'],
        },
      ],
      historicalTrend: [
        { date: '2026-10-01', followers: 9000, following: 290, posts: 110, engagementRate: 4.0 },
        { date: '2026-10-15', followers: 9500, following: 295, posts: 115, engagementRate: 4.2 },
        { date: '2026-11-01', followers: 10000, following: 300, posts: 120, engagementRate: 4.5 },
      ],
    };

    const fmt = calculateFormatDistribution(sampleProfile.recentPosts);
    expect(fmt.counts).toEqual({ reel: 2, carousel: 1, image: 0 });
    expect(fmt.percentages.reel).toBe(66.7);

    const consistency = calculatePostingConsistency(sampleProfile.recentPosts);
    expect(consistency.avgIntervalHours).toBe(48);
    expect(consistency.consistencyScore).toBe(100);
    expect(consistency.label).toBe('High');

    const bench = calculateBenchmarkComparison(4.5, [2.1, 3.4, 4.5, 6.0]);
    expect(bench.peerMean).toBe(4);
    expect(bench.percentileRank).toBe(75);

    const completeness = calculateDataCompleteness(sampleProfile);
    expect(completeness.scorePercent).toBe(100);
    expect(completeness.missingFields).toHaveLength(0);

    const full = analyzeProfileDeterministic(sampleProfile);
    expect(full.followersGrowth.delta).toBe(1000);
    expect(full.engagementRateByFollowers).toBe(4.67);
    expect(full.engagementRateByReach).toBe(9.33);
    expect(Object.keys(METRIC_DEFINITIONS).length).toBeGreaterThanOrEqual(6);
  });
});
