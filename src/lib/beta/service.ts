import { createHash, randomBytes } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db/prisma';
import { isDatabaseConfigured } from '@/lib/env';

export type BetaSegment = 'personal' | 'creator' | 'marketing_pro' | 'business' | 'agency';
export type BetaDefectSeverity = 'S0_critical' | 'S1_high' | 'S2_medium' | 'S3_low';

export interface BetaInviteRecord {
  id: string;
  codeHash: string;
  codePreview: string; // e.g. VWR-XXXX (prefix only; full code never re-exposed)
  segment: BetaSegment;
  maxUses: number;
  usedCount: number;
  active: boolean;
  createdByEmail: string;
  createdAt: string;
}

export interface BetaApplicationRecord {
  id: string;
  email: string;
  fullName: string;
  segment: BetaSegment;
  organization: string;
  inviteId: string | null;
  status: 'approved_invited' | 'waitlisted' | 'declined';
  goals: string;
  createdAt: string;
}

export interface BetaProgramState {
  publicRegistrationOpen: boolean;
  invites: BetaInviteRecord[];
  applications: BetaApplicationRecord[];
  updatedAt: string;
}

const BETA_SETTING_KEY = 'beta_program_state_v1';

export function isBetaPublicRegistrationOpen(): boolean {
  // Strictly closed (invite-only) until owner explicitly enables BETA_PUBLIC_REGISTRATION_ENABLED=true
  return process.env.BETA_PUBLIC_REGISTRATION_ENABLED === 'true';
}

export function hashBetaInviteCode(rawCode: string): string {
  return createHash('sha256').update(rawCode.trim().toUpperCase()).digest('hex');
}

function emptyBetaState(): BetaProgramState {
  return {
    publicRegistrationOpen: isBetaPublicRegistrationOpen(),
    invites: [],
    applications: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export async function loadBetaProgramState(client?: PrismaClient): Promise<BetaProgramState> {
  if (!isDatabaseConfigured() && !client) return emptyBetaState();
  const db = client ?? getPrismaClient();
  const row = await db.systemSetting.findUnique({ where: { key: BETA_SETTING_KEY } });
  const raw = row?.value as Partial<BetaProgramState> | null;
  return {
    publicRegistrationOpen: isBetaPublicRegistrationOpen(),
    invites: Array.isArray(raw?.invites) ? raw!.invites : [],
    applications: Array.isArray(raw?.applications) ? raw!.applications : [],
    updatedAt: raw?.updatedAt ?? new Date(0).toISOString(),
  };
}

async function saveBetaProgramState(
  state: BetaProgramState,
  client?: PrismaClient
): Promise<BetaProgramState> {
  const next: BetaProgramState = { ...state, updatedAt: new Date().toISOString() };
  if (!isDatabaseConfigured() && !client) return next;
  const db = client ?? getPrismaClient();
  await db.systemSetting.upsert({
    where: { key: BETA_SETTING_KEY },
    update: { value: next as unknown as Prisma.InputJsonValue },
    create: { key: BETA_SETTING_KEY, value: next as unknown as Prisma.InputJsonValue },
  });
  return next;
}

export async function createBetaInviteCode(
  params: {
    segment: BetaSegment;
    maxUses: number;
    createdByEmail: string;
  },
  client?: PrismaClient
): Promise<{ rawCode: string; invite: BetaInviteRecord }> {
  const token = randomBytes(4).toString('hex').toUpperCase();
  const rawCode = `VWR-${token.slice(0, 4)}-${token.slice(4, 8)}`;
  const invite: BetaInviteRecord = {
    id: `inv-${Date.now()}-${randomBytes(3).toString('hex')}`,
    codeHash: hashBetaInviteCode(rawCode),
    codePreview: `VWR-${token.slice(0, 4)}-****`,
    segment: params.segment,
    maxUses: Math.max(1, Math.min(100, params.maxUses)),
    usedCount: 0,
    active: true,
    createdByEmail: params.createdByEmail,
    createdAt: new Date().toISOString(),
  };
  const current = await loadBetaProgramState(client);
  await saveBetaProgramState({ ...current, invites: [invite, ...current.invites].slice(0, 200) }, client);
  return { rawCode, invite };
}

export async function redeemOrSubmitBetaAccess(
  input: {
    email: string;
    fullName: string;
    segment: BetaSegment;
    organization?: string;
    inviteCode?: string;
    goals: string;
  },
  client?: PrismaClient
): Promise<
  | { ok: true; application: BetaApplicationRecord; inviteMatched: boolean }
  | { ok: false; code: 'BETA_CLOSED' | 'INVALID_INVITE'; error: string }
> {
  const current = await loadBetaProgramState(client);
  const cleanCode = (input.inviteCode ?? '').trim();

  let matchedInvite: BetaInviteRecord | undefined;
  if (cleanCode) {
    const hash = hashBetaInviteCode(cleanCode);
    matchedInvite = current.invites.find(
      (i) => i.codeHash === hash && i.active && i.usedCount < i.maxUses
    );
    if (!matchedInvite) {
      return {
        ok: false,
        code: 'INVALID_INVITE',
        error: 'Invitation code is invalid, revoked, or has reached its redemption limit.',
      };
    }
  } else if (!current.publicRegistrationOpen) {
    return {
      ok: false,
      code: 'BETA_CLOSED',
      error:
        'Viewora Controlled Beta is currently invitation-only (BETA_PUBLIC_REGISTRATION_ENABLED=false). Enter an owner-issued invitation code to request access.',
    };
  }

  const application: BetaApplicationRecord = {
    id: `beta-${Date.now()}-${randomBytes(3).toString('hex')}`,
    email: input.email.trim().toLowerCase(),
    fullName: input.fullName.trim(),
    segment: matchedInvite?.segment ?? input.segment,
    organization: (input.organization ?? '').trim(),
    inviteId: matchedInvite?.id ?? null,
    status: matchedInvite ? 'approved_invited' : 'waitlisted',
    goals: input.goals.trim(),
    createdAt: new Date().toISOString(),
  };

  const nextInvites = matchedInvite
    ? current.invites.map((i) =>
        i.id === matchedInvite!.id ? { ...i, usedCount: i.usedCount + 1 } : i
      )
    : current.invites;

  await saveBetaProgramState(
    {
      ...current,
      invites: nextInvites,
      applications: [application, ...current.applications].slice(0, 1000),
    },
    client
  );

  return { ok: true, application, inviteMatched: Boolean(matchedInvite) };
}
