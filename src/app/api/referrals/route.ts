import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import {
  attributeReferral,
  createReferralCampaign,
  getUserReferralDashboard,
  submitAffiliateApplication,
} from '@/lib/referrals/service';

const referralActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_campaign'),
    name: z.string().trim().min(2).max(60),
    utmSource: z.string().trim().min(1).max(40),
    utmMedium: z.string().trim().min(1).max(40),
    utmCampaign: z
      .string()
      .trim()
      .min(2)
      .max(48)
      .regex(/^[a-z0-9_-]+$/i, 'Use letters, numbers, dashes, or underscores for utm_campaign.'),
  }),
  z.object({
    type: z.literal('apply_partner'),
    organization: z.string().trim().min(2).max(80),
    channelUrl: z.string().trim().url().max(200),
    audienceNotes: z.string().trim().min(10).max(500),
  }),
  z.object({
    type: z.literal('claim_code'),
    code: z.string().trim().min(4).max(24),
    consentVerified: z.boolean(),
    utmCampaign: z.string().trim().max(48).optional(),
  }),
]);

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  if (!isDatabaseConfigured() && !isLocalDevFallbackAllowed()) {
    return NextResponse.json({ ok: false, error: 'Storage is unavailable.' }, { status: 503 });
  }

  try {
    return NextResponse.json({
      ok: true,
      referral: getUserReferralDashboard(user.id),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Referral storage is temporarily unavailable.' },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }
  if (!isDatabaseConfigured() && !isLocalDevFallbackAllowed()) {
    return NextResponse.json({ ok: false, error: 'Storage is unavailable.' }, { status: 503 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = referralActionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid referral request.' },
      { status: 400 }
    );
  }

  const action = parsed.data;
  try {
    if (action.type === 'create_campaign') {
      const campaign = createReferralCampaign({
        ownerUserId: user.id,
        name: action.name,
        utmSource: action.utmSource,
        utmMedium: action.utmMedium,
        utmCampaign: action.utmCampaign,
      });
      return NextResponse.json(
        { ok: true, campaign, referral: getUserReferralDashboard(user.id) },
        { status: 201 }
      );
    }

    if (action.type === 'apply_partner') {
      const application = submitAffiliateApplication({
        userId: user.id,
        email: user.email,
        organization: action.organization,
        channelUrl: action.channelUrl,
        audienceNotes: action.audienceNotes,
      });
      return NextResponse.json(
        { ok: true, application, referral: getUserReferralDashboard(user.id) },
        { status: 201 }
      );
    }

    // claim_code
    if (!action.consentVerified) {
      return NextResponse.json(
        { ok: false, error: 'First-party attribution consent is required before claiming a referral code.' },
        { status: 400 }
      );
    }
    const attribution = attributeReferral({
      code: action.code,
      referredUserId: user.id,
      consentVerified: true,
      utmCampaign: action.utmCampaign,
    });
    if (!attribution) {
      return NextResponse.json({ ok: false, error: 'Referral code not found.' }, { status: 404 });
    }
    if (attribution.status !== 'attributed_pending_billing') {
      return NextResponse.json(
        {
          ok: false,
          error:
            attribution.status === 'rejected_self_referral'
              ? 'Self-referrals are automatically blocked.'
              : 'This account already has a recorded referral attribution.',
          attribution,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      attribution,
      referral: getUserReferralDashboard(user.id),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Referral storage is temporarily unavailable.' },
      { status: 503 }
    );
  }
}
