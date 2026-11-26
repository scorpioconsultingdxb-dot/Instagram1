import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';
import { getRequiredAuthSecret } from '@/lib/auth/secret';

const ENVELOPE_PREFIX = 'v1';
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;
const HKDF_INFO = 'viewora:oauth-token-encryption:v1';
const HKDF_SALT = 'viewora-provider-token-salt-2026';

function deriveEncryptionKey(secretOverride?: string): Buffer {
  const master = secretOverride || getRequiredAuthSecret();
  return Buffer.from(
    hkdfSync('sha256', Buffer.from(master, 'utf8'), Buffer.from(HKDF_SALT, 'utf8'), Buffer.from(HKDF_INFO, 'utf8'), KEY_LENGTH_BYTES)
  );
}

/**
 * Encrypts sensitive OAuth access/refresh tokens at rest using AES-256-GCM
 * with HKDF-SHA256 derived key and per-token random 96-bit IV.
 * Envelope format: `v1:<ivHex>:<authTagHex>:<ciphertextHex>`
 */
export function encryptOAuthToken(plaintext: string, secretOverride?: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty OAuth token.');
  }
  const key = deriveEncryptionKey(secretOverride);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENVELOPE_PREFIX}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts and authenticates an AES-256-GCM OAuth token envelope.
 * Throws if tampered, malformed, or encrypted under a different key.
 */
export function decryptOAuthToken(envelope: string, secretOverride?: string): string {
  const parts = envelope.split(':');
  if (parts.length !== 4 || parts[0] !== ENVELOPE_PREFIX) {
    throw new Error('Malformed encrypted OAuth token envelope.');
  }
  const [, ivHex, tagHex, cipherHex] = parts;
  if (!ivHex || !tagHex || !cipherHex) {
    throw new Error('Incomplete encrypted OAuth token envelope.');
  }
  const key = deriveEncryptionKey(secretOverride);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
