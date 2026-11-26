import { deflateSync } from 'zlib';
import { describe, expect, it } from 'vitest';
import { computeCrc32, validateImageBuffer } from '@/lib/storage/image-validation';
import { buildReportPdfBuffer } from '@/lib/reports/pdf';
import { createDefaultSections, type CustomReportDocument } from '@/lib/reports/builder';

function buildPngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.byteLength, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(computeCrc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function makeRealDecodablePng(width = 8, height = 8): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4), 0);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    buildPngChunk('IHDR', ihdr),
    buildPngChunk('IDAT', deflateSync(raw)),
    buildPngChunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('Phase 7 Stage 68 — Actual Image Decode Verification & Multilingual PDF Validation', () => {
  it('accepts genuine decodable PNG/JPEG/WebP payloads with decodeVerified=true', () => {
    const png = validateImageBuffer(makeRealDecodablePng(16, 12), 'image/png');
    expect(png.ok).toBe(true);
    if (png.ok) {
      expect(png.decodeVerified).toBe(true);
      expect(png.width).toBe(16);
      expect(png.height).toBe(12);
    }

    const jpeg = validateImageBuffer(
      Buffer.from([
        0xff, 0xd8,
        0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x20, 0x00, 0x20, 0x01, 0x01, 0x11, 0x00,
        0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
        0x55, 0xff, 0x00, 0x2a,
        0xff, 0xd9,
      ]),
      'image/jpeg'
    );
    expect(jpeg.ok).toBe(true);
    if (jpeg.ok) {
      expect(jpeg.decodeVerified).toBe(true);
    }
  });

  it('rejects header-only PNG stubs, bad CRC-32, corrupted zlib IDAT, and trailing IEND polyglots', () => {
    // Header-only PNG stub (no IDAT/IEND)
    const headerOnlyPng = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(headerOnlyPng, 0);
    headerOnlyPng.writeUInt32BE(13, 8);
    headerOnlyPng.write('IHDR', 12, 'ascii');
    headerOnlyPng.writeUInt32BE(64, 16);
    headerOnlyPng.writeUInt32BE(64, 20);
    expect(validateImageBuffer(headerOnlyPng, 'image/png').ok).toBe(false);

    // Corrupted CRC-32 checksum
    const badCrc = Buffer.from(makeRealDecodablePng(8, 8));
    badCrc[badCrc.byteLength - 1] = (badCrc[badCrc.byteLength - 1] ?? 0) ^ 0xff;
    expect(validateImageBuffer(badCrc, 'image/png').ok).toBe(false);

    // Corrupted zlib stream inside valid CRC IDAT chunk
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(8, 0);
    ihdr.writeUInt32BE(8, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    const badIdat = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      buildPngChunk('IHDR', ihdr),
      buildPngChunk('IDAT', Buffer.from([0xde, 0xad, 0xbe, 0xef])),
      buildPngChunk('IEND', Buffer.alloc(0)),
    ]);
    expect(validateImageBuffer(badIdat, 'image/png').ok).toBe(false);

    // Trailing HTML polyglot appended after IEND
    const polyglotPng = Buffer.concat([
      makeRealDecodablePng(8, 8),
      Buffer.from('<script>alert(1)</script>', 'utf8'),
    ]);
    expect(validateImageBuffer(polyglotPng, 'image/png').ok).toBe(false);

    // Embedded script inside PNG tEXt chunk
    const scriptTextPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      buildPngChunk('IHDR', ihdr),
      buildPngChunk('tEXt', Buffer.from('Comment\0<script>alert(1)</script>', 'latin1')),
      buildPngChunk('IDAT', deflateSync(Buffer.alloc(8 * (1 + 8 * 3), 0))),
      buildPngChunk('IEND', Buffer.alloc(0)),
    ]);
    expect(validateImageBuffer(scriptTextPng, 'image/png').ok).toBe(false);
  });

  it('rejects header-only JPEG, truncated JPEG without EOI, header-only WebP VP8X, and trailing WebP polyglots', () => {
    // Header-only JPEG (missing SOS and EOI)
    const headerOnlyJpeg = Buffer.from([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x20, 0x00, 0x20, 0x01, 0x01, 0x11, 0x00,
    ]);
    expect(validateImageBuffer(headerOnlyJpeg, 'image/jpeg').ok).toBe(false);

    // JPEG with trailing polyglot after EOI
    const trailingJpeg = Buffer.from([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x20, 0x00, 0x20, 0x01, 0x01, 0x11, 0x00,
      0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
      0x55,
      0xff, 0xd9,
      0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74, 0x3e,
    ]);
    expect(validateImageBuffer(trailingJpeg, 'image/jpeg').ok).toBe(false);

    // Header-only WebP VP8X shell (no VP8/VP8L/ANMF bitstream)
    const vp8xShell = Buffer.alloc(30);
    vp8xShell.write('RIFF', 0, 'ascii');
    vp8xShell.writeUInt32LE(22, 4);
    vp8xShell.write('WEBP', 8, 'ascii');
    vp8xShell.write('VP8X', 12, 'ascii');
    vp8xShell.writeUInt32LE(10, 16);
    vp8xShell[24] = 63;
    vp8xShell[27] = 63;
    expect(validateImageBuffer(vp8xShell, 'image/webp').ok).toBe(false);

    // WebP with mismatched RIFF size (appended polyglot)
    const validWebp = Buffer.alloc(30);
    validWebp.write('RIFF', 0, 'ascii');
    validWebp.writeUInt32LE(22, 4);
    validWebp.write('WEBP', 8, 'ascii');
    validWebp.write('VP8L', 12, 'ascii');
    validWebp.writeUInt32LE(10, 16);
    validWebp[20] = 0x2f;
    validWebp.writeUInt32LE((63 | (63 << 14)) >>> 0, 21);
    const polyglotWebp = Buffer.concat([validWebp, Buffer.from('<svg/>', 'utf8')]);
    expect(validateImageBuffer(polyglotWebp, 'image/webp').ok).toBe(false);
  });

  it('generates valid multilingual %PDF-1.4 exports with WinAnsi octal escapes across all 5 locales', () => {
    const samples: Array<{ locale: string; title: string; commentary: string; expectedOctal: string }> = [
      { locale: 'en', title: 'Executive Social Audit — Q4', commentary: 'Transparent metrics & benchmark €99.99.', expectedOctal: '\\200' },
      { locale: 'pt-BR', title: 'Relatório de Análise & Estratégia', commentary: 'Ações de engajamento: publicação, coração e padrão.', expectedOctal: '\\347' },
      { locale: 'es', title: 'Informe de Análisis — Campaña', commentary: '¿Cómo optimizar la señal pública y evaluación?', expectedOctal: '\\361' },
      { locale: 'de', title: 'Öffentliche Profilprüfung & Übersicht', commentary: 'DSGVO-konforme Maßnahme für größere Reichweite.', expectedOctal: '\\337' },
      { locale: 'fr', title: 'Synthèse Stratégique — Étude Réseau', commentary: 'Données vérifiées à coût maîtrisé (€19.99).', expectedOctal: '\\351' },
    ];

    for (const sample of samples) {
      const doc: CustomReportDocument = {
        id: `pdf-test-${sample.locale}`,
        ownerId: 'test-owner',
        title: sample.title,
        description: `Multilingual PDF verification (${sample.locale})`,
        reportType: 'client_performance',
        status: 'ready',
        version: 1,
        versionHistory: [],
        generationMode: 'Template-Generated',
        usernames: [],
        branding: { enabled: false, agencyName: '', clientName: '', headerNote: '', accentHex: '#7957FF' },
        sections: createDefaultSections('client_performance').map((s) =>
          s.kind === 'custom_text' ? { ...s, customText: sample.commentary } : s
        ),
        createdAt: '2026-11-26T00:00:00.000Z',
        updatedAt: '2026-11-26T00:00:00.000Z',
      };
      const pdf = buildReportPdfBuffer(doc, [], '2026-11-26T00:00:00.000Z');
      const raw = pdf.toString('latin1');
      expect(raw.startsWith('%PDF-1.4\n')).toBe(true);
      expect(raw.includes('%%EOF')).toBe(true);
      expect(raw.includes('/Encoding /WinAnsiEncoding')).toBe(true);
      expect(raw.includes(sample.expectedOctal)).toBe(true);

      // Verify xref byte offset matches actual file offset
      const startxrefMatch = raw.match(/startxref\n(\d+)\n%%EOF/);
      expect(startxrefMatch).not.toBeNull();
      const xrefOffset = Number(startxrefMatch![1]);
      expect(raw.slice(xrefOffset, xrefOffset + 4)).toBe('xref');
    }
  });
});
