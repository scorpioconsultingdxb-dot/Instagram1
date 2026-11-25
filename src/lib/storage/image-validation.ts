/**
 * Strict magic-byte image validation for customer-uploaded avatar and cover media.
 * Rejects SVG, HTML, scripts, polyglots, unknown binaries, and oversized payloads.
 */

export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

export type AllowedImageFormat = 'png' | 'jpeg' | 'webp';

export interface ValidatedImageUpload {
  ok: true;
  format: AllowedImageFormat;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'png' | 'jpg' | 'webp';
  sizeBytes: number;
}

export interface RejectedImageUpload {
  ok: false;
  error: string;
}

const DISALLOWED_TEXT_SIGNATURES = [
  '<svg',
  '<?xml',
  '<html',
  '<!doctype',
  '<script',
  'javascript:',
];

function containsMarkupSignature(buf: Buffer): boolean {
  const head = buf.subarray(0, Math.min(buf.length, 512)).toString('utf8').toLowerCase().trimStart();
  return DISALLOWED_TEXT_SIGNATURES.some((sig) => head.includes(sig));
}

export function validateImageBuffer(
  buffer: Buffer,
  declaredMime?: string | null
): ValidatedImageUpload | RejectedImageUpload {
  if (!buffer || buffer.byteLength === 0) {
    return { ok: false, error: 'Uploaded file is empty.' };
  }

  if (buffer.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `Image exceeds the maximum allowed size of ${Math.round(MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024))} MB.`,
    };
  }

  if (containsMarkupSignature(buffer)) {
    return {
      ok: false,
      error: 'SVG, HTML, and script-bearing files are blocked for security. Upload a PNG, JPEG, or WebP image.',
    };
  }

  const normalizedMime = (declaredMime ?? '').trim().toLowerCase();
  if (normalizedMime === 'image/svg+xml' || normalizedMime.startsWith('text/')) {
    return {
      ok: false,
      error: 'SVG and text MIME types are not permitted. Upload a PNG, JPEG, or WebP image.',
    };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.byteLength >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (normalizedMime && normalizedMime !== 'image/png' && normalizedMime !== 'application/octet-stream') {
      return { ok: false, error: 'Declared file type does not match PNG image signature.' };
    }
    return {
      ok: true,
      format: 'png',
      contentType: 'image/png',
      extension: 'png',
      sizeBytes: buffer.byteLength,
    };
  }

  // JPEG: FF D8 FF
  if (buffer.byteLength >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    if (
      normalizedMime &&
      normalizedMime !== 'image/jpeg' &&
      normalizedMime !== 'image/jpg' &&
      normalizedMime !== 'application/octet-stream'
    ) {
      return { ok: false, error: 'Declared file type does not match JPEG image signature.' };
    }
    return {
      ok: true,
      format: 'jpeg',
      contentType: 'image/jpeg',
      extension: 'jpg',
      sizeBytes: buffer.byteLength,
    };
  }

  // WebP: RIFF....WEBP
  if (
    buffer.byteLength >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    if (normalizedMime && normalizedMime !== 'image/webp' && normalizedMime !== 'application/octet-stream') {
      return { ok: false, error: 'Declared file type does not match WebP image signature.' };
    }
    return {
      ok: true,
      format: 'webp',
      contentType: 'image/webp',
      extension: 'webp',
      sizeBytes: buffer.byteLength,
    };
  }

  return {
    ok: false,
    error: 'Unsupported image signature. Only valid PNG, JPEG, and WebP files are accepted.',
  };
}
