/**
 * Pure, deterministic calculation & analysis engines for Viewora's Free Tools.
 * Every formula is transparent, unit-tested, and never fabricates live Instagram state.
 */

export interface EngagementInput {
  followers: number;
  avgLikes: number;
  avgComments: number;
  avgSaves?: number;
  avgShares?: number;
  avgReach?: number;
}

export interface EngagementResult {
  totalAvgInteractions: number;
  erByFollowers: number; // %
  erByReach: number | null; // %
  tier: 'Nano' | 'Micro' | 'Mid-Tier' | 'Macro' | 'Mega';
  benchmarkRange: string;
  rating: 'Above Benchmark' | 'On Benchmark' | 'Below Benchmark';
}

export function classifyCreatorTier(followers: number): {
  tier: EngagementResult['tier'];
  lowBenchmark: number;
  highBenchmark: number;
  benchmarkRange: string;
} {
  if (followers < 10_000) {
    return { tier: 'Nano', lowBenchmark: 3.5, highBenchmark: 7.0, benchmarkRange: '3.5% – 7.0%' };
  }
  if (followers < 50_000) {
    return { tier: 'Micro', lowBenchmark: 2.2, highBenchmark: 5.0, benchmarkRange: '2.2% – 5.0%' };
  }
  if (followers < 250_000) {
    return { tier: 'Mid-Tier', lowBenchmark: 1.5, highBenchmark: 3.5, benchmarkRange: '1.5% – 3.5%' };
  }
  if (followers < 1_000_000) {
    return { tier: 'Macro', lowBenchmark: 1.0, highBenchmark: 2.5, benchmarkRange: '1.0% – 2.5%' };
  }
  return { tier: 'Mega', lowBenchmark: 0.7, highBenchmark: 1.8, benchmarkRange: '0.7% – 1.8%' };
}

export function calculateEngagement(input: EngagementInput): EngagementResult {
  const followers = Math.max(1, Math.floor(input.followers));
  const likes = Math.max(0, input.avgLikes);
  const comments = Math.max(0, input.avgComments);
  const saves = Math.max(0, input.avgSaves ?? 0);
  const shares = Math.max(0, input.avgShares ?? 0);
  const totalAvgInteractions = likes + comments + saves + shares;

  const erByFollowers = Number(((totalAvgInteractions / followers) * 100).toFixed(2));
  const erByReach =
    input.avgReach && input.avgReach > 0
      ? Number(((totalAvgInteractions / input.avgReach) * 100).toFixed(2))
      : null;

  const tierInfo = classifyCreatorTier(followers);
  const rating: EngagementResult['rating'] =
    erByFollowers >= tierInfo.highBenchmark
      ? 'Above Benchmark'
      : erByFollowers >= tierInfo.lowBenchmark
        ? 'On Benchmark'
        : 'Below Benchmark';

  return {
    totalAvgInteractions: Math.round(totalAvgInteractions),
    erByFollowers,
    erByReach,
    tier: tierInfo.tier,
    benchmarkRange: tierInfo.benchmarkRange,
    rating,
  };
}

export interface FollowerGrowthInput {
  startFollowers: number;
  endFollowers: number;
  days: number;
  targetMilestone?: number;
}

export interface FollowerGrowthResult {
  netChange: number;
  percentChange: number;
  dailyAverage: number;
  projected30DayGain: number;
  estimatedDaysToTarget: number | null;
}

export function calculateFollowerGrowth(input: FollowerGrowthInput): FollowerGrowthResult {
  const start = Math.max(1, input.startFollowers);
  const end = Math.max(0, input.endFollowers);
  const days = Math.max(1, Math.floor(input.days));

  const netChange = end - start;
  const percentChange = Number(((netChange / start) * 100).toFixed(2));
  const dailyAverage = Number((netChange / days).toFixed(1));
  const projected30DayGain = Math.round(dailyAverage * 30);

  let estimatedDaysToTarget: number | null = null;
  if (input.targetMilestone && input.targetMilestone > end && dailyAverage > 0) {
    estimatedDaysToTarget = Math.ceil((input.targetMilestone - end) / dailyAverage);
  }

  return {
    netChange,
    percentChange,
    dailyAverage,
    projected30DayGain,
    estimatedDaysToTarget,
  };
}

