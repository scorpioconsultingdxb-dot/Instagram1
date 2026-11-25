import fs from 'fs';
import path from 'path';

export interface BackupDirectorySummary {
  backupCount: number;
  latestFileName: string | null;
  latestSizeBytes: number | null;
  latestModifiedAt: string | null;
}

/**
 * Read-only summary of local database backups under `./backups`.
 * Exposes only filenames (no absolute host paths or credentials).
 */
export function getBackupDirectorySummary(): BackupDirectorySummary {
  try {
    const dir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(dir)) {
      return {
        backupCount: 0,
        latestFileName: null,
        latestSizeBytes: null,
        latestModifiedAt: null,
      };
    }
    const entries = fs
      .readdirSync(dir)
      .filter((name) => /\.(dump|sql)$/i.test(name))
      .map((name) => {
        const stat = fs.statSync(path.join(dir, name));
        return { name, size: stat.size, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    const latest = entries[0];
    return {
      backupCount: entries.length,
      latestFileName: latest?.name ?? null,
      latestSizeBytes: latest?.size ?? null,
      latestModifiedAt: latest ? new Date(latest.mtimeMs).toISOString() : null,
    };
  } catch {
    return {
      backupCount: 0,
      latestFileName: null,
      latestSizeBytes: null,
      latestModifiedAt: null,
    };
  }
}
