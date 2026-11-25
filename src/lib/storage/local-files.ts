import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface StoredFileMeta {
  key: string;
  sizeBytes: number;
  sha256: string;
  contentType: string;
  storedAt: string;
}

export interface FileStorageDriver {
  putObject(params: {
    namespace: string;
    ownerId: string;
    fileName: string;
    content: Buffer | string;
    contentType: string;
  }): Promise<StoredFileMeta>;
  getObject(key: string, ownerId: string): Promise<Buffer | null>;
  deleteObject(key: string, ownerId: string): Promise<boolean>;
  deleteOwnerNamespace(ownerId: string): Promise<void>;
}

function resolveStorageRoot(): string {
  const configured = process.env.VIEWORA_STORAGE_DIR || '.viewora-storage';
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function sanitizeSegment(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '_');
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new Error('Invalid storage path segment.');
  }
  return cleaned;
}

function assertInsideRoot(root: string, target: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (
    resolvedTarget !== resolvedRoot &&
    !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error('Path traversal attempt rejected by local file storage.');
  }
}

/**
 * Persistent local file storage abstraction replacing Supabase Storage.
 * Stores customer-scoped files (exports, data-export archives, avatars) under
 * VIEWORA_STORAGE_DIR (excluded from Git via .gitignore) with owner isolation
 * and strict path-traversal prevention.
 */
export class LocalFileStorage implements FileStorageDriver {
  private readonly rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir ?? resolveStorageRoot();
  }

  async putObject(params: {
    namespace: string;
    ownerId: string;
    fileName: string;
    content: Buffer | string;
    contentType: string;
  }): Promise<StoredFileMeta> {
    const safeOwner = sanitizeSegment(params.ownerId);
    const safeNs = sanitizeSegment(params.namespace);
    const safeFile = sanitizeSegment(params.fileName);
    const key = `${safeOwner}/${safeNs}/${safeFile}`;

    const fullPath = path.join(this.rootDir, safeOwner, safeNs, safeFile);
    assertInsideRoot(this.rootDir, fullPath);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const buffer = Buffer.isBuffer(params.content)
      ? params.content
      : Buffer.from(params.content, 'utf-8');
    const tmpPath = `${fullPath}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, fullPath);

    const sha256 = createHash('sha256').update(buffer).digest('hex');
    return {
      key,
      sizeBytes: buffer.byteLength,
      sha256,
      contentType: params.contentType,
      storedAt: new Date().toISOString(),
    };
  }

  async getObject(key: string, ownerId: string): Promise<Buffer | null> {
    const safeOwner = sanitizeSegment(ownerId);
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalizedKey.startsWith(`${safeOwner}/`)) {
      throw new Error('Cross-account file storage access denied.');
    }
    const parts = normalizedKey.split('/').map(sanitizeSegment);
    const fullPath = path.join(this.rootDir, ...parts);
    assertInsideRoot(this.rootDir, fullPath);

    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath);
  }

  async deleteObject(key: string, ownerId: string): Promise<boolean> {
    const safeOwner = sanitizeSegment(ownerId);
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalizedKey.startsWith(`${safeOwner}/`)) {
      throw new Error('Cross-account file storage deletion denied.');
    }
    const parts = normalizedKey.split('/').map(sanitizeSegment);
    const fullPath = path.join(this.rootDir, ...parts);
    assertInsideRoot(this.rootDir, fullPath);

    if (!fs.existsSync(fullPath)) return false;
    fs.unlinkSync(fullPath);
    return true;
  }

  async deleteOwnerNamespace(ownerId: string): Promise<void> {
    const safeOwner = sanitizeSegment(ownerId);
    const ownerDir = path.join(this.rootDir, safeOwner);
    assertInsideRoot(this.rootDir, ownerDir);
    if (fs.existsSync(ownerDir)) {
      fs.rmSync(ownerDir, { recursive: true, force: true });
    }
  }
}

export const defaultFileStorage = new LocalFileStorage();
