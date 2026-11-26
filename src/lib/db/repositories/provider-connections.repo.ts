import type { PrismaClient } from '@prisma/client';
import { getPrismaClient, withUserRlsContext } from '@/lib/db/prisma';
import { decryptOAuthToken, encryptOAuthToken } from '@/lib/security/token-crypto';

export interface ProviderConnectionSummary {
  id: string;
  providerId: string;
  workspaceId: string;
  externalAccountId: string;
  externalUsername: string | null;
  grantedScopes: string[];
  tokenExpiresAt: string | null;
  isExpired: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lists connected external provider accounts for the authenticated owner.
 * STRICTLY NEVER returns encrypted or decrypted tokens to client callers.
 */
export async function listUserProviderConnections(
  userId: string,
  client: PrismaClient = getPrismaClient()
): Promise<ProviderConnectionSummary[]> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const rows = await tx.providerConnection.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
      const now = Date.now();
      return rows.map((r) => ({
        id: r.id,
        providerId: r.providerId,
        workspaceId: r.workspaceId,
        externalAccountId: r.externalAccountId,
        externalUsername: r.externalUsername,
        grantedScopes: r.grantedScopes,
        tokenExpiresAt: r.tokenExpiresAt ? r.tokenExpiresAt.toISOString() : null,
        isExpired: Boolean(r.tokenExpiresAt && r.tokenExpiresAt.getTime() <= now),
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    },
    client
  );
}

/**
 * Encrypts OAuth token with AES-256-GCM and persists it strictly inside the owner's RLS context.
 */
export async function upsertUserProviderConnection(
  input: {
    userId: string;
    workspaceId?: string;
    providerId: string;
    externalAccountId: string;
    externalUsername?: string | null;
    grantedScopes: string[];
    rawAccessToken: string;
    tokenExpiresAt: Date | null;
  },
  client: PrismaClient = getPrismaClient()
): Promise<ProviderConnectionSummary> {
  const encryptedAccessToken = encryptOAuthToken(input.rawAccessToken);

  return withUserRlsContext(
    { userId: input.userId, role: 'user' },
    async (tx) => {
      let workspaceId = input.workspaceId;
      if (!workspaceId) {
        const ws = await tx.workspace.findFirst({
          where: { ownerId: input.userId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (!ws) throw new Error('No workspace available for connected account.');
        workspaceId = ws.id;
      }

      const saved = await tx.providerConnection.upsert({
        where: {
          workspaceId_providerId_externalAccountId: {
            workspaceId,
            providerId: input.providerId,
            externalAccountId: input.externalAccountId,
          },
        },
        update: {
          externalUsername: input.externalUsername ?? null,
          grantedScopes: input.grantedScopes,
          encryptedAccessToken,
          tokenExpiresAt: input.tokenExpiresAt,
          status: 'active',
        },
        create: {
          userId: input.userId,
          workspaceId,
          providerId: input.providerId,
          externalAccountId: input.externalAccountId,
          externalUsername: input.externalUsername ?? null,
          grantedScopes: input.grantedScopes,
          encryptedAccessToken,
          tokenExpiresAt: input.tokenExpiresAt,
          status: 'active',
        },
      });

      return {
        id: saved.id,
        providerId: saved.providerId,
        workspaceId: saved.workspaceId,
        externalAccountId: saved.externalAccountId,
        externalUsername: saved.externalUsername,
        grantedScopes: saved.grantedScopes,
        tokenExpiresAt: saved.tokenExpiresAt ? saved.tokenExpiresAt.toISOString() : null,
        isExpired: Boolean(saved.tokenExpiresAt && saved.tokenExpiresAt.getTime() <= Date.now()),
        status: saved.status,
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      };
    },
    client
  );
}

/**
 * Retrieves and decrypts an active, non-expired OAuth token ONLY for its verified owner.
 * Never returns tokens belonging to another user.
 */
export async function getDecryptedConnectionTokenForOwner(
  userId: string,
  connectionId: string,
  client: PrismaClient = getPrismaClient()
): Promise<{ ok: true; accessToken: string; grantedScopes: string[]; externalAccountId: string } | { ok: false; reason: string }> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const row = await tx.providerConnection.findFirst({
        where: { id: connectionId, userId },
      });
      if (!row) return { ok: false, reason: 'Connected account not found or unauthorized.' };
      if (row.status !== 'active') return { ok: false, reason: `Connection status is "${row.status}".` };
      if (!row.encryptedAccessToken) return { ok: false, reason: 'No OAuth token stored.' };
      if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() <= Date.now()) {
        return { ok: false, reason: 'OAuth token has expired and requires refresh or re-authorization.' };
      }
      return {
        ok: true,
        accessToken: decryptOAuthToken(row.encryptedAccessToken),
        grantedScopes: row.grantedScopes,
        externalAccountId: row.externalAccountId,
      };
    },
    client
  );
}

/**
 * Disconnects a connected account and scrubs its encrypted token immediately.
 */
export async function disconnectUserProviderConnection(
  userId: string,
  connectionId: string,
  client: PrismaClient = getPrismaClient()
): Promise<boolean> {
  return withUserRlsContext(
    { userId, role: 'user' },
    async (tx) => {
      const res = await tx.providerConnection.updateMany({
        where: { id: connectionId, userId },
        data: {
          status: 'revoked',
          encryptedAccessToken: null,
          tokenExpiresAt: null,
        },
      });
      return res.count > 0;
    },
    client
  );
}

/**
 * Handles asynchronous provider revocation / deauthorization webhooks (e.g. Meta deauth callback)
 * by wiping stored tokens immediately.
 */
export async function revokeProviderConnectionByExternalId(
  providerId: string,
  externalAccountId: string,
  client: PrismaClient = getPrismaClient()
): Promise<number> {
  const res = await client.providerConnection.updateMany({
    where: { providerId, externalAccountId },
    data: {
      status: 'revoked',
      encryptedAccessToken: null,
      tokenExpiresAt: null,
    },
  });
  return res.count;
}
