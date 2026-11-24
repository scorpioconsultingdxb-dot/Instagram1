export type DataClass = 'live' | 'cached' | 'estimate' | 'demo';

export type DataAvailability =
  | 'available'
  | 'partial'
  | 'unavailable'
  | 'private_account'
  | 'unauthorized';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'demo_only';

export type ProviderKind =
  | 'meta_official'
  | 'authorized_insights'
  | 'licensed_third_party'
  | 'permitted_public_dataset'
  | 'demo_fixture';

export interface DataFreshness {
  fetchedAt: string; // ISO-8601
  ttlSeconds: number;
  isStale: boolean;
}

export interface ProviderMetadata {
  providerId: string;
  providerKind: ProviderKind;
  providerLabel: string;
  availability: DataAvailability;
  dataClass: DataClass;
  confidence: ConfidenceLevel;
  freshness: DataFreshness;
  limitations: string[];
  notice: string;
}

export interface PublicPostSample {
  id: string;
  captionExcerpt: string;
  mediaType: 'image' | 'carousel' | 'reel';
  likes: number;
  comments: number;
  estimatedReach?: number;
  publishedAt: string;
  hashtags: string[];
}

export interface HistoricalMetricPoint {
  date: string; // YYYY-MM-DD
  followers: number;
  following: number;
  posts: number;
  engagementRate: number;
}

export interface PublicProfileData {
  username: string;
  displayName: string;
  bio: string;
  category: string;
  externalUrl: string | null;
  isVerified: boolean;
  isBusinessAccount: boolean;
  isPrivate: boolean;
  avatarInitials: string;
  avatarAccent: string;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  estimatedEngagementRate: number | null; // percentage e.g. 3.45
  postingCadencePerWeek: number | null;
  recentPosts: PublicPostSample[];
  historicalTrend: HistoricalMetricPoint[];
}

export interface StoryAvailabilityData {
  username: string;
  storiesSupported: boolean;
  activeStoryCount: number | null;
  reason: string;
  anonymityDisclosure: string;
}

export interface ProviderResponse<T> {
  data: T | null;
  meta: ProviderMetadata;
}

export interface ProviderHealth {
  providerId: string;
  providerKind: ProviderKind;
  providerLabel: string;
  configured: boolean;
  status: 'healthy' | 'degraded' | 'unavailable' | 'disabled';
  latencyMs: number | null;
  message: string;
  checkedAt: string;
}

export interface ProviderLookupOptions {
  allowDemoFallback?: boolean;
  connectedAccountAccessToken?: string;
}

export interface InstagramDataProvider {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly label: string;
  isConfigured(): boolean;
  checkHealth(): Promise<ProviderHealth>;
  getPublicProfile(
    username: string,
    options?: ProviderLookupOptions
  ): Promise<ProviderResponse<PublicProfileData>>;
  getStoryAvailability(
    username: string,
    options?: ProviderLookupOptions
  ): Promise<ProviderResponse<StoryAvailabilityData>>;
}