export interface BioAnalysisResult {
  characterCount: number;
  maxCharacters: 150;
  wordCount: number;
  lineCount: number;
  emojiCount: number;
  hasCallToAction: boolean;
  hasLinkCue: boolean;
  hasContactInfo: boolean;
  score: number; // 0..100
  strengths: string[];
  suggestions: string[];
}

const CTA_KEYWORDS = [
  'shop',
  'order',
  'book',
  'download',
  'subscribe',
  'visit',
  'free',
  'join',
  'dm',
  'link',
  'guide',
  'start',
  'learn',
  'apply',
  'try',
];

export function analyzeBio(bioText: string): BioAnalysisResult {
  const trimmed = bioText.trim();
  const characterCount = trimmed.length;
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const lineCount = trimmed ? trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0).length : 0;
  const emojiMatches = trimmed.match(/\p{Extended_Pictographic}/gu) ?? [];
  const emojiCount = emojiMatches.length;

  const lower = trimmed.toLowerCase();
  const hasCallToAction = CTA_KEYWORDS.some((kw) => lower.includes(kw));
  const hasLinkCue =
    lower.includes('http') ||
    lower.includes('.com') ||
    lower.includes('link') ||
    lower.includes('below') ||
    lower.includes('bio');
  const hasContactInfo =
    /@[a-z0-9._]+/i.test(trimmed) ||
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed) ||
    lower.includes('dm') ||
    lower.includes('email');

  let score = 20;
  const strengths: string[] = [];
  const suggestions: string[] = [];

  if (characterCount >= 60 && characterCount <= 150) {
    score += 25;
    strengths.push('Uses the 150-character Instagram bio budget effectively.');
  } else if (characterCount > 150) {
    score += 5;
    suggestions.push(`Trim ${characterCount - 150} characters to fit Instagram’s 150-character bio limit.`);
  } else {
    score += 10;
    suggestions.push('Add more specific niche positioning — concise bios between 60 and 150 characters convert better.');
  }

  if (hasCallToAction) {
    score += 20;
    strengths.push('Includes a clear call-to-action directing profile visitors.');
  } else {
    suggestions.push('Add a concrete call-to-action (e.g., "Download our guide", "Book a consult", or "Shop below").');
  }

  if (lineCount >= 2 && lineCount <= 4) {
    score += 15;
    strengths.push('Structured into scannable lines for mobile readers.');
  } else if (lineCount <= 1 && characterCount > 45) {
    suggestions.push('Break the bio into 2–4 short lines for faster mobile scanning.');
  }

  if (emojiCount >= 1 && emojiCount <= 4) {
    score += 10;
    strengths.push('Balanced emoji usage enhances visual hierarchy without clutter.');
  } else if (emojiCount > 5) {
    suggestions.push('Consider reducing emoji count to 1–4 so your core positioning stays readable.');
  }

  if (hasLinkCue || hasContactInfo) {
    score += 10;
    strengths.push('Provides a clear next step via link cue or contact channel.');
  } else {
    suggestions.push('Point visitors to your link-in-bio or preferred inquiry channel.');
  }

  return {
    characterCount,
    maxCharacters: 150,
    wordCount: words.length,
    lineCount,
    emojiCount,
    hasCallToAction,
    hasLinkCue,
    hasContactInfo,
    score: Math.min(100, score),
    strengths,
    suggestions,
  };
}

export interface HashtagSet {
  broad: string[];
  niche: string[];
  community: string[];
  all: string[];
}

