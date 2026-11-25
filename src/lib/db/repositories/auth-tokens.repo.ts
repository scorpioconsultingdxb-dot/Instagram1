import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '@/lib/db/prisma';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
} from '@/lib/db/repositories/users.repo';

const RESET_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutes
const VERIFY_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export async function issuePasswordResetToken(
  email: string,
  client: PrismaClient = getPrismaClient()
): Promise<{ issued: boolean; rawToken?: string; userId?: string; expiresAt?: Date }> {
  const user = await client.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, accountStatus: true },
  });

  // Protection against account enumeration: caller always returns the same response
  if (!user || user.accountStatus !== 'active') {
    return { issued: false };
  }

  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await client.$transaction(async (tx) => {
    // Invalidate any previous unused reset tokens for this user
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: token.hash,
        expiresAt,
      },
    });
  });

  return { issued: true, rawToken: token.raw, userId: user.id, expiresAt };
}

export async function consumePasswordResetToken(
  rawToken: string,
  newPassword: string,
  client: PrismaClient = getPrismaClient()
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const tokenHash = hashOpaqueToken(rawToken.trim());
  const record = await client.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.consumedAt || record.expiresAt.getTime() <= Date.now()) {
    return { ok: false, error: 'Password reset token is invalid or has expired.' };
  }

  const nextHash = await hashPassword(newPassword);
  const now = new Date();

  await client.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { consumedAt: now },
    });
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash: nextHash },
    });
    // Revoke all active sessions after password reset
    await tx.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: now },
    });
  });

  return { ok: true, userId: record.userId };
}

export async function issueEmailVerificationToken(
  userId: string,
  client: PrismaClient = getPrismaClient()
): Promise<{ rawToken: string; expiresAt: Date }> {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

  await client.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: token.hash,
        expiresAt,
      },
    });
  });

  return { rawToken: token.raw, expiresAt };
}

export async function consumeEmailVerificationToken(
  rawToken: string,
  client: PrismaClient = getPrismaClient()
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const tokenHash = hashOpaqueToken(rawToken.trim());
  const record = await client.emailVerificationToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.consumedAt || record.expiresAt.getTime() <= Date.now()) {
    return { ok: false, error: 'Email verification token is invalid or has expired.' };
  }

  const now = new Date();
  await client.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({
      where: { id: record.id },
      data: { consumedAt: now },
    });
    await tx.user.update({
      where: { id: record.userId },
      data: { emailVerified: now },
    });
  });

  return { ok: true, userId: record.userId };
}
