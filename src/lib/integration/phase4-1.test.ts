import { deflateSync } from 'zlib';
import { describe, expect, it } from 'vitest';
import {
  MAX_CUSTOMER_MEDIA_TOTAL_BYTES,
  MAX_IMAGE_DIMENSION_PX,
  MAX_IMAGE_UPLOAD_BYTES,
  computeCrc32,
  validateImageBuffer,
} from '@/lib/storage/image-validation';
import { buildReportPdfBuffer } from '@/lib/reports/pdf';
import {
  buildReportCsv,
  createDefaultSections,
  type CustomReportDocument,
} from '@/lib/reports/builder';
import type { SavedProfileRecord } from '@/lib/dashboard/store';

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.byteLength, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(computeCrc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function makeValidPngBuffer(width = 64, height = 64): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  // For bomb tests (width/height exceeding safety ceiling), omit massive IDAT allocation since IHDR fails first
  const safeToAllocate = width > 0 && height > 0 && width <= 1024 && height <= 1024;
  const idat = safeToAllocate
    ? pngChunk('IDAT', deflateSync(Buffer.alloc(height * (1 + width * 3), 0)))
    : Buffer.alloc(0);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    idat,
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeValidJpegBuffer(width = 320, height = 240): Buffer {
  // Valid SOI + SOF0 + SOS + entropy bytes + EOI
  const buf = Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x0b, 0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0x7f, 0x00, 0xd2,
    0xff, 0xd9,
  ]);
  return buf;
}

