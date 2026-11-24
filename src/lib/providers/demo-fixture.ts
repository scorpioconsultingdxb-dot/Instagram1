import { getEnv } from '@/lib/env';
import type {
  InstagramDataProvider,
  ProviderHealth,
  ProviderResponse,
  PublicProfileData,
  StoryAvailabilityData,
} from './types';

/**
 * Curated demo fixtures strictly for development and clearly labeled previews.
 * NEVER masqueraded as live Instagram data: always returns dataClass: 'demo'.
 */
const DEMO_PROFILES: Record<string, PublicProfileData> = {
  'viewora.studio': {
    username: 'viewora.studio',
    displayName: 'Viewora Creative Studio (Demo)',
    bio: 'Demo sample brand showcasing transparent Instagram analytics, content cadence, and audience benchmarks. Visit our guide below.',
    category: 'Digital Design & Analytics',
    externalUrl: 'https://viewora.example/demo-studio',
    isVerified: true,
    isBusinessAccount: true,
    isPrivate: false,
    avatarInitials: 'VS',
    avatarAccent: '#4f46e5',
    followersCount: 48200,
    followingCount: 412,
    postsCount: 318,
    estimatedEngagementRate: 4.18,
    postingCadencePerWeek: 4.2,
    recentPosts: [
      {
        id: 'demo-post-1',
        captionExcerpt: 'Carousel breakdown: How clear hook slides lifted saves by 34% across Q3 campaigns. #instagramstrategy #contentdesign',
        mediaType: 'carousel',
        likes: 1840,
        comments: 142,
        estimatedReach: 29400,
        publishedAt: '2026-11-22T14:30:00.000Z',
        hashtags: ['#instagramstrategy', '#contentdesign', '#socialanalytics'],
      },
      {
        id: 'demo-post-2',
        captionExcerpt: 'Behind the scenes of our weekly analytics review checklist for small marketing teams. #marketingops #creatoreconomy',
        mediaType: 'reel',
        likes: 2290,
        comments: 188,
        estimatedReach: 41200,
        publishedAt: '2026-11-19T16:00:00.000Z',
        hashtags: ['#marketingops', '#creatoreconomy', '#reelsstrategy'],
      },
      {
        id: 'demo-post-3',
        captionExcerpt: 'Why consistent posting cadence beats sporadic viral spikes for long-term audience retention. #brandbuilding',
        mediaType: 'image',
        likes: 1410,
        comments: 96,
        estimatedReach: 21800,
        publishedAt: '2026-11-16T12:15:00.000Z',
        hashtags: ['#brandbuilding', '#socialmediatips'],
      },
    ],
    historicalTrend: [
      { date: '2026-06-01', followers: 41200, following: 398, posts: 242, engagementRate: 3.62 },
      { date: '2026-07-01', followers: 42450, following: 401, posts: 256, engagementRate: 3.74 },
      { date: '2026-08-01', followers: 43890, following: 405, posts: 271, engagementRate: 3.88 },
      { date: '2026-09-01', followers: 45120, following: 408, posts: 287, engagementRate: 3.95 },
      { date: '2026-10-01', followers: 46750, following: 410, posts: 302, engagementRate: 4.09 },
      { date: '2026-11-01', followers: 48200, following: 412, posts: 318, engagementRate: 4.18 },
    ],
  },
  'aurora.coffee': {
    username: 'aurora.coffee',
    displayName: 'Aurora Specialty Roasters (Demo)',
    bio: 'Small-batch Nordic-style coffee roastery. Brew guides, origin notes, and cafe openings. Order beans online.',
    category: 'Food & Beverage Brand',
    externalUrl: 'https://aurora-coffee.example',
    isVerified: false,
    isBusinessAccount: true,
    isPrivate: false,
    avatarInitials: 'AC',
    avatarAccent: '#b45309',
    followersCount: 19450,
    followingCount: 620,
    postsCount: 504,
    estimatedEngagementRate: 5.12,
    postingCadencePerWeek: 5.0,
    recentPosts: [
      {
        id: 'demo-coffee-1',
        captionExcerpt: 'Washed Ethiopian heirloom back on bar this Friday — tasting notes of bergamot and white peach. #specialtycoffee',
        mediaType: 'carousel',
        likes: 940,
        comments: 74,
        estimatedReach: 14800,
        publishedAt: '2026-11-23T09:00:00.000Z',
        hashtags: ['#specialtycoffee', '#coffeeroasters', '#pourover'],
      },
      {
        id: 'demo-coffee-2',
        captionExcerpt: '30-second espresso dial-in routine our baristas use every morning. #baristalife #espresso',
        mediaType: 'reel',
        likes: 1120,
        comments: 82,
        estimatedReach: 19200,
        publishedAt: '2026-11-20T11:20:00.000Z',
        hashtags: ['#baristalife', '#espresso', '#coffeereels'],
      },
    ],
    historicalTrend: [
      { date: '2026-06-01', followers: 16200, following: 590, posts: 420, engagementRate: 4.65 },
      { date: '2026-07-01', followers: 16890, following: 598, posts: 436, engagementRate: 4.78 },
      { date: '2026-08-01', followers: 17520, following: 604, posts: 454, engagementRate: 4.86 },
      { date: '2026-09-01', followers: 18110, following: 610, posts: 470, engagementRate: 4.94 },
      { date: '2026-10-01', followers: 18820, following: 615, posts: 488, engagementRate: 5.03 },
      { date: '2026-11-01', followers: 19450, following: 620, posts: 504, engagementRate: 5.12 },
    ],
  },
  'nordic.design': {
    username: 'nordic.design',
    displayName: 'Nordic Minimal Interiors (Demo)',
    bio: 'Curated Scandinavian architecture, natural light studies, and sustainable furniture makers. Submissions open.',
    category: 'Architecture & Interior Design',
    externalUrl: 'https://nordic-design.example',
    isVerified: true,
    isBusinessAccount: true,
    isPrivate: false,
    avatarInitials: 'ND',
    avatarAccent: '#0f766e',
    followersCount: 128400,
    followingCount: 285,
    postsCount: 892,
    estimatedEngagementRate: 2.94,
    postingCadencePerWeek: 6.5,
    recentPosts: [
      {
        id: 'demo-nordic-1',
        captionExcerpt: 'Warm oak joinery and lime-wash walls in a renovated 1930s Copenhagen apartment. #nordicdesign #minimalinterior',
        mediaType: 'carousel',
        likes: 3620,
        comments: 158,
        estimatedReach: 74000,
        publishedAt: '2026-11-22T17:45:00.000Z',
        hashtags: ['#nordicdesign', '#minimalinterior', '#scandinavianhome'],
      },
    ],
    historicalTrend: [
      { date: '2026-06-01', followers: 118500, following: 274, posts: 760, engagementRate: 2.75 },
      { date: '2026-07-01', followers: 120400, following: 276, posts: 785, engagementRate: 2.8 },
      { date: '2026-08-01', followers: 122300, following: 279, posts: 812, engagementRate: 2.84 },
      { date: '2026-09-01', followers: 124600, following: 281, posts: 838, engagementRate: 2.87 },
      { date: '2026-10-01', followers: 126500, following: 283, posts: 865, engagementRate: 2.91 },
      { date: '2026-11-01', followers: 128400, following: 285, posts: 892, engagementRate: 2.94 },
    ],
  },
  'solaris.fitness': {
    username: 'solaris.fitness',
    displayName: 'Solaris Mobility & Strength (Demo)',
    bio: 'Evidence-based mobility drills and strength programming for runners and desk athletes. Free 7-day plan in link.',
    category: 'Health & Fitness Creator',
    externalUrl: 'https://solaris-fitness.example',
    isVerified: false,
    isBusinessAccount: true,
    isPrivate: false,
    avatarInitials: 'SF',
    avatarAccent: '#be123c',
    followersCount: 74900,
    followingCount: 510,
    postsCount: 412,
    estimatedEngagementRate: 4.65,
    postingCadencePerWeek: 5.5,
    recentPosts: [
      {
        id: 'demo-fit-1',
        captionExcerpt: '5-minute hip opener sequence before tempo runs — save for your next warm-up. #runningmobility #strength',
        mediaType: 'reel',
        likes: 3180,
        comments: 214,
        estimatedReach: 58900,
        publishedAt: '2026-11-21T13:10:00.000Z',
        hashtags: ['#runningmobility', '#strength', '#runnersofinstagram'],
      },
    ],
    historicalTrend: [
      { date: '2026-06-01', followers: 63200, following: 480, posts: 340, engagementRate: 4.21 },
      { date: '2026-07-01', followers: 65800, following: 486, posts: 355, engagementRate: 4.33 },
      { date: '2026-08-01', followers: 68100, following: 492, posts: 370, engagementRate: 4.44 },
      { date: '2026-09-01', followers: 70500, following: 498, posts: 384, engagementRate: 4.51 },
      { date: '2026-10-01', followers: 72600, following: 504, posts: 398, engagementRate: 4.59 },
      { date: '2026-11-01', followers: 74900, following: 510, posts: 412, engagementRate: 4.65 },
    ],
  },
};