const NICHE_LIBRARY: Record<string, { broad: string[]; niche: string[]; community: string[] }> = {
  marketing: {
    broad: ['#digitalmarketing', '#socialmediamarketing', '#contentstrategy', '#branding'],
    niche: ['#instagramanalytics', '#socialmediatips', '#contentmarketingtips', '#growthstrategy'],
    community: ['#marketingteams', '#creatoreconomy', '#brandbuilders', '#agencyowners'],
  },
  fitness: {
    broad: ['#fitness', '#workout', '#healthylifestyle', '#training'],
    niche: ['#mobilitytraining', '#strengthandconditioning', '#runningcommunity', '#functionaltraining'],
    community: ['#everydayathletes', '#fitnesstips', '#trainharder', '#wellnessjourney'],
  },
  food: {
    broad: ['#foodie', '#foodphotography', '#coffee', '#instafood'],
    niche: ['#specialtycoffee', '#smallbatchroasters', '#pourovercoffee', '#artisanfood'],
    community: ['#coffeelovers', '#homebarista', '#supportlocalcafes', '#foodcreators'],
  },
  design: {
    broad: ['#design', '#interiordesign', '#architecture', '#minimalism'],
    niche: ['#nordicdesign', '#scandinavianhome', '#moderninteriors', '#sustainabledesign'],
    community: ['#designinspiration', '#architecturaldetails', '#designstudios', '#creativeliving'],
  },
  ecommerce: {
    broad: ['#ecommerce', '#smallbusiness', '#shopsmall', '#onlinebusiness'],
    niche: ['#dtcbrands', '#productphotography', '#brandstorytelling', '#conversionoptimization'],
    community: ['#foundersclub', '#independentbrands', '#makerscommunity', '#shopindependent'],
  },
};

export function generateHashtags(topicInput: string, nicheKey = 'marketing'): HashtagSet {
  const cleanedTokens = topicInput
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 4);

  const base = NICHE_LIBRARY[nicheKey] ?? NICHE_LIBRARY.marketing!;
  const customBroad = cleanedTokens.map((t) => `#${t}`);
  const customNiche =
    cleanedTokens.length >= 2
      ? [`#${cleanedTokens[0]}${cleanedTokens[1]}`, `#${cleanedTokens[0]}tips`, `#${cleanedTokens[0]}guide`]
      : cleanedTokens.map((t) => `#${t}tips`);
  const customCommunity = cleanedTokens.map((t) => `#${t}community`);

  const dedupe = (items: string[], max: number) => Array.from(new Set(items)).slice(0, max);

  const broad = dedupe([...customBroad, ...base.broad], 5);
  const niche = dedupe([...customNiche, ...base.niche], 5);
  const community = dedupe([...customCommunity, ...base.community], 5);
  const all = dedupe([...broad, ...niche, ...community], 15);

  return { broad, niche, community, all };
}

export interface PostPerformanceInput {
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  followers: number;
}

export interface PostPerformanceResult {
  totalEngagements: number;
  engagementRateByReach: number;
  engagementRateByFollowers: number;
  saveRate: number;
  shareRate: number;
  commentToLikeRatio: number;
  verdict: 'High Resonance' | 'Solid Performance' | 'Needs Hook & CTA Tuning';
  notes: string[];
}

