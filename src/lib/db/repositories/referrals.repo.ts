import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db/prisma';
import type {
  AffiliateApplicationRecord,
  ReferralAttributionRecord,
  ReferralCodeRecord,
} from '@/lib/referrals/service';

const ATTRIBUTION_WINDOW_DAYS = 30;

export async function getOrCreateDbReferralCode(
  ownerUserId: string,
  client: PrismaClient = getPrismaClient()
): Promise<ReferralCodeRecord> {
  const existing = await client.referralCode.findFirst({
    where: { ownerUserId },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    return {
      code: existing.code,
      ownerUserId: existing.ownerUserId,
      commissionPercent: Number(existing.commissionPercent),
      commissionMonths: existing.commissionMonths,
      payoutsEnabled: false,
      visitsCount: 0,
      createdAt: existing.createdAt.toISOString(),
    };
  }

  const suffix = ownerUserId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || 'VIEW01';
  let code = `VW-${suffix}`;
  const conflict = await client.referralCode.findUnique({ where: { code }, select: { id: true } });
  if (conflict) {
    code = `VW-${suffix}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
  }

  const created = await client.referralCode.create({
    data: {
      ownerUserId,
      code,
      commissionPercent: 25,
      commissionMonths: 12,
      payoutsEnabled: false,
    },
  });

  return {
    code: created.code,
    ownerUserId: created.ownerUserId,
    commissionPercent: Number(created.commissionPercent),
    commissionMonths: created.commissionMonths,
    payoutsEnabled: false,
    visitsCount: 0,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function findDbReferralCode(
  code: string,
  client: PrismaClient = getPrismaClient()
): Promise<ReferralCodeRecord | null> {
  const normalized = code.trim().toUpperCase();
  const row = await client.referralCode.findUnique({ where: { code: normalized } });
  if (!row) return null;
  return {
    code: row.code,
    ownerUserId: row.ownerUserId,
    commissionPercent: Number(row.commissionPercent),
    commissionMonths: row.commissionMonths,
    payoutsEnabled: false,
    visitsCount: 0,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function attributeDbReferral(
  input: {
    code: string;
    referredUserId: string;
    consentVerified: boolean;
    utmCampaign?: string;
  },
  client: PrismaClient = getPrismaClient()
): Promise<ReferralAttributionRecord | null> {
  const normalized = input.code.trim().toUpperCase();
  const ref = await client.referralCode.findUnique({ where: { code: normalized } });
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

  const existing = await client.referralAttribution.findUnique({
    where: { referredUserId: input.referredUserId },
  });
  if (existing) {
    return {
      code: ref.code,
      referredUserId: input.referredUserId,
      consentVerified: input.consentVerified,
      utmCampaign: input.utmCampaign,
      status: 'rejected_duplicate',
      createdAt: existing.createdAt.toISOString(),
    };
  }

  // Enforce attribution window relative to referred account creation
  const referredUser = await client.user.findUnique({
    where: { id: input.referredUserId },
    select: { createdAt: true },
  });
  if (referredUser) {
    const ageDays = (Date.now() - referredUser.createdAt.getTime()) / 86_400_000;
    if (ageDays > ATTRIBUTION_WINDOW_DAYS) {
      return {
        code: ref.code,
        referredUserId: input.referredUserId,
        consentVerified: input.consentVerified,
        utmCampaign: input.utmCampaign,
        status: 'rejected_duplicate',
        createdAt: new Date().toISOString(),
      };
    }
  }

  const created = await client.referralAttribution.create({
    data: {
      referralCodeId: ref.id,
      referredUserId: input.referredUserId,
      consentVerified: input.consentVerified,
      campaignName: input.utmCampaign ?? null,
      status: 'attributed_pending_billing',
    },
  });

  return {
    code: ref.code,
    referredUserId: created.referredUserId,
    consentVerified: created.consentVerified,
    utmCampaign: created.campaignName ?? undefined,
    status: 'attributed_pending_billing',
    createdAt: created.createdAt.toISOString(),
  };
}

function parseAffiliateNotes(notes: string): {
  organization: string;
  channelUrl: string;
  audienceNotes: string;
  reviewedBy?: string;
} {
  try {
    const parsed = JSON.parse(notes) as Partial<{
      organization: string;
      channelUrl: string;
      audienceNotes: string;
      reviewedBy?: string;
    }>;
    return {
      organization: parsed.organization || 'Partner Applicant',
      channelUrl: parsed.channelUrl || '',
      audienceNotes: parsed.audienceNotes || '',
      reviewedBy: parsed.reviewedBy,
    };
  } catch {
    return { organization: 'Partner Applicant', channelUrl: '', audienceNotes: notes };
  }
}

export async function submitDbAffiliateApplication(
  input: {
    userId: string;
    email: string;
    organization: string;
    channelUrl: string;
    audienceNotes: string;
  },
  client: PrismaClient = getPrismaClient()
): Promise<AffiliateApplicationRecord> {
  const packedNotes = JSON.stringify({
    organization: input.organization,
    channelUrl: input.channelUrl,
    audienceNotes: input.audienceNotes,
  });

  const row = await client.affiliateAccount.upsert({
    where: { userId: input.userId },
    update: {
      status: 'pending_review',
      payoutsEnabled: false,
      notes: packedNotes,
    },
    create: {
      userId: input.userId,
      tier: 'standard',
      status: 'pending_review',
      payoutsEnabled: false,
      notes: packedNotes,
    },
  });

  return {
    id: row.id,
    userId: row.userId,
    email: input.email,
    organization: input.organization,
    channelUrl: input.channelUrl,
    audienceNotes: input.audienceNotes,
    status: row.status as AffiliateApplicationRecord['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function reviewDbAffiliateApplication(
  id: string,
  status: 'approved_inactive_payouts' | 'declined',
  reviewedBy: string,
  client: PrismaClient = getPrismaClient()
): Promise<AffiliateApplicationRecord | null> {
  const existing = await client.affiliateAccount.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });
  if (!existing) return null;

  const meta = parseAffiliateNotes(existing.notes);
  const updated = await client.affiliateAccount.update({
    where: { id },
    data: {
      status,
      payoutsEnabled: false,
      notes: JSON.stringify({ ...meta, reviewedBy }),
    },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    email: existing.user.email,
    organization: meta.organization,
    channelUrl: meta.channelUrl,
    audienceNotes: meta.audienceNotes,
    status: updated.status as AffiliateApplicationRecord['status'],
    reviewedBy,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function getDbUserReferralDashboard(
  userId: string,
  client: PrismaClient = getPrismaClient()
) {
  const codeRecord = await getOrCreateDbReferralCode(userId, client);
  const codeRow = await client.referralCode.findUnique({
    where: { code: codeRecord.code },
    include: {
      attributions: { orderBy: { createdAt: 'desc' } },
    },
  });
  const aff = await client.affiliateAccount.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });

  const attributions: ReferralAttributionRecord[] = (codeRow?.attributions ?? []).map((a) => ({
    code: codeRecord.code,
    referredUserId: a.referredUserId,
    consentVerified: a.consentVerified,
    utmCampaign: a.campaignName ?? undefined,
    status: a.status as ReferralAttributionRecord['status'],
    createdAt: a.createdAt.toISOString(),
  }));

  const application: AffiliateApplicationRecord | null = aff
    ? (() => {
        const meta = parseAffiliateNotes(aff.notes);
        return {
          id: aff.id,
          userId: aff.userId,
          email: aff.user.email,
          organization: meta.organization,
          channelUrl: meta.channelUrl,
          audienceNotes: meta.audienceNotes,
          status: aff.status as AffiliateApplicationRecord['status'],
          reviewedBy: meta.reviewedBy,
          createdAt: aff.createdAt.toISOString(),
          updatedAt: aff.updatedAt.toISOString(),
        };
      })()
    : null;

  return {
    codeRecord,
    attributions,
    application,
    payoutsEnabled: false as const,
  };
}

export async function getDbReferralOverview(client: PrismaClient = getPrismaClient()) {
  const [codesCount, attributionsCount, affRows] = await Promise.all([
    client.referralCode.count(),
    client.referralAttribution.count(),
    client.affiliateAccount.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const applications: AffiliateApplicationRecord[] = affRows.map((aff) => {
    const meta = parseAffiliateNotes(aff.notes);
    return {
      id: aff.id,
      userId: aff.userId,
      email: aff.user.email,
      organization: meta.organization,
      channelUrl: meta.channelUrl,
      audienceNotes: meta.audienceNotes,
      status: aff.status as AffiliateApplicationRecord['status'],
      reviewedBy: meta.reviewedBy,
      createdAt: aff.createdAt.toISOString(),
      updatedAt: aff.updatedAt.toISOString(),
    };
  });

  return {
    payoutsEnabled: false as const,
    proposedCommissionPercent: 25,
    proposedCommissionMonths: 12,
    codesCount,
    attributionsCount,
    campaignsCount: 0,
    applications,
  };
}
