import { inflateSync } from 'zlib';

/**
 * Strict magic-byte, structural container, checksum, and payload-decode image validation
 * for customer-uploaded avatar and cover media (Stage 68 hardened).
 *
 * Goes beyond header-only parsing:
 * - PNG: Verifies every chunk boundary, IEEE CRC-32 checksum on every chunk, IHDR format
 *   validity, rejects trailing polyglot bytes after IEND, rejects markup in text chunks,
 *   and inflates concatenated IDAT streams via zlib with a strict output cap to verify
 *   actual scanline byte counts and filter bytes (0..4).
 * - JPEG: Walks all marker segments through SOF*, validates DQT/DHT lengths, requires a
 *   valid Start-Of-Scan (SOS) segment, scans entropy-coded data (respecting FF 00 stuffing
 *   and RST0..RST7 markers) to a mandatory End-Of-Image (EOI) marker, and blocks trailing
 *   polyglots or embedded markup in APP/COM segments.
 * - WebP: Verifies exact RIFF file length (no trailing polyglots), walks all sub-chunks,
 *   requires actual image bitstream data (rejecting header-only VP8X shells), validates
 *   VP8 keyframe/partition0 or VP8L bitstream headers, and blocks markup in EXIF/XMP.
 */

export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB per image
export const MAX_CUSTOMER_MEDIA_TOTAL_BYTES = 3 * 1024 * 1024; // 3 MB total quota per customer (avatar + cover)
export const MAX_IMAGE_DIMENSION_PX = 8192;
export const MAX_IMAGE_PIXELS = 25_000_000; // 25 megapixels ceiling against decompression bombs
const MAX_PNG_INFLATE_BYTES = 100 * 1024 * 1024; // Hard zlib inflation ceiling

export type AllowedImageFormat = 'png' | 'jpeg' | 'webp';

export interface ValidatedImageUpload {
  ok: true;
  format: AllowedImageFormat;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'png' | 'jpg' | 'webp';
  sizeBytes: number;
  width: number;
  height: number;
  decodeVerified: true;
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

// Precomputed IEEE 802.3 CRC-32 table for PNG chunk integrity verification
const CRC32_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[n] = c >>> 0;
}

