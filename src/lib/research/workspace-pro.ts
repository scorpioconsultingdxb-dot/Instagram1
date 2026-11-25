import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';
import type { PublicProfileData } from '@/lib/providers/types';

export type ResearchProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface ResearchProjectRecord {
  id: string;
  title: string;
  objective: string;
  status: ResearchProjectStatus;
  parentProjectId: string | null; // supports nested collections
  pinned: boolean;
  favorite: boolean;
  tags: string[];
  profileUsernames: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedSearchFilterRecord {
  id: string;
  name: string;
  query: string;
  tag: string;
  status: ResearchProjectStatus | 'all';
  minFollowers: number | null;
  createdAt: string;
}

export interface ResearchHistoryEntry {
  id: string;
  action:
    | 'project_created'
    | 'project_updated'
    | 'project_archived'
    | 'project_restored'
    | 'csv_imported'
    | 'filter_saved'
    | 'bulk_tagged'
    | 'manual_entry';
  label: string;
  createdAt: string;
}

export interface UserResearchProState {
  userId: string;
  projects: ResearchProjectRecord[];
  savedFilters: SavedSearchFilterRecord[];
  history: ResearchHistoryEntry[];
  updatedAt: string;
}

const RESEARCH_PRO_STORE = 'research-pro.json';
export const MAX_CSV_IMPORT_BYTES = 512 * 1024; // 512 KB
export const MAX_CSV_IMPORT_ROWS = 250;

function createInitialState(userId: string): UserResearchProState {
  return {
    userId,
    projects: [],
    savedFilters: [],
    history: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function getUserResearchProState(userId: string): UserResearchProState {
  const all = readJsonStore<Record<string, UserResearchProState>>(RESEARCH_PRO_STORE, () => ({}));
  return all[userId] ?? createInitialState(userId);
}

export function updateUserResearchProState(
  userId: string,
  updater: (current: UserResearchProState) => UserResearchProState
): UserResearchProState {
  let saved!: UserResearchProState;
  updateJsonStore<Record<string, UserResearchProState>>(
    RESEARCH_PRO_STORE,
    () => ({}),
    (all) => {
      const current = all[userId] ?? createInitialState(userId);
      const next = updater(current);
      saved = {
        ...next,
        userId,
        history: next.history.slice(0, 40),
        updatedAt: new Date().toISOString(),
      };
      return { ...all, [userId]: saved };
    }
  );
  return saved;
}

export function pushHistory(
  history: ResearchHistoryEntry[],
  action: ResearchHistoryEntry['action'],
  label: string
): ResearchHistoryEntry[] {
  return [
    {
      id: `rh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action,
      label,
      createdAt: new Date().toISOString(),
    },
    ...history,
  ].slice(0, 40);
}

// ============================================================================
// Safe User-Provided CSV Importer (RFC-4180 parser + strict validation)
// ============================================================================

export interface ParsedCsvResearchRow {
  rowNumber: number;
  username: string;
  displayName: string;
  category: string;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  estimatedEngagementRate: number | null;
  tags: string[];
  notes: string;
  duplicate: boolean;
}

export interface CsvImportValidationResult {
  ok: boolean;
  error?: string;
  headers: string[];
  validRows: ParsedCsvResearchRow[];
  duplicateRows: ParsedCsvResearchRow[];
  issues: Array<{ rowNumber: number; message: string }>;
  truncated: boolean;
}

function stripFormulaLead(raw: string): string {
  const trimmed = raw.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return trimmed.replace(/^[=+\-@\t\r]+/, '').trim();
  }
  return trimmed;
}

function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function parseOptionalInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s_]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function parseOptionalFloat(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[%\s,]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Number(n.toFixed(2));
}

const USERNAME_RE = /^[a-z0-9._]{2,30}$/i;

export function parseResearchCsvImport(
  csvText: string,
  existingUsernames: string[] = []
): CsvImportValidationResult {
  const bytes = Buffer.byteLength(csvText, 'utf8');
  if (bytes === 0) {
    return {
      ok: false,
      error: 'CSV input is empty.',
      headers: [],
      validRows: [],
      duplicateRows: [],
      issues: [],
      truncated: false,
    };
  }
  if (bytes > MAX_CSV_IMPORT_BYTES) {
    return {
      ok: false,
      error: `CSV exceeds maximum size of ${Math.round(MAX_CSV_IMPORT_BYTES / 1024)} KB.`,
      headers: [],
      validRows: [],
      duplicateRows: [],
      issues: [],
      truncated: false,
    };
  }

  const matrix = parseCsvLines(csvText);
  if (matrix.length < 2) {
    return {
      ok: false,
      error: 'CSV must contain a header row and at least one data row.',
      headers: matrix[0] ?? [],
      validRows: [],
      duplicateRows: [],
      issues: [],
      truncated: false,
    };
  }

  const headers = matrix[0]!.map((h) => h.trim().toLowerCase());
  const colIndex = (candidates: string[]) =>
    headers.findIndex((h) => candidates.includes(h));

  const idxUsername = colIndex(['username', 'handle', 'account', 'instagram_username']);
  if (idxUsername === -1) {
    return {
      ok: false,
      error: 'Missing required "username" (or "handle") column in CSV header.',
      headers,
      validRows: [],
      duplicateRows: [],
      issues: [],
      truncated: false,
    };
  }

  const idxDisplayName = colIndex(['display_name', 'displayname', 'name', 'title']);
  const idxCategory = colIndex(['category', 'niche', 'industry']);
  const idxFollowers = colIndex(['followers', 'followers_count', 'followerscount']);
  const idxFollowing = colIndex(['following', 'following_count', 'followingcount']);
  const idxPosts = colIndex(['posts', 'posts_count', 'postscount']);
  const idxEr = colIndex(['engagement_rate', 'er', 'estimated_engagement_rate']);
  const idxTags = colIndex(['tags', 'labels']);
  const idxNotes = colIndex(['notes', 'private_note', 'note']);

  const existingSet = new Set(existingUsernames.map((u) => u.trim().toLowerCase()));
  const seenInCsv = new Set<string>();
  const dataRows = matrix.slice(1);
  const truncated = dataRows.length > MAX_CSV_IMPORT_ROWS;
  const bounded = dataRows.slice(0, MAX_CSV_IMPORT_ROWS);

  const validRows: ParsedCsvResearchRow[] = [];
  const duplicateRows: ParsedCsvResearchRow[] = [];
  const issues: Array<{ rowNumber: number; message: string }> = [];

  bounded.forEach((cols, index) => {
    const rowNumber = index + 2;
    const rawUser = stripFormulaLead((cols[idxUsername] ?? '').replace(/^@/, '')).toLowerCase();
    if (!USERNAME_RE.test(rawUser)) {
      issues.push({
        rowNumber,
        message: `Invalid username "${cols[idxUsername] ?? ''}". Must be 2–30 alphanumeric, dot, or underscore characters.`,
      });
      return;
    }

    const displayName =
      stripFormulaLead(idxDisplayName >= 0 ? (cols[idxDisplayName] ?? '') : '') || rawUser;
    const category =
      stripFormulaLead(idxCategory >= 0 ? (cols[idxCategory] ?? '') : '') || 'User-Provided Entry';
    const tags = (idxTags >= 0 ? (cols[idxTags] ?? '') : '')
      .split(/[;|]/)
      .map((t) => stripFormulaLead(t).toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 28)
      .slice(0, 8);
    const notes = stripFormulaLead(idxNotes >= 0 ? (cols[idxNotes] ?? '') : '').slice(0, 800);

    const isDuplicate = existingSet.has(rawUser) || seenInCsv.has(rawUser);
    seenInCsv.add(rawUser);

    const parsedRow: ParsedCsvResearchRow = {
      rowNumber,
      username: rawUser,
      displayName: displayName.slice(0, 80),
      category: category.slice(0, 60),
      followersCount: idxFollowers >= 0 ? parseOptionalInt(cols[idxFollowers]) : null,
      followingCount: idxFollowing >= 0 ? parseOptionalInt(cols[idxFollowing]) : null,
      postsCount: idxPosts >= 0 ? parseOptionalInt(cols[idxPosts]) : null,
      estimatedEngagementRate: idxEr >= 0 ? parseOptionalFloat(cols[idxEr]) : null,
      tags,
      notes,
      duplicate: isDuplicate,
    };

    if (isDuplicate) {
      duplicateRows.push(parsedRow);
    } else {
      validRows.push(parsedRow);
    }
  });

  return {
    ok: true,
    headers,
    validRows,
    duplicateRows,
    issues,
    truncated,
  };
}

export function buildUserProvidedProfileData(row: ParsedCsvResearchRow): PublicProfileData {
  const initials = row.displayName
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return {
    username: row.username,
    displayName: row.displayName,
    bio: row.notes || 'User-provided research dataset entry (not fetched from live Instagram API).',
    category: row.category,
    externalUrl: null,
    isVerified: false,
    isBusinessAccount: false,
    isPrivate: false,
    avatarInitials: initials || row.username.slice(0, 2).toUpperCase(),
    avatarAccent: '#7957FF',
    followersCount: row.followersCount,
    followingCount: row.followingCount,
    postsCount: row.postsCount,
    estimatedEngagementRate: row.estimatedEngagementRate,
    postingCadencePerWeek: null,
    recentPosts: [],
    historicalTrend:
      row.followersCount !== null
        ? [
            {
              date: new Date().toISOString().slice(0, 10),
              followers: row.followersCount,
              following: row.followingCount ?? 0,
              posts: row.postsCount ?? 0,
              engagementRate: row.estimatedEngagementRate ?? 0,
            },
          ]
        : [],
  };
}
