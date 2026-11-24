import type { DataClass, PublicProfileData } from '@/lib/providers/types';

export interface StructuredAiInsightReport {
  username: string;
  generatedAt: string;
  modelLabel: string;
  dataClass: DataClass;
  executiveSummary: string;
  strengths: string[];
  opportunities: string[];
  recommendedActions: string[];
}

function csvEscape(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates a provenance-stamped CSV export for a public or demo profile.
 */
export function buildProfileCsvExport(params: {
  profile: PublicProfileData;
  dataClass: DataClass;
  providerLabel: string;
  exportedAt?: string;
}): string {
  const exportedAt = params.exportedAt ?? new Date().toISOString();
  const { profile, dataClass, providerLabel } = params;

  const lines: string[] = [
    ['Section', 'Field', 'Value', 'DataClass', 'Source', 'ExportedAt'].join(','),
    [
      'Profile',
      'Username',
      `@${profile.username}`,
      dataClass,
      providerLabel,
      exportedAt,
    ]
      .map(csvEscape)
      .join(','),
    [
      'Profile',
      'DisplayName',
      profile.displayName,
      dataClass,
      providerLabel,
      exportedAt,
    ]
      .map(csvEscape)
      .join(','),
    [
      'Profile',
      'Followers',
      profile.followersCount,
      dataClass,
      providerLabel,
      exportedAt,
    ]
      .map(csvEscape)
      .join(','),
    [
      'Profile',
      'Following',
      profile.followingCount,
      dataClass,
      providerLabel,
      exportedAt,
    ]
      .map(csvEscape)
      .join(','),
    ['Profile', 'Posts', profile.postsCount, dataClass, providerLabel, exportedAt]
      .map(csvEscape)
      .join(','),
    [
      'Profile',
      'EstimatedEngagementRatePercent',
      profile.estimatedEngagementRate,
      dataClass === 'demo' ? 'demo' : 'estimate',
      providerLabel,
      exportedAt,
    ]
      .map(csvEscape)
      .join(','),
  ];

  for (const point of profile.historicalTrend) {
    lines.push(
      [
        'HistoricalSnapshot',
        point.date,
        `followers=${point.followers};posts=${point.posts};er=${point.engagementRate}%`,
        dataClass,
        providerLabel,
        exportedAt,
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  return lines.join('\n');
}

/**
 * Generates structured AI-style profile insights.
 * Uses a clearly labeled deterministic analytical template when no external LLM
 * API key is configured, ensuring transparent provenance.
 */
export function generateStructuredProfileInsights(params: {
  profile: PublicProfileData;
  dataClass: DataClass;
}): StructuredAiInsightReport {
  const { profile, dataClass } = params;
  const followers = profile.followersCount ?? 0;
  const er = profile.estimatedEngagementRate ?? 0;
  const cadence = profile.postingCadencePerWeek ?? 0;

  const trend = profile.historicalTrend;
  const firstPoint = trend[0];
  const lastPoint = trend[trend.length - 1];
  const netGrowth =
    firstPoint && lastPoint ? lastPoint.followers - firstPoint.followers : null;

  const strengths: string[] = [];
  const opportunities: string[] = [];
  const recommendedActions: string[] = [];

  if (er >= 3.5) {
    strengths.push(
      `Healthy estimated engagement rate (${er}%) relative to audience scale (${followers.toLocaleString()} followers).`
    );
  } else {
    opportunities.push(
      `Estimated engagement (${er}%) has room to expand through higher-save educational carousels and hook testing.`
    );
  }

  if (cadence >= 3.5) {
    strengths.push(
      `Consistent publishing cadence (~${cadence} posts/week) supports steady feed visibility.`
    );
  } else {
    opportunities.push(
      `Increasing publishing consistency toward 3–4 weekly posts can stabilize reach variance.`
    );
  }

  if (profile.externalUrl) {
    strengths.push('Bio includes an external destination link ready for traffic attribution.');
  } else {
    opportunities.push('No external URL detected — consider adding a clear bio link destination.');
  }

  if (netGrowth !== null && netGrowth > 0) {
    strengths.push(
      `Positive recorded audience trajectory (+${netGrowth.toLocaleString()} followers across ${trend.length} checkpoints).`
    );
  }

  recommendedActions.push(
    'Compare Reel vs. Carousel save rates over the next 4 weeks to double down on top retention format.',
    'Review posting calendar gaps and keep at least one high-utility evergreen carousel per week.',
    'Benchmark engagement deltas monthly against 2–3 direct niche peers in the Competitor view.'
  );

  return {
    username: profile.username,
    generatedAt: new Date().toISOString(),
    modelLabel:
      dataClass === 'demo'
        ? 'Structured Insight Template (Labeled Demo Profile)'
        : 'Structured Insight Template (Deterministic Fallback)',
    dataClass: dataClass === 'demo' ? 'demo' : 'estimate',
    executiveSummary: `@${profile.username} (${profile.category}) shows ${followers.toLocaleString()} followers with an estimated ${er}% engagement rate and ~${cadence} posts/week.`,
    strengths,
    opportunities,
    recommendedActions,
  };
}
