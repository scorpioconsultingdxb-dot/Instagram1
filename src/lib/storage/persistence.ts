import fs from 'fs';
import path from 'path';

function resolveDataDir(): string {
  return process.env.VIEWORA_DATA_DIR || path.join(process.cwd(), '.viewora-data');
}

function resolveFilePath(storeName: string): string {
  const safeName = storeName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dir = resolveDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, safeName.endsWith('.json') ? safeName : `${safeName}.json`);
}

export function readJsonStore<T>(storeName: string, fallback: () => T): T {
  const filePath = resolveFilePath(storeName);
  try {
    if (!fs.existsSync(filePath)) {
      return fallback();
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return fallback();
    return JSON.parse(raw) as T;
  } catch {
    return fallback();
  }
}

export function writeJsonStore<T>(storeName: string, data: T): void {
  const filePath = resolveFilePath(storeName);
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
  const serialized = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmpPath, serialized, 'utf-8');
  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        fs.renameSync(tmpPath, filePath);
        return;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException | null)?.code;
        lastError = err;
        if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') {
          throw err;
        }
        // Fallback overwrite on final retry for Windows transient file-handle contention
        if (attempt === 3) {
          fs.writeFileSync(filePath, serialized, 'utf-8');
          try {
            fs.unlinkSync(tmpPath);
          } catch {
            // ignore cleanup failure
          }
          return;
        }
      }
    }
    throw lastError;
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // ignore cleanup failure
    }
    throw err;
  }
}

export function updateJsonStore<T>(
  storeName: string,
  fallback: () => T,
  updater: (current: T) => T
): T {
  const current = readJsonStore(storeName, fallback);
  const next = updater(current);
  writeJsonStore(storeName, next);
  return next;
}