const DEMO_PRIVATE_HANDLES = new Set(['private.sample', 'private_account', 'locked.demo']);

export function getDemoFixtureUsernames(): string[] {
  return Object.keys(DEMO_PROFILES);
}

/**
 * Demo Fixture Provider.
 * Only serves curated, explicitly labeled demo profiles for UI evaluation and
 * local development. Unknown handles return an honest 'unavailable' response
 * rather than fabricating fake metrics for real Instagram users.
 */
export class DemoFixtureProvider implements InstagramDataProvider {
  readonly id = 'demo_fixture';
  readonly kind = 'demo_fixture' as const;
  readonly label = 'Viewora Demo Fixtures (Development / Preview Only)';

  isConfigured(): boolean {
    const env = getEnv();
    return env.VIEWORA_ENABLE_DEMO_PROVIDER !== 'false';
  }

  async checkHealth(): Promise<ProviderHealth> {
    const checkedAt = new Date().toISOString();
    const configured = this.isConfigured();
    return {
      providerId: this.id,
      providerKind: this.kind,
      providerLabel: this.label,
      configured,
      status: configured ? 'healthy' : 'disabled',
      latencyMs: configured ? 1 : null,
      message: configured
        ? `Serving ${Object.keys(DEMO_PROFILES).length} clearly labeled sample profiles for preview.`
        : 'Demo fixture provider is disabled via VIEWORA_ENABLE_DEMO_PROVIDER=false.',
      checkedAt,
    };
  }