export function computeCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.byteLength; i += 1) {
    crc = CRC32_TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function containsMarkupSignature(buf: Buffer, maxInspectBytes = 512): boolean {
  const head = buf
    .subarray(0, Math.min(buf.length, maxInspectBytes))
    .toString('utf8')
    .toLowerCase()
    .trimStart();
  return DISALLOWED_TEXT_SIGNATURES.some((sig) => head.includes(sig));
}

function containsEmbeddedScriptMarkup(buf: Buffer): boolean {
  const text = buf.toString('latin1').toLowerCase();
  return (
    text.includes('<script') ||
    text.includes('<svg') ||
    text.includes('<html') ||
    text.includes('javascript:')
  );
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

function pngSamplesPerPixel(colorType: number): number | null {
  switch (colorType) {
    case 0:
      return 1; // Grayscale
    case 2:
      return 3; // RGB
    case 3:
      return 1; // Indexed-color (palette)
    case 4:
      return 2; // Grayscale + Alpha
    case 6:
      return 4; // RGBA
    default:
      return null;
  }
}

function isValidPngBitDepth(colorType: number, bitDepth: number): boolean {
  switch (colorType) {
    case 0:
      return [1, 2, 4, 8, 16].includes(bitDepth);
    case 2:
    case 4:
    case 6:
      return [8, 16].includes(bitDepth);
    case 3:
      return [1, 2, 4, 8].includes(bitDepth);
    default:
      return false;
  }
}

function decodeAndVerifyPng(
  buf: Buffer
): { ok: true; width: number; height: number } | RejectedImageUpload {
  if (buf.byteLength < 33) {
    return { ok: false, error: 'Corrupted or truncated PNG image payload.' };
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlaceMethod = 0;
  let sawIhdr = false;
  let sawIend = false;
  const idatChunks: Buffer[] = [];

  while (offset + 12 <= buf.byteLength) {
    const length = buf.readUInt32BE(offset);
    const typeBuf = buf.subarray(offset + 4, offset + 8);
    const type = typeBuf.toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;

    if (length > 0x7fffffff || crcOffset + 4 > buf.byteLength) {
      return { ok: false, error: `Truncated PNG chunk (${type}).` };
    }

    // Verify IEEE CRC-32 over chunk type + chunk data
    const expectedCrc = buf.readUInt32BE(crcOffset);
    const actualCrc = computeCrc32(buf.subarray(offset + 4, dataEnd));
    if (actualCrc !== expectedCrc) {
      return { ok: false, error: `Corrupted PNG checksum in ${type} chunk.` };
    }

    const data = buf.subarray(dataStart, dataEnd);

    if (!sawIhdr) {
      if (type !== 'IHDR' || length !== 13) {
        return { ok: false, error: 'Invalid PNG structure: missing valid IHDR chunk.' };
      }
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
      const compressionMethod = data[10]!;
      const filterMethod = data[11]!;
      interlaceMethod = data[12]!;

      const dimCheck = validateDimensions({ width, height }, 'PNG');
      if (!dimCheck.ok) return dimCheck;

      if (
        !isValidPngBitDepth(colorType, bitDepth) ||
        compressionMethod !== 0 ||
        filterMethod !== 0 ||
        (interlaceMethod !== 0 && interlaceMethod !== 1)
      ) {
        return { ok: false, error: 'Unsupported or malformed PNG IHDR encoding parameters.' };
      }
      sawIhdr = true;
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
      if (containsEmbeddedScriptMarkup(data)) {
        return { ok: false, error: 'PNG metadata contains disallowed HTML/script markup.' };
      }
    } else if (type === 'IEND') {
      if (length !== 0) {
        return { ok: false, error: 'Malformed PNG IEND terminator chunk.' };
      }
      sawIend = true;
      offset = crcOffset + 4;
      break;
    }

    offset = crcOffset + 4;
  }

  if (!sawIhdr || !sawIend) {
    return { ok: false, error: 'Incomplete PNG image: missing IHDR or IEND terminator.' };
  }
  if (offset !== buf.byteLength) {
    return { ok: false, error: 'Rejected PNG polyglot: unexpected trailing bytes after IEND.' };
  }
  if (idatChunks.length === 0) {
    return { ok: false, error: 'Invalid PNG image: missing IDAT image pixel payload.' };
  }

  const samples = pngSamplesPerPixel(colorType);
  if (!samples) {
    return { ok: false, error: 'Unsupported PNG color type.' };
  }

  const scanlineBytes = Math.ceil((width * samples * bitDepth) / 8);
  const expectedDecodedBytes = height * (1 + scanlineBytes);
  const inflateCeiling = Math.min(MAX_PNG_INFLATE_BYTES, Math.max(expectedDecodedBytes + 4096, 65536));

  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(idatChunks), { maxOutputLength: inflateCeiling });
  } catch {
    return { ok: false, error: 'Corrupted or unsafe PNG IDAT compressed pixel stream.' };
  }

  if (interlaceMethod === 0) {
    if (inflated.byteLength !== expectedDecodedBytes) {
      return {
        ok: false,
        error: 'Decoded PNG pixel stream does not match declared image dimensions.',
      };
    }
    // Every scanline must start with a valid PNG filter type (0..4)
    const stride = 1 + scanlineBytes;
    for (let row = 0; row < height; row += 1) {
      const filterByte = inflated[row * stride]!;
      if (filterByte > 4) {
        return { ok: false, error: 'Corrupted PNG scanline filter byte during decode verification.' };
      }
    }
  } else if (inflated.byteLength < height) {
    return { ok: false, error: 'Truncated interlaced PNG decoded pixel payload.' };
  }

  return { ok: true, width, height };
}

function decodeAndVerifyJpeg(
  buf: Buffer
): { ok: true; width: number; height: number } | RejectedImageUpload {
  if (buf.byteLength < 18) {
    return { ok: false, error: 'Corrupted or truncated JPEG image payload.' };
  }

  let offset = 2; // skip SOI (FF D8)
  let dims: { width: number; height: number } | null = null;
  let sawSos = false;
  let sawEoi = false;

  while (offset < buf.byteLength) {
    if (buf[offset] !== 0xff) {
      return { ok: false, error: 'Malformed JPEG marker structure.' };
    }
    while (offset < buf.byteLength && buf[offset] === 0xff) offset += 1;
    if (offset >= buf.byteLength) {
      return { ok: false, error: 'Truncated JPEG marker.' };
    }
    const marker = buf[offset]!;
    offset += 1;

    if (marker === 0xd9) {
      // EOI
      sawEoi = true;
      break;
    }

    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 2 > buf.byteLength) {
      return { ok: false, error: 'Truncated JPEG segment length.' };
    }
    const segmentLength = buf.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buf.byteLength) {
      return { ok: false, error: 'Invalid JPEG segment length boundary.' };
    }

    const segmentData = buf.subarray(offset + 2, offset + segmentLength);

    // Inspect COM / APP* segments for embedded HTML/SVG/script polyglots
    if (marker === 0xfe || (marker >= 0xe0 && marker <= 0xef)) {
      if (containsEmbeddedScriptMarkup(segmentData)) {
        return { ok: false, error: 'JPEG metadata contains disallowed HTML/script markup.' };
      }
    }

    // Start Of Frame markers
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      if (segmentLength < 8) {
        return { ok: false, error: 'Truncated JPEG SOF header.' };
      }
      const precision = buf[offset + 2]!;
      const height = buf.readUInt16BE(offset + 3);
      const width = buf.readUInt16BE(offset + 5);
      const components = buf[offset + 7]!;
      if ((precision !== 8 && precision !== 12) || components < 1 || components > 4) {
        return { ok: false, error: 'Unsupported JPEG frame precision or component count.' };
      }
      const dimCheck = validateDimensions({ width, height }, 'JPEG');
      if (!dimCheck.ok) return dimCheck;
      dims = { width: dimCheck.width, height: dimCheck.height };
    }

    offset += segmentLength;

    // Start Of Scan (SOS): walk entropy-coded scan bitstream until next marker
    if (marker === 0xda) {
      if (!dims) {
        return { ok: false, error: 'Malformed JPEG: Start-Of-Scan appeared before frame header.' };
      }
      if (segmentData.byteLength < 4) {
        return { ok: false, error: 'Malformed JPEG Start-Of-Scan header.' };
      }
      sawSos = true;
      let scanBytes = 0;
      while (offset < buf.byteLength) {
        if (buf[offset] === 0xff) {
          let nextIdx = offset + 1;
          while (nextIdx < buf.byteLength && buf[nextIdx] === 0xff) nextIdx += 1;
          if (nextIdx >= buf.byteLength) {
            return { ok: false, error: 'Truncated JPEG entropy scan payload.' };
          }
          const nextMarker = buf[nextIdx]!;
          if (nextMarker === 0x00) {
            // Byte-stuffed 0xFF literal inside entropy scan
            scanBytes += 1;
            offset = nextIdx + 1;
            continue;
          }
          if (nextMarker >= 0xd0 && nextMarker <= 0xd7) {
            // Valid restart marker inside entropy scan
            offset = nextIdx + 1;
            continue;
          }
          // Reached next structural marker (e.g., EOI 0xD9 or another scan/DHT)
          break;
        }
        scanBytes += 1;
        offset += 1;
      }
      if (scanBytes === 0) {
        return { ok: false, error: 'Empty JPEG entropy-coded scan payload.' };
      }
    }
  }

  if (!dims || !sawSos || !sawEoi) {
    return {
      ok: false,
      error: 'Incomplete or header-only JPEG image: missing SOF, SOS scan payload, or EOI terminator.',
    };
  }
  if (offset !== buf.byteLength) {
    return { ok: false, error: 'Rejected JPEG polyglot: unexpected trailing bytes after EOI.' };
  }

  return { ok: true, width: dims.width, height: dims.height };
}

