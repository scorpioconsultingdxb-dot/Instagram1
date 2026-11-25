import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient, setTxRlsContext } from '@/lib/db/prisma';
import { defaultFileStorage } from '@/lib/storage/local-files';
import type {
  BillingInterval,
  CustomerSegment,
  PlanCode,
  UserRole,
} from '@/lib/entitlements/types';

export const BCRYPT_COST_FACTOR = 12;
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface EmailPreferencesRecord {
  productUpdates: boolean;
  weeklyDigest: boolean;
  trackingAlerts: boolean;
  marketing: boolean;
}

export interface DbSessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  segment: CustomerSegment;
  planCode: PlanCode;
  billingInterval: BillingInterval;
  onboardingCompleted: boolean;
  emailVerified: string | null;
  emailPreferences: EmailPreferencesRecord;
  createdAt: string;
  authMode: 'database' | 'local_demo';
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_COST_FACTOR);
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  if (!plainPassword || !passwordHash) return false;
  return bcrypt.compare(plainPassword, passwordHash);
}

export function hashOpaqueToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function generateOpaqueToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  return { raw, hash: hashOpaqueToken(raw) };
}

function normalizeEmailPrefs(raw: unknown): EmailPreferencesRecord {
  const obj = raw && typeof raw === 'object' ? (raw as Partial<EmailPreferencesRecord>) : {};
  return {
    productUpdates: Boolean(obj.productUpdates),
    weeklyDigest: Boolean(obj.weeklyDigest),
    trackingAlerts: obj.trackingAlerts ?? true,
    marketing: Boolean(obj.marketing),
  };
}

function mapUserToSessionUser(user: {
  id: string;
  email: string;
  fullName: string;
  name: string | null;
  role: string;
  segment: string;
  onboardingCompleted: boolean;
  emailVerified: Date | null;
  emailPreferences: unknown;
  createdAt: Date;
  subscriptions?: Array<{
    billingInterval: string;
    plan: { code: string };
  }>;
}): DbSessionUser {
  const latestSub = user.subscriptions?.[0];
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName || user.name || user.email,
    role: (user.role as UserRole) || 'user',
    segment: (user.segment as CustomerSegment) || 'personal',
    planCode: (latestSub?.plan?.code as PlanCode) || 'free',
    billingInterval: (latestSub?.billingInterval as BillingInterval) || 'monthly',
    onboardingCompleted: Boolean(user.onboardingCompleted),
    emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
    emailPreferences: normalizeEmailPrefs(user.emailPreferences),
    createdAt: user.createdAt.toISOString(),
    authMode: 'database',
  };
}

export async function findUserByEmail(
  email: string,
  client: PrismaClient = getPrismaClient()
) {
  return client.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: {
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { plan: { select: { code: true } } },
      },
    },
  });
}

export async function getDbSessionUserById(
  userId: string,
  client: PrismaClient = getPrismaClient()
): Promise<DbSessionUser | null> {
  const user = await client.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { plan: { select: { code: true } } },
      },
    },
  });
  if (!user || user.accountStatus !== 'active') return null;
  return mapUserToSessionUser(user);
}

export async function verifyDbUserCredentials(
  email: string,
  plainPassword: string,
  client: PrismaClient = getPrismaClient()
): Promise<DbSessionUser | null> {
  const user = await findUserByEmail(email, client);
  if (!user || user.accountStatus !== 'active' || !user.passwordHash) {
    // Run dummy compare to reduce timing side-channel for account enumeration
    await bcrypt.compare(
      plainPassword,
      '$2b$12$C6UzMDM.H6dfI/f/IKcEeO6N8aH2x6sY8m2S5qQ4qF5yK6w1nE0xG'
    );
    return null;
  }
  const matches = await verifyPassword(plainPassword, user.passwordHash);
  if (!matches) return null;
  return mapUserToSessionUser(user);
}

/**
 * Atomically registers a new user under the restricted `viewora_app` role:
 *   1. Creates the `User` row (pre-context).
 *   2. Immediately sets transaction-local PostgreSQL RLS identity (`setTxRlsContext`).
 *   3. Inserts `UserPreference`, default `Workspace`, `WorkspaceMember(owner)`,
 *      default `ResearchFolder`, Free `Subscription`, welcome `Notification`,
 *      `EmailVerificationToken`, and `ConsentRecord` inside the same transaction.
 * NEVER inserts demo Instagram profiles for real customers.
 */