export function analyzePostPerformance(input: PostPerformanceInput): PostPerformanceResult {
  const reach = Math.max(1, input.reach);
  const followers = Math.max(1, input.followers);
  const likes = Math.max(0, input.likes);
  const comments = Math.max(0, input.comments);
  const saves = Math.max(0, input.saves);
  const shares = Math.max(0, input.shares);

  const totalEngagements = likes + comments + saves + shares;
  const engagementRateByReach = Number(((totalEngagements / reach) * 100).toFixed(2));
  const engagementRateByFollowers = Number(((totalEngagements / followers) * 100).toFixed(2));
  const saveRate = Number(((saves / reach) * 100).toFixed(2));
  const shareRate = Number(((shares / reach) * 100).toFixed(2));
  const commentToLikeRatio = likes > 0 ? Number(((comments / likes) * 100).toFixed(2)) : 0;

  const notes: string[] = [];
  if (saveRate >= 2.0) {
    notes.push('Strong save rate (>= 2% of reach) indicates high reference or educational value.');
  } else {
    notes.push('Add a checklist, framework, or "save for later" cue to improve save rate.');
  }

  if (shareRate >= 1.0) {
    notes.push('Healthy share rate (>= 1% of reach) helps expand non-follower distribution.');
  } else {
    notes.push('Test relatable hooks or clear visual takeaways that audiences want to send to peers.');
  }

  const verdict: PostPerformanceResult['verdict'] =
    engagementRateByReach >= 6 || (saveRate >= 2 && shareRate >= 1)
      ? 'High Resonance'
      : engagementRateByReach >= 3
        ? 'Solid Performance'
        : 'Needs Hook & CTA Tuning';

  return {
    totalEngagements,
    engagementRateByReach,
    engagementRateByFollowers,
    saveRate,
    shareRate,
    commentToLikeRatio,
    verdict,
    notes,
  };
}

export interface InfluencerEvaluationInput {
  followers: number;
  avgLikes: number;
  avgComments: number;
  postsPerWeek: number;
}

export interface InfluencerEvaluationResult {
  tier: EngagementResult['tier'];
  engagementRate: number;
  benchmarkRange: string;
  estimatedReachLow: number;
  estimatedReachHigh: number;
  consistencyLabel: 'Consistent' | 'Moderate' | 'Low Cadence';
  readinessScore: number; // 0..100
}

export function evaluateInfluencer(input: InfluencerEvaluationInput): InfluencerEvaluationResult {
  const eng = calculateEngagement({
    followers: input.followers,
    avgLikes: input.avgLikes,
    avgComments: input.avgComments,
  });

  // Transparent reach estimate band: typically 18%–38% of followers depending on engagement
  const reachFactorLow = eng.rating === 'Above Benchmark' ? 0.24 : 0.16;
  const reachFactorHigh = eng.rating === 'Above Benchmark' ? 0.44 : 0.32;
  const estimatedReachLow = Math.round(input.followers * reachFactorLow);
  const estimatedReachHigh = Math.round(input.followers * reachFactorHigh);

  const consistencyLabel: InfluencerEvaluationResult['consistencyLabel'] =
    input.postsPerWeek >= 3 ? 'Consistent' : input.postsPerWeek >= 1.5 ? 'Moderate' : 'Low Cadence';

  let readinessScore = 40;
  if (eng.rating === 'Above Benchmark') readinessScore += 35;
  else if (eng.rating === 'On Benchmark') readinessScore += 22;
  else readinessScore += 8;

  if (consistencyLabel === 'Consistent') readinessScore += 25;
  else if (consistencyLabel === 'Moderate') readinessScore += 15;
  else readinessScore += 5;

  return {
    tier: eng.tier,
    engagementRate: eng.erByFollowers,
    benchmarkRange: eng.benchmarkRange,
    estimatedReachLow,
    estimatedReachHigh,
    consistencyLabel,
    readinessScore: Math.min(100, readinessScore),
  };
}

export type CaptionTone = 'professional' | 'conversational' | 'educational' | 'bold';

export interface GeneratedCaption {
  style: 'Short Hook' | 'Educational Breakdown' | 'Community Story';
  text: string;
  characterCount: number;
}

