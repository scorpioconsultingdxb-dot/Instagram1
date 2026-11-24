/**
 * Referral & Affiliate Architecture (Section 34).
 * Proposed future commission: 25% of eligible subscription revenue for 12 months.
 * Commissions and payouts remain strictly DISABLED until Phase 7 payment authorization.
 */

export interface ReferralCodeRecord {
  code: string;
  ownerUserId: string;
  commissionPercent: number;
  commissionMonths: number;
  payoutsEnabled: false;
  createdAt: string;
}

export interface ReferralAttributionRecord {
  code: string;
  referredUserId: string;
  consentVerified: boolean;
  status: 'attributed_pending_billing' | 'rejected_self_referral' | 'rejected_duplicate';
  createdAt: string;
}

const codesByCode = new Map<string, ReferralCodeRecord>();
const attributionsByReferredUser = new Map<string, ReferralAttributionRecord>();

export function createReferralCode(ownerUserId: string): ReferralCodeRecord {
  for (const existing of codesByCode.values()) {
    if (existing.ownerUserId === ownerUserId) return existing;
  }

  const suffix = ownerUserId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || 'VIEW01';
  const code = `VW-${suffix}`;
  const record: ReferralCodeRecord = {
    code,
    ownerUserId,
    commissionPercent: 25,
    commissionMonths: 12,
    payoutsEnabled: false,
    createdAt: new Date().toISOString(),
  };
  codesByCode.set(code, record);
  return record;
}

export function attributeReferral(input: {
  code: string;
  referredUserId: string;
  consentVerified: boolean;
}): ReferralAttributionRecord | null {
  const ref = codesByCode.get(input.code.toUpperCase());
  if (!ref) return null;

  if (ref.ownerUserId === input.referredUserId) {
    return {
      code: ref.code,
      referredUserId: input.referredUserId,
      consentVerified: input.consentVerified,
      status: 'rejected_self_referral',
      createdAt: new Date().toISOString(),
    };
  }

  if (attributionsByReferredUser.has(input.referredUserId)) {
    return {
      code: ref.code,
      referredUserId: input.referredUserId,
      consentVerified: input.consentVerified,
      status: 'rejected_duplicate',
      createdAt: new Date().toISOString(),
    };
  }

  const record: ReferralAttributionRecord = {
    code: ref.code,
    referredUserId: input.referredUserId,
    consentVerified: input.consentVerified,
    status: 'attributed_pending_billing',
    createdAt: new Date().toISOString(),
  };
  attributionsByReferredUser.set(input.referredUserId, record);
  return record;
}

export function getReferralOverview() {
  return {
    payoutsEnabled: false,
    proposedCommissionPercent: 25,
    proposedCommissionMonths: 12,
    codesCount: codesByCode.size,
    attributionsCount: attributionsByReferredUser.size,
  };
}