function makeValidWebpVp8lBuffer(width = 128, height = 96): Buffer {
  const buf = Buffer.alloc(30);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(22, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8L', 12, 'ascii');
  buf.writeUInt32LE(10, 16);
  buf[20] = 0x2f; // VP8L signature byte
  const packed = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  buf.writeUInt32LE(packed >>> 0, 21);
  return buf;
}

function makeSampleProfile(username: string): SavedProfileRecord {
  const now = new Date().toISOString();
  return {
    id: `prof-${username}`,
    username,
    profile: {
      username,
      displayName: `Brand ${username}`,
      bio: 'Public storefront bio',
      category: 'Design Studio',
      externalUrl: null,
      isVerified: true,
      isBusinessAccount: true,
      isPrivate: false,
      avatarInitials: 'BS',
      avatarAccent: '#7957FF',
      followersCount: 48200,
      followingCount: 410,
      postsCount: 285,
      estimatedEngagementRate: 4.6,
      postingCadencePerWeek: 4.5,
      recentPosts: [],
      historicalTrend: [
        { date: '2026-10-01', followers: 46000, following: 400, posts: 270, engagementRate: 4.4 },
        { date: '2026-11-01', followers: 48200, following: 410, posts: 285, engagementRate: 4.6 },
      ],
    },
    dataClass: 'demo',
    providerLabel: 'Demo Fixture',
    workspace: 'Personal Workspace',
    folderId: null,
    tags: ['benchmark'],
    privateNote: 'STRICTLY PRIVATE INTERNAL NOTE — MUST NEVER APPEAR IN SHARED EXPORT',
    savedAt: now,
    updatedAt: now,
  };
}

describe('Phase 4.1 Hardened Media Storage Validation & Real Binary PDF Export', () => {
  it('validates genuine PNG, JPEG, and WebP headers with accurate dimensions', () => {
    const png = validateImageBuffer(makeValidPngBuffer(400, 300), 'image/png');
    expect(png.ok).toBe(true);
    if (png.ok) {
      expect(png.format).toBe('png');
      expect(png.width).toBe(400);
      expect(png.height).toBe(300);
    }

    const jpg = validateImageBuffer(makeValidJpegBuffer(640, 480), 'image/jpeg');
    expect(jpg.ok).toBe(true);
    if (jpg.ok) {
      expect(jpg.format).toBe('jpeg');
      expect(jpg.width).toBe(640);
      expect(jpg.height).toBe(480);
    }

    const webp = validateImageBuffer(makeValidWebpVp8lBuffer(256, 128), 'image/webp');
    expect(webp.ok).toBe(true);
    if (webp.ok) {
      expect(webp.format).toBe('webp');
      expect(webp.width).toBe(256);
      expect(webp.height).toBe(128);
    }
  });

  it('blocks SVG, HTML, polyglots, oversized payloads, corrupted headers, and decompression bombs', () => {
    expect(validateImageBuffer(Buffer.alloc(0), 'image/png').ok).toBe(false);
    expect(
      validateImageBuffer(Buffer.from('<svg onload="alert(1)"></svg>'), 'image/svg+xml').ok
    ).toBe(false);
    expect(
      validateImageBuffer(Buffer.from('<!doctype html><script>alert(1)</script>'), 'image/png').ok
    ).toBe(false);
    expect(
      validateImageBuffer(Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES + 1, 0x89), 'image/png').ok
    ).toBe(false);

    // Truncated PNG (only magic bytes, no IHDR)
    const truncatedPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateImageBuffer(truncatedPng, 'image/png').ok).toBe(false);

    // Zero-dimension PNG
    expect(validateImageBuffer(makeValidPngBuffer(0, 100), 'image/png').ok).toBe(false);

    // Decompression bomb (> MAX_IMAGE_DIMENSION_PX or > 25 MP)
    expect(
      validateImageBuffer(makeValidPngBuffer(MAX_IMAGE_DIMENSION_PX + 1, 100), 'image/png').ok
    ).toBe(false);
    expect(validateImageBuffer(makeValidPngBuffer(6000, 6000), 'image/png').ok).toBe(false);

    // MIME mismatch spoofing
    expect(validateImageBuffer(makeValidPngBuffer(100, 100), 'image/jpeg').ok).toBe(false);

    // Total customer quota sanity check (> single file cap)
    expect(MAX_CUSTOMER_MEDIA_TOTAL_BYTES).toBeGreaterThan(MAX_IMAGE_UPLOAD_BYTES);
  });

  it('generates a valid standards-compliant binary %PDF-1.4 report with xref, branding, provenance, and zero private note leakage', () => {
    const now = new Date().toISOString();
    const sections = createDefaultSections('client_performance').map((s) =>
      s.kind === 'custom_text'
        ? {
            ...s,
            customText:
              'Executive note: focus Q4 carousel cadence on high-save tutorials. '.repeat(25),
          }
        : s
    );

    const doc: CustomReportDocument = {
      id: 'crpt-pdf-verify-1',
      ownerId: 'owner-1',
      reportType: 'client_performance',
      title: '=SUM(1,2) Quarterly Client Benchmark',
      description: 'Deterministic agency client brief generated from recorded workspace profiles.',
      status: 'ready',
      usernames: ['studio.meridian'],
      sections,
      branding: {
        enabled: true,
        agencyName: 'Scorpio Marketing Agency',
        clientName: 'Meridian Studio',
        accentHex: '#7957FF',
        headerNote: 'Prepared exclusively for quarterly leadership review.',
      },
      version: 3,
      versionHistory: [],
      generationMode: 'Template-Generated',
      createdAt: now,
      updatedAt: now,
    };

    const profile = makeSampleProfile('studio.meridian');
    const pdfBuffer = buildReportPdfBuffer(doc, [profile], '2026-11-25T20:00:00.000Z');
    const pdfText = pdfBuffer.toString('latin1');

    // Verify genuine PDF 1.4 binary structure
    expect(pdfBuffer.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
    expect(pdfBuffer.byteLength).toBeGreaterThan(1500);
    expect(pdfText).toContain('xref\n');
    expect(pdfText).toContain('trailer\n');
    expect(pdfText).toContain('startxref\n');
    expect(pdfText.trimEnd().endsWith('%%EOF')).toBe(true);

    // Verify branding, metrics, honest Template-Generated disclosure, and ZERO private notes
    expect(pdfText).toContain('Scorpio Marketing Agency');
    expect(pdfText).toContain('Meridian Studio');
    expect(pdfText).toContain('@studio.meridian');
    expect(pdfText).toContain('Template-Generated \\(Not AI-Generated\\)');
    expect(pdfText).not.toContain('STRICTLY PRIVATE INTERNAL NOTE');

    // Verify formula-safe CSV injection neutralization on the same report title
    const csv = buildReportCsv(doc, [profile]);
    expect(csv).toContain("'=SUM(1,2) Quarterly Client Benchmark");
    expect(csv).not.toContain('STRICTLY PRIVATE INTERNAL NOTE');
  });

  it('renders multilingual WinAnsi diacritics (pt-BR, es, de, fr) and produces exact standard-reader PDF xref byte offsets', () => {
    const now = new Date().toISOString();
    const sections = createDefaultSections('executive_summary').map((s) =>
      s.kind === 'custom_text'
        ? {
            ...s,
            customText:
              'PT: Relatório de Engajamento — Ação & Evolução. ES: Análisis de Campaña Española ¿Qué funciona? DE: Überblick & Größe — Fußzeile. FR: Stratégie Créateur — Résumé €100.',
          }
        : s
    );

    const doc: CustomReportDocument = {
      id: 'crpt-i18n-pdf-1',
      ownerId: 'owner-1',
      reportType: 'executive_summary',
      title: 'Relatório Multilíngue — Überblick & Résumé',
      description: 'Análise estratégica multi-idioma (pt-BR / es / de / fr / en).',
      status: 'ready',
      usernames: ['studio.meridian'],
      sections,
      branding: {
        enabled: false,
        agencyName: '',
        clientName: '',
        accentHex: '#7957FF',
        headerNote: '',
      },
      version: 1,
      versionHistory: [],
      generationMode: 'Template-Generated',
      createdAt: now,
      updatedAt: now,
    };

    const pdfBuf = buildReportPdfBuffer(doc, [makeSampleProfile('studio.meridian')], '2026-11-26T00:00:00.000Z');
    const pdfStr = pdfBuf.toString('latin1');

    // Verify WinAnsi octal escapes for accented chars across all 4 non-English locales + Euro sign
    expect(pdfStr).toContain('\\363'); // ó (Relatório)
    expect(pdfStr).toContain('\\347'); // ç (Ação)
    expect(pdfStr).toContain('\\343'); // ã (Ação)
    expect(pdfStr).toContain('\\361'); // ñ (Campaña)
    expect(pdfStr).toContain('\\334'); // Ü (Überblick)
    expect(pdfStr).toContain('\\337'); // ß (Größe / Fußzeile)
    expect(pdfStr).toContain('\\351'); // é (Stratégie / Résumé)
    expect(pdfStr).toContain('\\200'); // € (WinAnsi 0x80)

    // Strict PDF 1.4 structural reader check: startxref & every xref entry offset must match exact object byte positions
    const startXrefMatch = pdfStr.match(/startxref\n(\d+)\n%%EOF\s*$/);
    expect(startXrefMatch).not.toBeNull();
    const xrefPos = Number(startXrefMatch![1]);
    expect(pdfBuf.subarray(xrefPos, xrefPos + 5).toString('latin1')).toBe('xref\n');

    const xrefSection = pdfStr.slice(xrefPos);
    const entryLines = xrefSection
      .split('\n')
      .filter((l) => /^\d{10} \d{5} n $/.test(l));
    expect(entryLines.length).toBeGreaterThanOrEqual(6);

    entryLines.forEach((line, idx) => {
      const objId = idx + 1;
      const byteOffset = Number(line.slice(0, 10));
      const expectedPrefix = `${objId} 0 obj\n`;
      expect(pdfBuf.subarray(byteOffset, byteOffset + expectedPrefix.length).toString('latin1')).toBe(
        expectedPrefix
      );
    });

    // Safe WebP VP8X oversized dimension decoding rejection
    const bombWebp = Buffer.alloc(30);
    bombWebp.write('RIFF', 0, 'ascii');
    bombWebp.writeUInt32LE(22, 4);
    bombWebp.write('WEBP', 8, 'ascii');
    bombWebp.write('VP8X', 12, 'ascii');
    const dim = 10000 - 1;
    bombWebp[24] = dim & 0xff;
    bombWebp[25] = (dim >> 8) & 0xff;
    bombWebp[26] = (dim >> 16) & 0xff;
    bombWebp[27] = dim & 0xff;
    bombWebp[28] = (dim >> 8) & 0xff;
    bombWebp[29] = (dim >> 16) & 0xff;
    expect(validateImageBuffer(bombWebp, 'image/webp').ok).toBe(false);
  });
});