export function generateCaptions(params: {
  topic: string;
  tone: CaptionTone;
  cta?: string;
}): GeneratedCaption[] {
  const topic = params.topic.trim() || 'your latest Instagram campaign';
  const cta =
    params.cta?.trim() || 'Save this post for your next content sprint and share your take below.';

  const openers: Record<CaptionTone, { short: string; edu: string; story: string }> = {
    professional: {
      short: `A clearer lens on ${topic}.`,
      edu: `3 practical benchmarks to keep in mind for ${topic}:`,
      story: `What changed when our team simplified ${topic}:`,
    },
    conversational: {
      short: `Quick note on ${topic} that actually saves time 👇`,
      edu: `Let’s break down ${topic} without the fluff:`,
      story: `Honest lesson from testing ${topic} this month:`,
    },
    educational: {
      short: `Save this checklist before you plan ${topic}.`,
      edu: `Step-by-step framework for better ${topic}:`,
      story: `Why most creators overlook the fundamentals of ${topic}:`,
    },
    bold: {
      short: `Stop guessing on ${topic} — measure what moves the needle.`,
      edu: `The 3 metrics that actually decide ${topic}:`,
      story: `Unpopular opinion on ${topic}: consistency beats luck every time.`,
    },
  };

  const o = openers[params.tone];

  const drafts: Array<{ style: GeneratedCaption['style']; text: string }> = [
    {
      style: 'Short Hook',
      text: `${o.short}\n\nFocus on clarity, measurable outcomes, and one repeatable habit this week.\n\n${cta}`,
    },
    {
      style: 'Educational Breakdown',
      text: `${o.edu}\n\n1. Start with a concrete hook in line one.\n2. Pair public benchmarks with save-worthy takeaways.\n3. Review 30-day trends instead of single-post spikes.\n\n${cta}`,
    },
    {
      style: 'Community Story',
      text: `${o.story}\n\nInstead of chasing vanity metrics, we focused on audience fit and publishing cadence around ${topic}.\n\n${cta}`,
    },
  ];

  return drafts.map((d) => ({
    ...d,
    characterCount: d.text.length,
  }));
}

export interface ContentIdea {
  title: string;
  format: 'Reel' | 'Carousel' | 'Single Post' | 'Story Series';
  hook: string;
  kpiFocus: 'Reach' | 'Saves' | 'Shares' | 'Replies';
}

export function generateContentIdeas(params: {
  niche: string;
  audience: string;
  goal: 'reach' | 'saves' | 'conversion' | 'community';
}): ContentIdea[] {
  const niche = params.niche.trim() || 'social media analytics';
  const audience = params.audience.trim() || 'creators and small teams';

  const ideas: ContentIdea[] = [
    {
      title: `3 Mistakes ${audience} Make With ${niche}`,
      format: 'Reel',
      hook: `"If your ${niche} results feel flat, check #2 first…"`,
      kpiFocus: 'Reach',
    },
    {
      title: `The 5-Step ${niche} Checklist`,
      format: 'Carousel',
      hook: `"Swipe to steal our weekly ${niche} workflow."`,
      kpiFocus: 'Saves',
    },
    {
      title: `Before vs. After: Simplifying ${niche}`,
      format: 'Carousel',
      hook: `"What changed when we cut the noise and focused on fundamentals."`,
      kpiFocus: 'Saves',
    },
    {
      title: `30-Second Tool Walkthrough for ${audience}`,
      format: 'Reel',
      hook: `"Here is how we audit ${niche} in under two minutes."`,
      kpiFocus: 'Shares',
    },
    {
      title: `Myth vs. Reality in ${niche}`,
      format: 'Single Post',
      hook: `"Two myths still slowing down ${audience} in 2026."`,
      kpiFocus: 'Shares',
    },
    {
      title: `Quick Poll: Biggest ${niche} Bottleneck?`,
      format: 'Story Series',
      hook: `"Vote below — we will turn the top answer into Friday’s deep dive."`,
      kpiFocus: 'Replies',
    },
  ];

  if (params.goal === 'saves') {
    return [...ideas.filter((i) => i.kpiFocus === 'Saves'), ...ideas.filter((i) => i.kpiFocus !== 'Saves')];
  }
  if (params.goal === 'community') {
    return [...ideas.filter((i) => i.kpiFocus === 'Replies' || i.kpiFocus === 'Shares'), ...ideas.filter((i) => i.kpiFocus !== 'Replies' && i.kpiFocus !== 'Shares')];
  }
  return ideas;
}
