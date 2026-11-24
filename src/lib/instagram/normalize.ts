/**
 * Instagram username & profile URL validator and normalizer.
 *
 * Accepts:
 * - "username"
 * - "@username"
 * - "instagram.com/username"
 * - "https://www.instagram.com/username/?hl=en"
 * - "https://m.instagram.com/username/"
 *
 * Rejects:
 * - Reserved Instagram routes (p, reel, reels, stories, explore, direct, accounts, tv, etc.)
 * - Invalid characters, consecutive dots, leading/trailing dots, length > 30
 * - Non-Instagram URLs
 */

const RESERVED_PATHS = new Set([
  'p',
  'reel',
  'reels',
  'stories',
  'story',
  'explore',
  'accounts',
  'direct',
  'tv',
  'about',
  'legal',
  'privacy',
  'terms',
  'developer',
  'developers',
  'api',
  'graphql',
  'oauth',
  'session',
  'challenge',
  'nametag',
  'ar',
  'directory',
  'web',
]);

const INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
  'www.instagr.am',
]);

// Instagram usernames: 1-30 chars, letters/digits/periods/underscores, no consecutive dots, cannot start or end with dot.
const USERNAME_REGEX = /^(?!.*\.\.)(?!\.)[a-z0-9._]{1,30}(?<!\.)$/;

export type NormalizationErrorCode =
  | 'EMPTY_INPUT'
  | 'UNSUPPORTED_HOST'
  | 'RESERVED_PATH'
  | 'INVALID_USERNAME';

export interface NormalizedInstagramInput {
  ok: true;
  username: string;
  profileUrl: string;
  inputType: 'username' | 'handle' | 'url';
}

export interface NormalizationError {
  ok: false;
  code: NormalizationErrorCode;
  message: string;
}

export type NormalizationResult = NormalizedInstagramInput | NormalizationError;

export function normalizeInstagramInput(rawInput: string): NormalizationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      ok: false,
      code: 'EMPTY_INPUT',
      message: 'Please enter an Instagram username or profile URL.',
    };
  }

  let candidate = trimmed;
  let inputType: 'username' | 'handle' | 'url' = 'username';

  // Detect URL or domain-prefixed input
  const looksLikeUrl =
    /^https?:\/\//i.test(candidate) ||
    /^(www\.|m\.)?(instagram\.com|instagr\.am)\//i.test(candidate) ||
    candidate.includes('://') ||
    candidate.includes('/');

  if (looksLikeUrl) {
    inputType = 'url';
    const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    let parsed: URL;
    try {
      parsed = new URL(withProtocol);
    } catch {
      return {
        ok: false,
        code: 'INVALID_USERNAME',
        message: 'That does not look like a valid Instagram username or profile URL.',
      };
    }

    const host = parsed.hostname.toLowerCase();
    if (!INSTAGRAM_HOSTS.has(host)) {
      return {
        ok: false,
        code: 'UNSUPPORTED_HOST',
        message: 'Only instagram.com profile URLs or usernames are supported.',
      };
    }

    const segments = parsed.pathname
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);

    if (segments.length === 0) {
      return {
        ok: false,
        code: 'INVALID_USERNAME',
        message: 'No username was found in the Instagram URL.',
      };
    }

    const firstSegment = (segments[0] ?? '').toLowerCase();
    if (RESERVED_PATHS.has(firstSegment)) {
      return {
        ok: false,
        code: 'RESERVED_PATH',
        message:
          'Post, Reel, Story, or system URLs are not profile handles. Enter the account username directly.',
      };
    }

    candidate = firstSegment;
  } else if (candidate.startsWith('@')) {
    inputType = 'handle';
    candidate = candidate.slice(1).trim();
  }

  const normalized = candidate.toLowerCase();

  if (RESERVED_PATHS.has(normalized)) {
    return {
      ok: false,
      code: 'RESERVED_PATH',
      message: 'That word is a reserved Instagram path rather than a profile username.',
    };
  }

  if (!USERNAME_REGEX.test(normalized)) {
    return {
      ok: false,
      code: 'INVALID_USERNAME',
      message:
        'Instagram usernames must be 1–30 characters using letters, numbers, periods, or underscores (no leading, trailing, or consecutive periods).',
    };
  }

  return {
    ok: true,
    username: normalized,
    profileUrl: `https://www.instagram.com/${normalized}/`,
    inputType,
  };
}
