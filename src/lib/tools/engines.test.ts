import { describe, expect, it } from 'vitest';
import { FREE_TOOLS } from './catalog';
import {
  analyzeBio,
  analyzePostPerformance,
  calculateEngagement,
  calculateFollowerGrowth,
  evaluateInfluencer,
  generateCaptions,
  generateContentIdeas,
  generateHashtags,
} from './engines';

describe('Free Tool Catalog & Calculation Engines', () => {
  it('registers all 12 required individual SEO tools', () => {
    expect(FREE_TOOLS).toHaveLength(12);
    const slugs = FREE_TOOLS.map((t) => t.slug);
    expect(slugs).toEqual([
      'instagram-viewer',
      'instagram-story-viewer',
      'instagram-profile-analyzer',
      'instagram-engagement-calculator',
      'instagram-follower-growth',
      'instagram-bio-analyzer',
      'instagram-hashtag-generator',
      'instagram-competitor-analysis',
      'instagram-influencer-analyzer',
      'instagram-post-analyzer',
      'instagram-caption-generator',
      'instagram-content-ideas',
    ]);
  });

  it('generates structured captions and content ideas without external credentials', () => {
    const captions = generateCaptions({ topic: 'brand storytelling', tone: 'educational' });
    expect(captions).toHaveLength(3);
    expect(captions[0]?.characterCount).toBeGreaterThan(20);

    const ideas = generateContentIdeas({
      niche: 'coffee roastery',
      audience: 'home baristas',
      goal: 'saves',
    });
    expect(ideas.length).toBeGreaterThanOrEqual(6);
    expect(ideas[0]?.kpiFocus).toBe('Saves');
  });

  it('calculates engagement rate by followers and by reach accurately', () => {
    const res = calculateEngagement({
      followers: 50_000,
      avgLikes: 2000,
      avgComments: 250,
      avgSaves: 200,
      avgShares: 50,
      avgReach: 25_000,
    });
    expect(res.totalAvgInteractions).toBe(2500);
    expect(res.erByFollowers).toBe(5);
    expect(res.erByReach).toBe(10);
    expect(res.tier).toBe('Mid-Tier');
    expect(res.rating).toBe('Above Benchmark');
  });

  it('calculates follower growth velocity and milestone days', () => {
    const res = calculateFollowerGrowth({
      startFollowers: 10_000,
      endFollowers: 13_000,
      days: 30,
      targetMilestone: 16_000,
    });
    expect(res.netChange).toBe(3000);
    expect(res.percentChange).toBe(30);
    expect(res.dailyAverage).toBe(100);
    expect(res.estimatedDaysToTarget).toBe(30);
  });

  it('analyzes Instagram bio length, CTA, and line structure', () => {
    const res = analyzeBio(
      'Nordic coffee roastery ☕\nWeekly brew guides\nOrder fresh beans via link below 👇'
    );
    expect(res.characterCount).toBeLessThanOrEqual(150);
    expect(res.hasCallToAction).toBe(true);
    expect(res.hasLinkCue).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(80);
  });

  it('generates balanced broad, niche, and community hashtags', () => {
    const tags = generateHashtags('espresso pour over', 'food');
    expect(tags.broad.length).toBeGreaterThan(0);
    expect(tags.niche.length).toBeGreaterThan(0);
    expect(tags.community.length).toBeGreaterThan(0);
    expect(tags.all.every((t) => t.startsWith('#'))).toBe(true);
  });

  it('evaluates influencer tier and post performance diagnostics', () => {
    const inf = evaluateInfluencer({
      followers: 75_000,
      avgLikes: 3000,
      avgComments: 200,
      postsPerWeek: 4,
    });
    expect(inf.tier).toBe('Mid-Tier');
    expect(inf.consistencyLabel).toBe('Consistent');
    expect(inf.estimatedReachHigh).toBeGreaterThan(inf.estimatedReachLow);

    const post = analyzePostPerformance({
      likes: 1800,
      comments: 150,
      saves: 750,
      shares: 300,
      reach: 30_000,
      followers: 50_000,
    });
    expect(post.engagementRateByReach).toBe(10);
    expect(post.saveRate).toBe(2.5);
    expect(post.shareRate).toBe(1);
    expect(post.verdict).toBe('High Resonance');
  });
});
