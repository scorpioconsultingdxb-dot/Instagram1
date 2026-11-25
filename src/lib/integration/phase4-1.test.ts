import { describe, expect, it } from 'vitest';
import {
  MAX_CUSTOMER_MEDIA_TOTAL_BYTES,
  MAX_IMAGE_DIMENSION_PX,
  MAX_IMAGE_UPLOAD_BYTES,
  validateImageBuffer,
} from '@/lib/storage/image-validation';
import { buildReportPdfBuffer } from '@/lib/reports/pdf';
import {
  buildReportCsv,
  createDefaultSections,
  type CustomReportDocument,
} from '@/lib/reports/builder';
import type { SavedProfileRecord } from '@/lib/dashboard/store';

function makeValidPngBuffer(width = 64, height = 64): Buffer {
  const buf = Buffer.alloc(33);
  // PNG signature
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  // IHDR length = 13
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8; // bit depth
  buf[25] = 2; // color type
  return buf;
}

function makeValidJpegBuffer(width = 320, height = 240): Buffer {
  // SOI + APP0 (minimal) + SOF0 (length 11: precision + height + width + components) + EOI
  const buf = Buffer.alloc(22);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xc0; // SOF0
  buf.writeUInt16BE(11, 4);
  buf[6] = 8; // precision
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  buf[11] = 3; // components
  buf[15] = 0xff;
  buf[16] = 0xd9; // EOI
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
});
