export type ToolSlug =
  | 'instagram-viewer'
  | 'instagram-story-viewer'
  | 'instagram-profile-analyzer'
  | 'instagram-engagement-calculator'
  | 'instagram-follower-growth'
  | 'instagram-bio-analyzer'
  | 'instagram-hashtag-generator'
  | 'instagram-competitor-analysis'
  | 'instagram-influencer-analyzer'
  | 'instagram-post-analyzer'
  | 'instagram-caption-generator'
  | 'instagram-content-ideas';

export type ToolMode = 'functional_calculator' | 'public_provider_lookup' | 'authorized_status_check';

export interface ToolDefinition {
  slug: ToolSlug;
  name: string;
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
  category: 'Viewer' | 'Analytics' | 'Optimization' | 'Research' | 'Creation';
  mode: ToolMode;
  dataDisclosure: string;
  educationalBody: string;
  faqs: Array<{ q: string; a: string }>;
}

const LEGACY_SLUG_MAP: Record<string, ToolSlug> = {
  'anonymous-viewer': 'instagram-viewer',
  'story-viewer': 'instagram-story-viewer',
  'profile-analyzer': 'instagram-profile-analyzer',
  'engagement-calculator': 'instagram-engagement-calculator',
  'follower-growth-checker': 'instagram-follower-growth',
  'bio-analyzer': 'instagram-bio-analyzer',
  'hashtag-generator': 'instagram-hashtag-generator',
  'competitor-comparison': 'instagram-competitor-analysis',
  'influencer-analyzer': 'instagram-influencer-analyzer',
  'post-performance-analyzer': 'instagram-post-analyzer',
};