  async getPublicProfile(username: string): Promise<ProviderResponse<PublicProfileData>> {
    const now = new Date().toISOString();
    const key = username.toLowerCase();

    if (DEMO_PRIVATE_HANDLES.has(key)) {
      return {
        data: null,
        meta: {
          providerId: this.id,
          providerKind: this.kind,
          providerLabel: this.label,
          availability: 'private_account',
          dataClass: 'demo',
          confidence: 'demo_only',
          freshness: { fetchedAt: now, ttlSeconds: 0, isStale: false },
          limitations: [
            'Viewora never accesses, unlocks, or bypasses private Instagram accounts.',
            'This response demonstrates how private accounts are handled transparently.',
          ],
          notice:
            'Demo private account state: Private Instagram profiles cannot be viewed or analyzed by Viewora.',
        },
      };
    }

    const fixture = DEMO_PROFILES[key];
    if (!fixture) {
      return {
        data: null,
        meta: {
          providerId: this.id,
          providerKind: this.kind,
          providerLabel: this.label,
          availability: 'unavailable',
          dataClass: 'demo',
          confidence: 'demo_only',
          freshness: { fetchedAt: now, ttlSeconds: 0, isStale: false },
          limitations: [
            'No live Instagram data provider (Official Meta API or Licensed Provider) is currently configured.',
            'Viewora will never fabricate metrics for real handles that have not been retrieved from an authorized source.',
            `Try a labeled demo sample handle (${getDemoFixtureUsernames().join(', ')}) to preview the interface.`,
          ],
          notice: `Live public data for @${key} is not currently available because no live provider is connected. Viewora does not invent profile statistics.`,
        },
      };
    }

    return {
      data: fixture,
      meta: {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        availability: 'available',
        dataClass: 'demo',
        confidence: 'demo_only',
        freshness: { fetchedAt: now, ttlSeconds: 86400, isStale: false },
        limitations: [
          'This profile is a clearly labeled Viewora demonstration fixture, NOT live Instagram data.',
          'Connect an official Meta Graph API or licensed third-party provider to retrieve real public profiles.',
        ],
        notice: 'Demonstration fixture loaded. All numbers shown are labeled sample data for preview purposes.',
      },
    };
  }

  async getStoryAvailability(
    username: string
  ): Promise<ProviderResponse<StoryAvailabilityData>> {
    const now = new Date().toISOString();
    const key = username.toLowerCase();
    const isDemoSample = Boolean(DEMO_PROFILES[key]);

    return {
      data: {
        username: key,
        storiesSupported: false,
        activeStoryCount: null,
        reason: isDemoSample
          ? 'Even for sample demo profiles, Viewora does not simulate unauthorized live Story downloads. Live Story viewing requires an authorized first-party Meta OAuth connection.'
          : 'Live third-party Instagram Stories cannot be retrieved anonymously without authorized account-owner access.',
        anonymityDisclosure:
          'Viewora communicates availability honestly: Story access is limited strictly to authorized or legitimately licensed sources and never bypasses Instagram privacy controls.',
      },
      meta: {
        providerId: this.id,
        providerKind: this.kind,
        providerLabel: this.label,
        availability: 'unavailable',
        dataClass: 'demo',
        confidence: 'demo_only',
        freshness: { fetchedAt: now, ttlSeconds: 0, isStale: false },
        limitations: [
          'Anonymous third-party Story scraping is not implemented.',
          'Only authorized account-owner insights or permitted sources are supported.',
        ],
        notice: 'Story retrieval is unavailable without an authorized data source.',
      },
    };
  }
}
