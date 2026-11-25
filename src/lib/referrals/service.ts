import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';

/**
 * Referral & Affiliate Architecture (Stage 28).
 * Proposed future commission: 25% of eligible subscription revenue for 12 months.
 * Commissions and payouts remain strictly DISABLED until explicit payment authorization.
 */

export interface ReferralCodeRecord {
  code: string;
  ownerUserId: string;
  commissionPercent: number;
  commissionMonths: number;
  payoutsEnabled: false;
  visitsCount: number;
  createdAt: string;
}

export interface ReferralAttributionRecord {
  code: string;
  referredUserId: string;
  consentVerified: boolean;
  utmCampaign?: string;
  status: 'attributed_pending_billing' | 'rejected_self_referral' | 'rejected_duplicate';
  createdAt: string;
}

export interface ReferralCampaignRecord {
  id: string;
  ownerUserId: string;
  code: string;
  name: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  clicks: number;
  createdAt: string;
}

export interface AffiliateApplicationRecord {
  id: string;
  userId: string;
  email: string;
  organization: string;
  channelUrl: string;
  audienceNotes: string;
  status: 'pending_review' | 'approved_inactive_payouts' | 'declined';
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface PersistedReferralStore {
  codes: Record<string, ReferralCodeRecord>;
  attributions: Record<string, ReferralAttributionRecord>;
  campaigns: ReferralCampaignRecord[];
  applications: AffiliateApplicationRecord[];
}

const REFERRAL_STORE = 'referrals-store.json';

function createEmptyStore(): PersistedReferralStore {
  return {
    codes: {},
    attributions: {},
    campaigns: [],
    applications: [],
  };
}

function loadStore(): PersistedReferralStore {
  return readJsonStore<PersistedReferralStore>(REFERRAL_STORE, createEmptyStore);
}

export function createReferralCode(ownerUserId: string): ReferralCodeRecord {
  const existingStore = loadStore();
  for (const existing of Object.values(existingStore.codes)) {
    if (existing.ownerUserId === ownerUserId) return existing;
  }

  const suffix = ownerUserId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || 'VIEW01';
  let code = `VW-${suffix}`;
  if (existingStore.codes[code] && existingStore.codes[code]!.ownerUserId !== ownerUserId) {
    code = `VW-${suffix}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
  }

  const record: ReferralCodeRecord = {
    code,
    ownerUserId,
    commissionPercent: 25,
    commissionMonths: 12,
    payoutsEnabled: false,
    visitsCount: 0,
    createdAt: new Date().toISOString(),
  };

  updateJsonStore<PersistedReferralStore>(REFERRAL_STORE, createEmptyStore, (current) => ({
    ...current,
    codes: { ...current.codes, [code]: record },
  }));

  return record;
}

export function getReferralCodeRecord(code: string): ReferralCodeRecord | null {
  const normalized = code.trim().toUpperCase();
  const store = loadStore();
  return store.codes[normalized] ?? null;
}

export function recordReferralLandingVisit(code: string, utmCampaign?: string): ReferralCodeRecord | null {
  const normalized = code.trim().toUpperCase();
  let updated: ReferralCodeRecord | null = null;
  updateJsonStore<PersistedReferralStore>(REFERRAL_STORE, createEmptyStore, (current) => {
    const ref = current.codes[normalized];
    if (!ref) return current;
    updated = { ...ref, visitsCount: (ref.visitsCount ?? 0) + 1 };
    const nextCampaigns = utmCampaign
      ? current.campaigns.map((c) =>
          c.code === normalized && c.utmCampaign === utmCampaign
            ? { ...c, clicks: c.clicks + 1 }
            : c
        )
      : current.campaigns;
    return {
      ...current,
      codes: { ...current.codes, [normalized]: updated },
      campaigns: nextCampaigns,
    };
  });
  return updated;
}

export function attributeReferral(input: {
  code: string;
  referredUserId: string;
  consentVerified: boolean;
  utmCampaign?: string;
}): ReferralAttributionRecord | null {
  const store = loadStore();
  const ref = store.codes[input.code.trim().toUpperCase()];
  if (!ref) return null;

  if (ref.ownerUserId === input.referredUserId) {
    return {
      code: ref.code,
      referredUserId: input.referredUserId,
      consentVerified: input.consentVerified,
      utmCampaign: input.utmCampaign,
      status: 'rejected_self_referral',
      createdAt: new Date().toISOString(),
    };
  }

  if (store.attributions[input.referredUserId]) {
    return {
      code: ref.code,
      referredUserId: input.referredUserId,
      consentVerified: input.consentVerified,
      utmCampaign: input.utmCampaign,
      status: 'rejected_duplicate',
      createdAt: new Date().toISOString(),
    };
  }

  const record: ReferralAttributionRecord = {
    code: ref.code,
    referredUserId: input.referredUserId,
    consentVerified: input.consentVerified,
    utmCampaign: input.utmCampaign,
    status: 'attributed_pending_billing',
    createdAt: new Date().toISOString(),
  };

  updateJsonStore<PersistedReferralStore>(REFERRAL_STORE, createEmptyStore, (current) => ({
    ...current,
    attributions: { ...current.attributions, [input.referredUserId]: record },
  }));

  return record;
}

export function createReferralCampaign(input: {
  ownerUserId: string;
  name: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}): ReferralCampaignRecord {
  const refCode = createReferralCode(input.ownerUserId);
  const campaign: ReferralCampaignRecord = {
    id: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ownerUserId: input.ownerUserId,
    code: refCode.code,
    name: input.name,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    clicks: 0,
    createdAt: new Date().toISOString(),
  };

  updateJsonStore<PersistedReferralStore>(REFERRAL_STORE, createEmptyStore, (current) => ({
    ...current,
    campaigns: [campaign, ...current.campaigns].slice(0, 100),
  }));

  return campaign;
}

export function submitAffiliateApplication(input: {
  userId: string;
  email: string;
  organization: string;
  channelUrl: string;
  audienceNotes: string;
}): AffiliateApplicationRecord {
  const now = new Date().toISOString();
  const app: AffiliateApplicationRecord = {
    id: `aff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: input.userId,
    email: input.email,
    organization: input.organization,
    channelUrl: input.channelUrl,
    audienceNotes: input.audienceNotes,
    status: 'pending_review',
    createdAt: now,
    updatedAt: now,
  };

  updateJsonStore<PersistedReferralStore>(REFERRAL_STORE, createEmptyStore, (current) => ({
    ...current,
    applications: [app, ...current.applications.filter((a) => a.userId !== input.userId)].slice(
      0,
      100
    ),
  }));
  return app;
}

export function reviewAffiliateApplication(
  id: string,
  status: 'approved_inactive_payouts' | 'declined',
  reviewedBy: string
): AffiliateApplicationRecord | null {
  let updated: AffiliateApplicationRecord | null = null;
  updateJsonStore<PersistedReferralStore>(REFERRAL_STORE, createEmptyStore, (current) => ({
    ...current,
    applications: current.applications.map((a) => {
      if (a.id !== id) return a;
      updated = { ...a, status, reviewedBy, updatedAt: new Date().toISOString() };
      return updated;
    }),
  }));
  return updated;
}

export function getUserReferralDashboard(userId: string) {
  const codeRecord = createReferralCode(userId);
  const store = loadStore();
  const myAttributions = Object.values(store.attributions).filter(
    (a) => a.code === codeRecord.code
  );
  const myCampaigns = store.campaigns.filter((c) => c.ownerUserId === userId);
  const myApplication = store.applications.find((a) => a.userId === userId) ?? null;

  return {
    codeRecord,
    attributions: myAttributions,
    campaigns: myCampaigns,
    application: myApplication,
    payoutsEnabled: false as const,
  };
}

export function getReferralOverview() {
  const store = loadStore();
  return {
    payoutsEnabled: false as const,
    proposedCommissionPercent: 25,
    proposedCommissionMonths: 12,
    codesCount: Object.keys(store.codes).length,
    attributionsCount: Object.keys(store.attributions).length,
    campaignsCount: store.campaigns.length,
    applications: store.applications,
  };
}