export const FREE_TOOLS: readonly ToolDefinition[] = [
  {
    slug: 'instagram-viewer',
    name: 'Anonymous Public Instagram Viewer',
    shortDescription:
      'Explore legitimately available public Instagram profile details without signing into Instagram.',
    seoTitle: 'Public Instagram Viewer — Explore Profiles Without Signing In',
    seoDescription:
      'Inspect publicly accessible Instagram profile information transparently with Viewora. No Instagram password required and zero private-account access.',
    category: 'Viewer',
    mode: 'public_provider_lookup',
    dataDisclosure:
      'Only surfaces public data returned by configured official/licensed providers or explicitly labeled Viewora demo fixtures. Private accounts are never accessed.',
    educationalBody:
      'Use Viewora’s public profile viewer to inspect verified public business and creator metadata, recent public posts, and bio positioning without logging into an Instagram account.',
    faqs: [
      {
        q: 'Can Viewora open private Instagram profiles?',
        a: 'No. Viewora strictly respects privacy boundaries and never accesses, unlocks, or bypasses private accounts.',
      },
      {
        q: 'Why do some profiles show Unavailable or Demo Data?',
        a: 'Viewora labels every source honestly (LIVE, CACHED, ESTIMATED, DEMO, UNAVAILABLE). When no live provider covers a handle, we show an honest unavailable notice rather than fabricating data.',
      },
    ],
  },
  {
    slug: 'instagram-story-viewer',
    name: 'Instagram Story Viewer',
    shortDescription:
      'Check authorized Story availability with honest privacy, Meta API scope, and anonymity disclosures.',
    seoTitle: 'Instagram Story Viewer — Authorized Availability & Privacy Disclosure',
    seoDescription:
      'Verify legitimate Instagram Story availability through authorized Meta OAuth connections with transparent limitations.',
    category: 'Viewer',
    mode: 'authorized_status_check',
    dataDisclosure:
      'Meta’s official APIs restrict Story media strictly to authorized account owners. Viewora does not scrape third-party Stories or simulate anonymous playback.',
    educationalBody:
      'Unlike tools that claim unsupported anonymous Story downloads, Viewora clearly communicates what official Meta APIs allow: first-party Story analytics for Instagram Business and Creator accounts you authorize.',
    faqs: [
      {
        q: 'Can Viewora anonymously view someone else’s Instagram Stories?',
        a: 'No. Official Instagram APIs only provide Story insights to the authorized account owner. Viewora does not perform unauthorized scraping.',
      },
    ],
  },
  {
    slug: 'instagram-profile-analyzer',
    name: 'Instagram Profile Analyzer',
    shortDescription:
      'Audit public profile health, follower-to-following balance, bio clarity, and engagement benchmarks.',
    seoTitle: 'Instagram Profile Analyzer — Free Public Account Audit',
    seoDescription:
      'Analyze public Instagram profile structure, estimated engagement rate, posting cadence, and optimization opportunities.',
    category: 'Analytics',
    mode: 'public_provider_lookup',
    dataDisclosure:
      'Profile audit ratings are transparently labeled as ESTIMATED based on legitimately returned public or demo profile fields.',
    educationalBody:
      'A healthy Instagram profile balances clear positioning, consistent publishing cadence, and strong interaction depth relative to audience tier.',
    faqs: [
      {
        q: 'What signals are evaluated in a profile audit?',
        a: 'Follower-to-following ratio, estimated engagement benchmark by tier, bio link presence, and public posting frequency.',
      },
    ],
  },
  {
    slug: 'instagram-engagement-calculator',
    name: 'Instagram Engagement Calculator',
    shortDescription:
      'Compute accurate engagement rate by followers and by reach with instant creator tier benchmarks.',
    seoTitle: 'Instagram Engagement Rate Calculator — Free Benchmark Tool',
    seoDescription:
      'Calculate Instagram engagement rate from likes, comments, saves, shares, followers, and reach using transparent public formulas.',
    category: 'Analytics',
    mode: 'functional_calculator',
    dataDisclosure:
      'Computes exact ratios directly from your entered metrics. Benchmark ranges are clearly labeled transparent industry estimates.',
    educationalBody:
      'Engagement Rate by Reach (ERR) measures how compelling a post is to people who actually saw it, while Engagement Rate by Followers (ERF) enables consistent benchmarking across public accounts.',
    faqs: [
      {
        q: 'Which formula does the engagement calculator use?',
        a: 'ER by Followers = ((Likes + Comments + Saves + Shares) / Followers) × 100. When reach is provided, ER by Reach divides total interactions by Reach.',
      },
    ],
  },
  {
    slug: 'instagram-follower-growth',
    name: 'Instagram Follower Growth Checker',
    shortDescription:
      'Measure net follower velocity, growth percentage, and estimated days to reach your next milestone.',
    seoTitle: 'Instagram Follower Growth Checker — Velocity & Milestone Estimator',
    seoDescription:
      'Calculate Instagram follower growth rate, daily net gain, 30-day projection, and milestone timelines.',
    category: 'Analytics',
    mode: 'functional_calculator',
    dataDisclosure:
      'Growth velocity and milestone timelines are deterministic mathematical estimates based on your entered period. Automatic historical snapshots require saving profiles in the dashboard.',
    educationalBody:
      'Tracking rolling 30-day and 90-day net follower velocity reveals whether content experiments produce compounding audience growth rather than temporary spikes.',
    faqs: [
      {
        q: 'Can Viewora track historical follower counts automatically?',
        a: 'Yes. Save eligible public or authorized accounts inside the Viewora dashboard to build verified historical snapshots over time.',
      },
    ],
  },
  {
    slug: 'instagram-bio-analyzer',
    name: 'Instagram Bio Analyzer',
    shortDescription:
      'Score any Instagram bio across the 150-character limit, CTA clarity, readability, and link readiness.',
    seoTitle: 'Instagram Bio Analyzer — Free Bio Optimization Scorer',
    seoDescription:
      'Evaluate your Instagram bio for character efficiency, clear call-to-action, line breaks, and discoverability.',
    category: 'Optimization',
    mode: 'functional_calculator',
    dataDisclosure:
      'Runs deterministic text diagnostics directly on your input bio without requiring any Instagram credentials.',
    educationalBody:
      'Visitors decide whether to follow or click your bio link in under three seconds. Clear value propositions, scannable line breaks, and a single concrete CTA consistently outperform cluttered bios.',
    faqs: [
      {
        q: 'What is the maximum length of an Instagram bio?',
        a: 'Instagram bios allow up to 150 characters, including spaces, line breaks, and emojis.',
      },
    ],
  },
  {
    slug: 'instagram-hashtag-generator',
    name: 'Instagram Hashtag Generator',
    shortDescription:
      'Generate balanced Broad, Niche, and Community hashtag sets tailored to your topic and category.',
    seoTitle: 'Instagram Hashtag Generator — Broad, Niche & Community Sets',
    seoDescription:
      'Build focused, non-spammy Instagram hashtag sets organized by competition tier with one-click copy.',
    category: 'Optimization',
    mode: 'functional_calculator',
    dataDisclosure:
      'Tag sets are heuristic recommendations derived from your topic keywords and selected niche category.',
    educationalBody:
      'Combining 2–3 broad discovery tags with 4–6 hyper-specific niche and community tags improves topic categorization without triggering spam signals.',
    faqs: [
      {
        q: 'How many hashtags work best per post?',
        a: 'Most brands see cleaner topic relevance with 5 to 12 tightly focused hashtags rather than stuffing 30 unrelated tags.',
      },
    ],
  },
  {
    slug: 'instagram-competitor-analysis',
    name: 'Instagram Competitor Analysis',
    shortDescription:
      'Compare public Instagram accounts side by side across audience size, engagement rate, and cadence.',
    seoTitle: 'Instagram Competitor Analysis — Free Side-by-Side Benchmarking',
    seoDescription:
      'Benchmark competing Instagram accounts across followers, engagement deltas, and weekly posting cadence.',
    category: 'Research',
    mode: 'public_provider_lookup',
    dataDisclosure:
      'Compares labeled demo profiles or your own entered public benchmark metrics. Continuous monitoring is available on Premium+ plans.',
    educationalBody:
      'Benchmarking against 2–3 direct peers helps distinguish platform-wide reach shifts from account-specific content wins.',
    faqs: [
      {
        q: 'How many competitors can I track continuously in Viewora?',
        a: 'Premium, Pro, and Agency plans unlock multi-profile competitor comparison groups inside the customer dashboard.',
      },
    ],
  },
  {
    slug: 'instagram-influencer-analyzer',
    name: 'Instagram Influencer Analyzer',
    shortDescription:
      'Classify creator tiers (Nano to Mega), check engagement health, and estimate campaign reach bands.',
    seoTitle: 'Instagram Influencer Analyzer — Creator Tier & Reach Estimator',
    seoDescription:
      'Evaluate Instagram creators by tier, engagement benchmark, posting consistency, and estimated sponsored reach.',
    category: 'Research',
    mode: 'functional_calculator',
    dataDisclosure:
      'Creator tier, readiness score, and estimated reach ranges are transparent formulas calculated from your supplied metrics.',
    educationalBody:
      'Before sponsoring a creator, pair follower tier with engagement rate and publishing consistency to forecast realistic reach rather than relying on vanity follower counts.',
    faqs: [
      {
        q: 'How does Viewora classify influencer tiers?',
        a: 'Nano (<10K), Micro (10K–50K), Mid-Tier (50K–250K), Macro (250K–1M), and Mega (1M+ followers).',
      },
    ],
  },
  {
    slug: 'instagram-post-analyzer',
    name: 'Instagram Post Performance Analyzer',
    shortDescription:
      'Diagnose single-post likes, comments, saves, shares, and reach to identify high-resonance content.',
    seoTitle: 'Instagram Post Analyzer — Save Rate & Share Rate Diagnostics',
    seoDescription:
      'Analyze individual Instagram posts and Reels across engagement rate by reach, save rate, share rate, and interaction mix.',
    category: 'Analytics',
    mode: 'functional_calculator',
    dataDisclosure:
      'Computes exact performance ratios from your entered post numbers alongside transparent benchmark heuristics.',
    educationalBody:
      'Saves measure educational/reference value while shares measure social resonance — tracking both alongside reach pinpoints formats worth repeating.',
    faqs: [
      {
        q: 'What is a strong Instagram save rate?',
        a: 'A save rate of 2% or higher relative to post reach generally indicates strong reference value.',
      },
    ],
  },
  {
    slug: 'instagram-caption-generator',
    name: 'Instagram Caption Generator',
    shortDescription:
      'Draft structured high-clarity Instagram captions tailored by topic, brand tone, and call-to-action.',
    seoTitle: 'Instagram Caption Generator — Free Hook & CTA Writer',
    seoDescription:
      'Generate scroll-stopping Instagram caption drafts (Short Hook, Storyteller, Educational) tailored to your niche and goal.',
    category: 'Creation',
    mode: 'functional_calculator',
    dataDisclosure:
      'Generates deterministic, editable caption drafts directly from your prompt inputs with zero external login required.',
    educationalBody:
      'Strong captions open with a concise first-line hook before the "more" truncation cut, deliver concrete value in short paragraphs, and close with a single frictionless prompt.',
    faqs: [
      {
        q: 'Can I customize the generated captions for my brand voice?',
        a: 'Yes. Select Professional, Conversational, Educational, or Bold tone and copy any draft directly into your content calendar.',
      },
    ],
  },
  {
    slug: 'instagram-content-ideas',
    name: 'Instagram Content Ideas Generator',
    shortDescription:
      'Generate actionable Reel, Carousel, and Story content ideas mapped to audience goals and KPIs.',
    seoTitle: 'Instagram Content Ideas Generator — Reels & Carousel Planner',
    seoDescription:
      'Discover structured Instagram content ideas for Reels, Carousels, and single posts tailored to your niche and growth goal.',
    category: 'Creation',
    mode: 'functional_calculator',
    dataDisclosure:
      'Produces deterministic, strategy-backed content frameworks based on your selected niche, audience, and objective.',
    educationalBody:
      'A balanced Instagram calendar pairs Discovery Reels (reach), Deep-Dive Carousels (saves), and Community Prompts (comments & DMs) every week.',
    faqs: [
      {
        q: 'Which Instagram formats are included?',
        a: 'Every generated plan balances Reels for reach, Carousels for saves, and Single/Story prompts for community trust.',
      },
    ],
  },
] as const;

export function resolveCanonicalToolSlug(slug: string): ToolSlug | null {
  const direct = FREE_TOOLS.find((t) => t.slug === slug);
  if (direct) return direct.slug;
  return LEGACY_SLUG_MAP[slug] ?? null;
}

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  const canonical = resolveCanonicalToolSlug(slug);
  if (!canonical) return undefined;
  return FREE_TOOLS.find((t) => t.slug === canonical);
}

export function getAllToolSlugs(): ToolSlug[] {
  return FREE_TOOLS.map((t) => t.slug);
}
