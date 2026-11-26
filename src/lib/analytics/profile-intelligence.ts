import type { DataClass, PublicProfileData } from '@/lib/providers/types';
import {
  calculateDataCompleteness,
  calculateFormatDistribution,
  calculatePostingConsistency,
} from './engine';

export type ProfileDataState =
  | 'live'
  | 'cached'
  | 'estimate'
  | 'user_provided'
  | 'unavailable'
  | 'demo';

export interface PublicBioAnalysis {
  characterCount: number;
  wordCount: number;
  hashtags: string[];
  mentions: string[];
  hasExternalLink: boolean;
  hasCallToAction: boolean;
  ctaSignals: string[];
  summary: string;
}

export interface ProfileIntelligenceSummary {
  username: string;
  dataState: ProfileDataState;
  freshnessLabel: string;
  completenessScore: number;
  populatedFields: number;
  totalFields: number;
  missingFields: string[];
  bioAnalysis: PublicBioAnalysis;
  topHashtags: Array<{ tag: string; count: number }>;
  formatMix: { reel: number; carousel: number; image: number; total: number };
  postingConsistencyScore: number | null;
  postingConsistencyLabel: string;
  limitations: string[];
}

const CTA_KEYWORDS = [
  'shop',
  'book',
  'link',
  'dm',
  'email',
  'subscribe',
  'download',
  'join',
  'contact',
  'learn more',
  'order',
  'free',
];

export function resolveProfileDataState(
  dataClass: DataClass,
  providerLabel: string,
  hasCoreMetrics: boolean
): ProfileDataState {
  if (dataClass === 'demo') return 'demo';
  if (/user-provided|csv/i.test(providerLabel)) return 'user_provided';
  if (!hasCoreMetrics) return 'unavailable';
  if (dataClass === 'live') return 'live';
  if (dataClass === 'cached') return 'cached';
  return 'estimate';
}

export function analyzePublicBio(bio: string, externalUrl: string | null): PublicBioAnalysis {
  const trimmed = (bio ?? '').trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const hashtags = (trimmed.match(/#[\p{L}\p{N}_]+/gu) ?? []).slice(0, 10);
  const mentions = (trimmed.match(/@[a-zA-Z0-9._]+/g) ?? []).slice(0, 10);
  const lower = trimmed.toLowerCase();
  const ctaSignals = CTA_KEYWORDS.filter((kw) => lower.includes(kw));
  const hasExternalLink = Boolean(externalUrl && externalUrl.trim().length > 0);
  const hasCallToAction = ctaSignals.length > 0 || hasExternalLink;

  let summary = 'No public bio text recorded.';
  if (trimmed.length > 0) {
    summary = `${trimmed.length} chars · ${words.length} words${
      hasCallToAction ? ' · Includes CTA/link signal' : ' · No explicit CTA keyword detected'
    }`;
  }

  return {
    characterCount: trimmed.length,
    wordCount: words.length,
    hashtags,
    mentions,
    hasExternalLink,
    hasCallToAction,
    ctaSignals,
    summary,
  };
}

export function formatFreshnessAge(capturedIso?: string | null): string {
  if (!capturedIso) return 'Timestamp unavailable';
  const ts = new Date(capturedIso).getTime();
  if (!Number.isFinite(ts)) return 'Timestamp unavailable';
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (diffMin < 1) return 'Captured just now';
  if (diffMin < 60) return `Captured ${diffMin}m ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 48) return `Captured ${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `Captured ${diffDays}d ago`;
}

/**
 * Deterministic Profile Intelligence Engine (Stage 43).
 * Evaluates completeness, public bio signals, hashtag frequency, content mix,
 * freshness, and explicit missing-field disclosures without ever fabricating metrics.
 */
export function buildProfileIntelligenceSummary(params: {
  profile: PublicProfileData;
  dataClass: DataClass;
  providerLabel: string;
  capturedAt?: string | null;
}): ProfileIntelligenceSummary {
  const { profile, dataClass, providerLabel, capturedAt } = params;
  const completeness = calculateDataCompleteness(profile);
  const formats = calculateFormatDistribution(profile.recentPosts);
  const consistency = calculatePostingConsistency(profile.recentPosts);
  const bioAnalysis = analyzePublicBio(profile.bio, profile.externalUrl);

  const hasCoreMetrics =
    profile.followersCount !== null ||
    profile.postsCount !== null ||
    profile.estimatedEngagementRate !== null;
  const dataState = resolveProfileDataState(dataClass, providerLabel, hasCoreMetrics);

  const tagCounts = new Map<string, number>();
  for (const post of profile.recentPosts) {
    for (const rawTag of post.hashtags) {
      const t = rawTag.toLowerCase();
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const topHashtags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  const limitations: string[] = [];
  if (dataState === 'demo') {
    limitations.push('Explicitly labeled DEMO preview fixture — not live external Instagram data.');
  } else if (dataState === 'user_provided') {
    limitations.push('Metrics supplied via customer CSV import rather than live external API sync.');
  } else if (dataState === 'unavailable') {
    limitations.push('Core public metrics are unavailable because live external providers are disabled or returned no data.');
  }
  if (completeness.missingFields.length > 0) {
    limitations.push(`Unavailable fields (never fabricated): ${completeness.missingFields.join(', ')}.`);
  }

  return {
    username: profile.username,
    dataState,
    freshnessLabel: formatFreshnessAge(capturedAt),
    completenessScore: completeness.scorePercent,
    populatedFields: completeness.populatedFields,
    totalFields: completeness.totalFields,
    missingFields: completeness.missingFields,
    bioAnalysis,
    topHashtags,
    formatMix: {
      reel: formats.percentages.reel,
      carousel: formats.percentages.carousel,
      image: formats.percentages.image,
      total: formats.total,
    },
    postingConsistencyScore: consistency.consistencyScore,
    postingConsistencyLabel: consistency.label,
    limitations,
  };
}