export async function registerUserWithWorkspace(
  input: {
    email: string;
    password: string;
    fullName: string;
    segment: CustomerSegment;
    preferredLocale: string;
    emailPreferences: EmailPreferencesRecord;
  },
  client: PrismaClient = getPrismaClient()
): Promise<
  | { ok: true; user: DbSessionUser; verificationTokenRaw: string }
  | { ok: false; code: 'EMAIL_EXISTS' | 'ERROR'; error: string }
> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await client.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) {
    return {
      ok: false,
      code: 'EMAIL_EXISTS',
      error: 'Unable to complete registration with the provided email address.',
    };
  }

  const passwordHash = await hashPassword(input.password);
  const verificationToken = generateOpaqueToken();
  const verificationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

  try {
    const created = await client.$transaction(async (tx) => {
      // Step 1: Create User before RLS context exists
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: input.fullName.trim(),
          name: input.fullName.trim(),
          role: 'user',
          accountStatus: 'active',
          segment: input.segment,
          preferredLocale: input.preferredLocale,
          onboardingCompleted: true,
          emailPreferences: input.emailPreferences as unknown as Prisma.InputJsonValue,
        },
      });

      // Step 2: Establish transaction-local RLS context for all tenant-owned inserts
      await setTxRlsContext(tx, { userId: user.id, role: 'user' });

      // Step 3: Initialize RLS-protected customer records under restricted viewora_app
      await tx.userPreference.create({
        data: {
          userId: user.id,
          workspaceName: 'Personal Workspace',
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          ownerId: user.id,
          name: 'Personal Workspace',
          slug: `ws-${user.id.replace(/-/g, '').slice(0, 12)}`,
          segment: input.segment,
          isDefault: true,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          memberRole: 'owner',
        },
      });

      await tx.researchFolder.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          name: 'General Research',
          color: 'violet',
          description: 'Default folder for saved public profiles.',
        },
      });

      const freePlan = await tx.plan.findUnique({ where: { code: 'free' } });
      if (freePlan) {
        await tx.subscription.create({
          data: {
            userId: user.id,
            workspaceId: workspace.id,
            planId: freePlan.id,
            billingInterval: 'monthly',
            status: 'active',
            paymentProvider: 'disabled',
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: user.id,
          title: 'Your private Viewora workspace is ready',
          body: 'Save an eligible public profile, organize research folders, or customize your Personal Digital Headquarters.',
          category: 'system',
          actionUrl: '/dashboard/profiles',
        },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: verificationToken.hash,
          expiresAt: verificationExpiresAt,
        },
      });

      await tx.consentRecord.create({
        data: {
          userId: user.id,
          consentType: 'terms_and_privacy',
          granted: true,
          policyVersion: '2026-11',
        },
      });

      return user;
    });

    return {
      ok: true,
      user: mapUserToSessionUser({ ...created, subscriptions: [] }),
      verificationTokenRaw: verificationToken.raw,
    };
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'P2002') {
      return {
        ok: false,
        code: 'EMAIL_EXISTS',
        error: 'Unable to complete registration with the provided email address.',
      };
    }
    throw err;
  }
}

