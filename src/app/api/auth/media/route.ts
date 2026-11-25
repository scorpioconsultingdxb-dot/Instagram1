import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { defaultFileStorage } from '@/lib/storage/local-files';
import { validateImageBuffer } from '@/lib/storage/image-validation';
import { getAccountProfilePrefs, saveAccountProfilePrefs } from '@/lib/auth/profile-prefs';

const ALLOWED_KINDS = new Set(['avatar', 'cover'] as const);
type MediaKind = 'avatar' | 'cover';

function parseKind(raw: string | null): MediaKind | null {
  if (raw === 'avatar' || raw === 'cover') return raw;
  return null;
}

function contentTypeFromKey(key: string): string {
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export async function GET(request: NextRequest) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const kind = parseKind(request.nextUrl.searchParams.get('kind'));
  if (!kind) {
    return NextResponse.json({ ok: false, error: 'Invalid media kind.' }, { status: 400 });
  }

  const prefs = await getAccountProfilePrefs(user.id);
  const key = kind === 'avatar' ? prefs.customAvatarKey : prefs.customCoverKey;
  if (!key) {
    return NextResponse.json({ ok: false, error: 'No custom media uploaded.' }, { status: 404 });
  }

  try {
    const buffer = await defaultFileStorage.getObject(key, user.id);
    if (!buffer) {
      return NextResponse.json({ ok: false, error: 'Media file not found.' }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentTypeFromKey(key),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Media access denied.' }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ ok: false, error: 'Expected multipart form upload.' }, { status: 400 });
  }

  const rawKind = String(formData.get('kind') ?? '');
  const kind = parseKind(rawKind);
  if (!kind || !ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ ok: false, error: 'Media kind must be avatar or cover.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Missing image file.' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const validation = validateImageBuffer(buffer, file.type);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const existingPrefs = await getAccountProfilePrefs(user.id);
  const previousKey = kind === 'avatar' ? existingPrefs.customAvatarKey : existingPrefs.customCoverKey;
  if (previousKey) {
    await defaultFileStorage.deleteObject(previousKey, user.id).catch(() => undefined);
  }

  const stored = await defaultFileStorage.putObject({
    namespace: 'media',
    ownerId: user.id,
    fileName: `${kind}-${Date.now()}.${validation.extension}`,
    content: buffer,
    contentType: validation.contentType,
  });

  const mediaUrl = `/api/auth/media?kind=${kind}&v=${Date.now()}`;
  const patch =
    kind === 'avatar'
      ? { customAvatarKey: stored.key, customAvatarUrl: mediaUrl }
      : { customCoverKey: stored.key, customCoverUrl: mediaUrl };

  const saved = await saveAccountProfilePrefs(user.id, patch);
  if (!saved.ok) {
    await defaultFileStorage.deleteObject(stored.key, user.id).catch(() => undefined);
    return NextResponse.json({ ok: false, error: saved.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    kind,
    url: mediaUrl,
    sizeBytes: stored.sizeBytes,
    contentType: stored.contentType,
  });
}

export async function DELETE(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const kind = parseKind(request.nextUrl.searchParams.get('kind'));
  if (!kind) {
    return NextResponse.json({ ok: false, error: 'Invalid media kind.' }, { status: 400 });
  }

  const prefs = await getAccountProfilePrefs(user.id);
  const key = kind === 'avatar' ? prefs.customAvatarKey : prefs.customCoverKey;
  if (key) {
    await defaultFileStorage.deleteObject(key, user.id).catch(() => undefined);
  }

  const patch =
    kind === 'avatar'
      ? { customAvatarKey: '', customAvatarUrl: '' }
      : { customCoverKey: '', customCoverUrl: '' };

  const saved = await saveAccountProfilePrefs(user.id, patch);
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, kind, removed: true });
}