function decodeAndVerifyWebp(
  buf: Buffer
): { ok: true; width: number; height: number } | RejectedImageUpload {
  if (buf.byteLength < 30) {
    return { ok: false, error: 'Corrupted or truncated WebP image payload.' };
  }

  const declaredRiffSize = buf.readUInt32LE(4);
  if (declaredRiffSize + 8 !== buf.byteLength) {
    return {
      ok: false,
      error: 'Rejected WebP container: RIFF declared length does not match file size.',
    };
  }

  let offset = 12;
  let dims: { width: number; height: number } | null = null;
  let hasImageBitstream = false;

  while (offset + 8 <= buf.byteLength) {
    const fourcc = buf.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = buf.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkSize;
    if (dataEnd > buf.byteLength) {
      return { ok: false, error: `Truncated WebP ${fourcc} chunk.` };
    }
    const chunkData = buf.subarray(dataStart, dataEnd);

    if (fourcc === 'VP8 ') {
      if (chunkSize < 14) {
        return { ok: false, error: 'Truncated WebP VP8 bitstream.' };
      }
      const frameTag = chunkData[0]! | (chunkData[1]! << 8) | (chunkData[2]! << 16);
      const isKeyFrame = (frameTag & 1) === 0;
      const firstPartitionSize = frameTag >>> 5;
      if (!isKeyFrame || chunkData[3] !== 0x9d || chunkData[4] !== 0x01 || chunkData[5] !== 0x2a) {
        return { ok: false, error: 'Invalid WebP VP8 keyframe sync header.' };
      }
      if (firstPartitionSize < 1 || 10 + firstPartitionSize > chunkSize) {
        return { ok: false, error: 'Corrupted WebP VP8 partition boundary.' };
      }
      const width = chunkData.readUInt16LE(6) & 0x3fff;
      const height = chunkData.readUInt16LE(8) & 0x3fff;
      const dimCheck = validateDimensions({ width, height }, 'WebP');
      if (!dimCheck.ok) return dimCheck;
      dims = dims ?? { width: dimCheck.width, height: dimCheck.height };
      hasImageBitstream = true;
    } else if (fourcc === 'VP8L') {
      if (chunkSize < 6 || chunkData[0] !== 0x2f) {
        return { ok: false, error: 'Invalid or truncated WebP VP8L lossless bitstream.' };
      }
      const bits = chunkData.readUInt32LE(1);
      const versionNumber = (bits >>> 29) & 0x7;
      if (versionNumber !== 0) {
        return { ok: false, error: 'Unsupported WebP VP8L bitstream version.' };
      }
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      const dimCheck = validateDimensions({ width, height }, 'WebP');
      if (!dimCheck.ok) return dimCheck;
      dims = dims ?? { width: dimCheck.width, height: dimCheck.height };
      hasImageBitstream = true;
    } else if (fourcc === 'VP8X') {
      if (chunkSize !== 10) {
        return { ok: false, error: 'Malformed WebP VP8X extended header.' };
      }
      const width = 1 + (chunkData[4]! | (chunkData[5]! << 8) | (chunkData[6]! << 16));
      const height = 1 + (chunkData[7]! | (chunkData[8]! << 8) | (chunkData[9]! << 16));
      const dimCheck = validateDimensions({ width, height }, 'WebP');
      if (!dimCheck.ok) return dimCheck;
      dims = { width: dimCheck.width, height: dimCheck.height };
    } else if (fourcc === 'ANMF') {
      if (chunkSize < 24) {
        return { ok: false, error: 'Truncated WebP ANMF frame chunk.' };
      }
      hasImageBitstream = true;
    } else if (fourcc === 'EXIF' || fourcc === 'XMP ') {
      if (containsEmbeddedScriptMarkup(chunkData)) {
        return { ok: false, error: 'WebP metadata contains disallowed HTML/script markup.' };
      }
    }

    // RIFF chunks are padded to an even byte boundary
    offset = dataEnd + (chunkSize % 2);
  }

  if (offset !== buf.byteLength) {
    return { ok: false, error: 'Malformed WebP RIFF chunk padding or trailing bytes.' };
  }
  if (!dims || !hasImageBitstream) {
    return {
      ok: false,
      error: 'Incomplete or header-only WebP file: missing decodable VP8/VP8L image bitstream.',
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
    const decoded = decodeAndVerifyPng(buffer);
    if (!decoded.ok) return decoded;
    return {
      ok: true,
      format: 'png',
      contentType: 'image/png',
      extension: 'png',
      sizeBytes: buffer.byteLength,
      width: decoded.width,
      height: decoded.height,
      decodeVerified: true,
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
    const decoded = decodeAndVerifyJpeg(buffer);
    if (!decoded.ok) return decoded;
    return {
      ok: true,
      format: 'jpeg',
      contentType: 'image/jpeg',
      extension: 'jpg',
      sizeBytes: buffer.byteLength,
      width: decoded.width,
      height: decoded.height,
      decodeVerified: true,
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
    const decoded = decodeAndVerifyWebp(buffer);
    if (!decoded.ok) return decoded;
    return {
      ok: true,
      format: 'webp',
      contentType: 'image/webp',
      extension: 'webp',
      sizeBytes: buffer.byteLength,
      width: decoded.width,
      height: decoded.height,
      decodeVerified: true,
    };
  }

  return {
    ok: false,
    error: 'Unsupported image signature. Only valid PNG, JPEG, and WebP files are accepted.',
  };
}