export async function createDbSession(
  params: {
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    ttlMs?: number;
  },
  client: PrismaClient = getPrismaClient()
): Promise<{ rawToken: string; expires: Date }> {
  const token = generateOpaqueToken();
  const expires = new Date(Date.now() + (params.ttlMs ?? SESSION_TTL_MS));
  await client.session.create({
    data: {
      sessionToken: token.hash,
      userId: params.userId,
      expires,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
  return { rawToken: token.raw, expires };
}

/**
 * Authoritative PostgreSQL session resolver.
 * Validates on EVERY request:
 *   - Token hash matches an existing `sessions` row
 *   - Session is not revoked (`revokedAt === null`)
 *   - Session is not expired (`expires > now`)
 *   - User exists and `accountStatus === 'active'` (suspended/deleted rejected immediately)
 *   - Returns fresh `role` and `planCode` from PostgreSQL (role removal takes effect immediately)
 */
export async function resolveDbSessionByRawToken(
  rawToken: string,
  client: PrismaClient = getPrismaClient()
): Promise<DbSessionUser | null> {
  if (!rawToken) return null;
  const tokenHash = hashOpaqueToken(rawToken);
  const session = await client.session.findUnique({
    where: { sessionToken: tokenHash },
    include: {
      user: {
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { plan: { select: { code: true } } },
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expires.getTime() <= Date.now()) {
    return null;
  }
  if (!session.user || session.user.accountStatus !== 'active') {
    return null;
  }
  return mapUserToSessionUser(session.user);
}

export async function revokeDbSessionByRawToken(
  rawToken: string,
  client: PrismaClient = getPrismaClient()
): Promise<boolean> {
  if (!rawToken) return false;
  const tokenHash = hashOpaqueToken(rawToken);
  const res = await client.session.updateMany({
    where: { sessionToken: tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

export async function revokeAllDbUserSessions(
  userId: string,
  exceptRawToken?: string,
  client: PrismaClient = getPrismaClient()
): Promise<number> {
  const exceptHash = exceptRawToken ? hashOpaqueToken(exceptRawToken) : undefined;
  const res = await client.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptHash ? { sessionToken: { not: exceptHash } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return res.count;
}

export async function suspendDbUserAccount(
  userId: string,
  client: PrismaClient = getPrismaClient()
): Promise<void> {
  const now = new Date();
  await client.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { accountStatus: 'suspended' },
    });
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  });
}

export async function reactivateDbUserAccount(
  userId: string,
  client: PrismaClient = getPrismaClient()
): Promise<void> {
  await client.user.update({
    where: { id: userId },
    data: { accountStatus: 'active' },
  });
}

export async function changeDbUserPassword(
  params: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    keepCurrentSessionRawToken?: string;
  },
  client: PrismaClient = getPrismaClient()
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await client.user.findUnique({
    where: { id: params.userId },
    select: { id: true, passwordHash: true, accountStatus: true },
  });
  if (!user || user.accountStatus !== 'active' || !user.passwordHash) {
    return { ok: false, error: 'Account credentials unavailable.' };
  }
  const validCurrent = await verifyPassword(params.currentPassword, user.passwordHash);
  if (!validCurrent) {
    return { ok: false, error: 'Current password is incorrect.' };
  }

  const nextHash = await hashPassword(params.newPassword);
  await client.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: params.userId },
      data: { passwordHash: nextHash },
    });
    const exceptHash = params.keepCurrentSessionRawToken
      ? hashOpaqueToken(params.keepCurrentSessionRawToken)
      : undefined;
    await tx.session.updateMany({
      where: {
        userId: params.userId,
        revokedAt: null,
        ...(exceptHash ? { sessionToken: { not: exceptHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  });

  return { ok: true };
}

export async function updateDbAccountPreferences(
  userId: string,
  patch: { segment?: CustomerSegment; emailPreferences?: EmailPreferencesRecord },
  client: PrismaClient = getPrismaClient()
): Promise<void> {
  await client.user.update({
    where: { id: userId },
    data: {
      ...(patch.segment ? { segment: patch.segment } : {}),
      ...(patch.emailPreferences
        ? { emailPreferences: patch.emailPreferences as unknown as Prisma.InputJsonValue }
        : {}),
      onboardingCompleted: true,
    },
  });
}

export async function listDbAdminUsers(
  client: PrismaClient = getPrismaClient()
): Promise<DbSessionUser[]> {
  const rows = await client.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { plan: { select: { code: true } } },
      },
    },
  });
  return rows.map(mapUserToSessionUser);
}

export async function persistDbAdminUserUpdate(
  userId: string,
  patch: { role?: UserRole; planCode?: PlanCode },
  client: PrismaClient = getPrismaClient()
): Promise<{ ok: true } | { ok: false; error: string }> {
  const target = await client.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) {
    return { ok: false, error: 'Target user not found.' };
  }

  await client.$transaction(async (tx) => {
    if (patch.role) {
      await tx.user.update({
        where: { id: userId },
        data: { role: patch.role },
      });
    }

    if (patch.planCode) {
      const plan = await tx.plan.findUnique({ where: { code: patch.planCode } });
      if (!plan) {
        throw new Error(`Plan "${patch.planCode}" not found in database.`);
      }
      const latestSub = await tx.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (latestSub) {
        await tx.subscription.update({
          where: { id: latestSub.id },
          data: { planId: plan.id },
        });
      } else {
        await tx.subscription.create({
          data: {
            userId,
            planId: plan.id,
            billingInterval: 'monthly',
            status: 'active',
            paymentProvider: 'disabled',
          },
        });
      }
    }
  });

  return { ok: true };
}

export async function deleteDbUserAccount(
  userId: string,
  email: string,
  client: PrismaClient = getPrismaClient()
): Promise<void> {
  await client.$transaction(async (tx) => {
    await setTxRlsContext(tx, { userId, role: 'user' });
    await tx.accountDeletionRequest.create({
      data: {
        userId: null,
        email,
        status: 'completed',
        processedAt: new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: null,
        actorEmail: email,
        action: 'user.account.deleted',
        targetType: 'user',
        targetId: userId,
        diff: { selfServiceDeletion: true, deletedUserId: userId },
      },
    });
    await tx.user.delete({ where: { id: userId } });
  });

  await defaultFileStorage.deleteOwnerNamespace(userId).catch(() => undefined);
}
