/**
 * Strict magic-byte + header-dimension image validation for customer-uploaded avatar and cover media.
 * Rejects SVG, HTML, scripts, polyglots, corrupted headers, zero/oversized decompression-bomb dimensions,
 * unknown binaries, and oversized payloads.
 */

export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB per image
export const MAX_CUSTOMER_MEDIA_TOTAL_BYTES = 3 * 1024 * 1024; // 3 MB total quota per customer (avatar + cover)
export const MAX_IMAGE_DIMENSION_PX = 8192;
export const MAX_IMAGE_PIXELS = 25_000_000; // 25 megapixels ceiling against decompression bombs

export type AllowedImageFormat = 'png' | 'jpeg' | 'webp';

export interface ValidatedImageUpload {
  ok: true;
  format: AllowedImageFormat;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'png' | 'jpg' | 'webp';
  sizeBytes: number;
  width: number;
  height: number;
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

function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG requires 8-byte signature + 4-byte length + 4-byte "IHDR" + 4-byte width + 4-byte height = 24 bytes
  if (buf.byteLength < 24) return null;
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function parseJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.byteLength < 11) return null;
  let offset = 2; // skip FF D8
  while (offset + 4 < buf.byteLength) {
    if (buf[offset] !== 0xff) return null;
    while (offset < buf.byteLength && buf[offset] === 0xff) offset += 1;
    if (offset >= buf.byteLength) return null;
    const marker = buf[offset]!;
    offset += 1;

    // Standalone markers without length
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      continue;
    }
    if (offset + 2 > buf.byteLength) return null;
    const segmentLength = buf.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buf.byteLength) return null;

    // Start Of Frame markers (baseline, progressive, etc., excluding DHT 0xC4, JPG 0xC8, DAC 0xCC)
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      if (offset + 7 > buf.byteLength) return null;
      const height = buf.readUInt16BE(offset + 3);
      const width = buf.readUInt16BE(offset + 5);
      return { width, height };
    }
    offset += segmentLength;
  }
  return null;
}

function parseWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.byteLength < 30) return null;
  const chunkHeader = buf.subarray(12, 16).toString('ascii');
  if (chunkHeader === 'VP8 ' && buf.byteLength >= 30) {
    // Lossy VP8 bitstream frame header starts at byte 20; sync code 9D 01 2A at 23..25
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (chunkHeader === 'VP8L' && buf.byteLength >= 25) {
    // Lossless VP8L signature byte 0x2F at offset 20
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  if (chunkHeader === 'VP8X' && buf.byteLength >= 30) {
    const width = 1 + (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16));
    const height = 1 + (buf[27]! | (buf[28]! << 8) | (buf[29]! << 16));
    return { width, height };
  }
  return null;
}

function validateDimensions(
  dims: { width: number; height: number } | null,
  formatLabel: string
): { ok: true; width: number; height: number } | RejectedImageUpload {
  if (!dims || dims.width < 1 || dims.height < 1) {
    return {
      ok: false,
      error: `Corrupted or truncated ${formatLabel} image header.`,
    };
  }
  if (dims.width > MAX_IMAGE_DIMENSION_PX || dims.height > MAX_IMAGE_DIMENSION_PX) {
    return {
      ok: false,
      error: `Image dimensions (${dims.width}×${dims.height}) exceed the ${MAX_IMAGE_DIMENSION_PX}×${MAX_IMAGE_DIMENSION_PX}px safety ceiling.`,
    };
  }
  if (dims.width * dims.height > MAX_IMAGE_PIXELS) {
    return {
      ok: false,
      error: `Image pixel count exceeds the ${(MAX_IMAGE_PIXELS / 1_000_000).toFixed(0)} MP decompression safety limit.`,
    };
  }
  return { ok: true, width: dims.width, height: dims.height };
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
    const dimCheck = validateDimensions(parsePngDimensions(buffer), 'PNG');
    if (!dimCheck.ok) return dimCheck;
    return {
      ok: true,
      format: 'png',
      contentType: 'image/png',
      extension: 'png',
      sizeBytes: buffer.byteLength,
      width: dimCheck.width,
      height: dimCheck.height,
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
    const dimCheck = validateDimensions(parseJpegDimensions(buffer), 'JPEG');
    if (!dimCheck.ok) return dimCheck;
    return {
      ok: true,
      format: 'jpeg',
      contentType: 'image/jpeg',
      extension: 'jpg',
      sizeBytes: buffer.byteLength,
      width: dimCheck.width,
      height: dimCheck.height,
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
    const dimCheck = validateDimensions(parseWebpDimensions(buffer), 'WebP');
    if (!dimCheck.ok) return dimCheck;
    return {
      ok: true,
      format: 'webp',
      contentType: 'image/webp',
      extension: 'webp',
      sizeBytes: buffer.byteLength,
      width: dimCheck.width,
      height: dimCheck.height,
    };
  }

  return {
    ok: false,
    error: 'Unsupported image signature. Only valid PNG, JPEG, and WebP files are accepted.',
  };
}
