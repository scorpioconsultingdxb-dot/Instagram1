import type { SavedProfileRecord } from '@/lib/dashboard/store';
import { REPORT_TYPE_LABELS, type CustomReportDocument } from './builder-shared';

/**
 * Pure TypeScript, zero-dependency, standards-compliant PDF 1.4 binary generator.
 * Produces real downloadable `%PDF-1.4` files with valid cross-reference (`xref`)
 * byte offsets, multi-page pagination, Helvetica / Helvetica-Bold built-in Type1
 * fonts, agency branding header (when entitled), deterministic metrics tables,
 * and mandatory provenance / methodology disclosure (never labeled AI-generated).
 */

interface PdfLine {
  text: string;
  font: 'F1' | 'F2'; // F1 = Helvetica, F2 = Helvetica-Bold
  size: number;
  leading: number;
  indent?: number;
  colorRgb?: [number, number, number];
}

function toAsciiPdfSafe(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00B7/g, '|')
    .replace(/\u0394/g, 'Delta')
    .replace(/\u2192/g, '->')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function escapePdfLiteral(input: string): string {
  return toAsciiPdfSafe(input)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = toAsciiPdfSafe(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const out: string[] = [];
  let line = '';
  for (const word of words) {
    if (!line) {
      line = word.slice(0, maxChars);
    } else if (line.length + 1 + word.length <= maxChars) {
      line += ` ${word}`;
    } else {
      out.push(line);
      line = word.slice(0, maxChars);
    }
  }
  if (line) out.push(line);
  return out;
}

function buildReportLines(
  report: CustomReportDocument,
  profiles: SavedProfileRecord[],
  generatedAtIso: string
): PdfLine[] {
  const matched = profiles.filter((p) =>
    report.usernames.includes(p.username.toLowerCase())
  );
  const lines: PdfLine[] = [];

  // Branding Header Banner
  if (report.branding.enabled && report.branding.agencyName.trim()) {
    const clientSuffix = report.branding.clientName.trim()
      ? `  |  Client: ${report.branding.clientName.trim()}`
      : '';
    lines.push({
      text: `${report.branding.agencyName.trim()}${clientSuffix}`,
      font: 'F2',
      size: 11,
      leading: 15,
      colorRgb: [0.41, 0.25, 0.94],
    });
    if (report.branding.headerNote.trim()) {
      for (const wrapped of wrapText(report.branding.headerNote, 88)) {
        lines.push({
          text: wrapped,
          font: 'F1',
          size: 9.5,
          leading: 13,
          colorRgb: [0.35, 0.4, 0.48],
        });
      }
    }
    lines.push({ text: '', font: 'F1', size: 8, leading: 8 });
  } else {
    lines.push({
      text: 'VIEWORA SOCIAL INTELLIGENCE  |  REPORT STUDIO',
      font: 'F2',
      size: 9.5,
      leading: 14,
      colorRgb: [0.41, 0.25, 0.94],
    });
  }

  // Document Title
  for (const wrapped of wrapText(report.title, 54)) {
    lines.push({
      text: wrapped,
      font: 'F2',
      size: 18,
      leading: 23,
      colorRgb: [0.06, 0.09, 0.16],
    });
  }

  // Metadata Strip
  lines.push({
    text: `Template: ${REPORT_TYPE_LABELS[report.reportType]}  |  Version: v${report.version}  |  Status: ${report.status.toUpperCase()}`,
    font: 'F1',
    size: 9.5,
    leading: 14,
    colorRgb: [0.32, 0.38, 0.47],
  });
  lines.push({
    text: `Generation Mode: ${report.generationMode} (Not AI-Generated)  |  Exported: ${generatedAtIso}`,
    font: 'F1',
    size: 9,
    leading: 14,
    colorRgb: [0.32, 0.38, 0.47],
  });

  if (report.description.trim()) {
    lines.push({ text: '', font: 'F1', size: 6, leading: 8 });
    for (const wrapped of wrapText(report.description, 88)) {
      lines.push({
        text: wrapped,
        font: 'F1',
        size: 10,
        leading: 14,
        colorRgb: [0.12, 0.16, 0.23],
      });
    }
  }

  lines.push({
    text: '-----------------------------------------------------------------------------------------------',
    font: 'F1',
    size: 8.5,
    leading: 14,
    colorRgb: [0.78, 0.82, 0.88],
  });

  for (const sec of report.sections.filter((s) => s.enabled)) {
    lines.push({
      text: sec.title.toUpperCase(),
      font: 'F2',
      size: 11.5,
      leading: 18,
      colorRgb: [0.06, 0.09, 0.16],
    });

    if (sec.kind === 'metric_cards' || sec.kind === 'comparison_table') {
      if (matched.length === 0) {
        lines.push({
          text: 'No saved workspace profiles attached to this report yet.',
          font: 'F1',
          size: 9.5,
          leading: 14,
          indent: 8,
          colorRgb: [0.39, 0.45, 0.55],
        });
      } else {
        lines.push({
          text: 'PROFILE                | CATEGORY           | FOLLOWERS   | EST. ER | CADENCE  | DATA CLASS',
          font: 'F2',
          size: 8.5,
          leading: 13,
          indent: 4,
          colorRgb: [0.28, 0.34, 0.42],
        });
        for (const p of matched) {
          const handle = `@${p.username}`.slice(0, 22).padEnd(22, ' ');
          const cat = (p.profile.category || 'Creator').slice(0, 18).padEnd(18, ' ');
          const followers = (
            p.profile.followersCount !== null ? p.profile.followersCount.toLocaleString('en-US') : 'N/A'
          ).padEnd(11, ' ');
          const er = (
            p.profile.estimatedEngagementRate !== null ? `${p.profile.estimatedEngagementRate}%` : 'N/A'
          ).padEnd(7, ' ');
          const cadence = (
            p.profile.postingCadencePerWeek !== null ? `${p.profile.postingCadencePerWeek}/wk` : 'N/A'
          ).padEnd(8, ' ');
          const cls = p.dataClass.toUpperCase();
          lines.push({
            text: `${handle} | ${cat} | ${followers} | ${er} | ${cadence} | ${cls}`,
            font: 'F1',
            size: 8.5,
            leading: 13,
            indent: 4,
            colorRgb: [0.1, 0.13, 0.2],
          });
        }
      }
    } else if (sec.kind === 'trend_summary') {
      if (matched.length === 0) {
        lines.push({
          text: 'Attach profiles with recorded historical checkpoints to render trend deltas.',
          font: 'F1',
          size: 9.5,
          leading: 14,
          indent: 8,
          colorRgb: [0.39, 0.45, 0.55],
        });
      } else {
        for (const p of matched) {
          const pts = p.profile.historicalTrend;
          const first = pts[0];
          const last = pts[pts.length - 1];
          const delta = first && last ? last.followers - first.followers : null;
          const summary = `- @${p.username}: ${pts.length} recorded checkpoint(s)${
            delta !== null
              ? ` | Window Delta: ${delta >= 0 ? '+' : ''}${delta.toLocaleString('en-US')} followers`
              : ''
          } | Source: ${p.providerLabel}`;
          for (const wrapped of wrapText(summary, 86)) {
            lines.push({
              text: wrapped,
              font: 'F1',
              size: 9.5,
              leading: 14,
              indent: 8,
              colorRgb: [0.12, 0.16, 0.23],
            });
          }
        }
      }
    } else if (sec.kind === 'research_notes') {
      for (const wrapped of wrapText(
        'Private customer research notes are strictly excluded from shared exports by default unless explicitly entered into Analyst Commentary.',
        86
      )) {
        lines.push({
          text: wrapped,
          font: 'F1',
          size: 9.5,
          leading: 14,
          indent: 8,
          colorRgb: [0.39, 0.45, 0.55],
        });
      }
    } else if (sec.kind === 'custom_text') {
      const commentary = sec.customText?.trim() || 'No custom analyst commentary entered for this revision.';
      for (const paragraph of commentary.split(/\r?\n/)) {
        for (const wrapped of wrapText(paragraph, 86)) {
          lines.push({
            text: wrapped,
            font: 'F1',
            size: 9.5,
            leading: 14,
            indent: 8,
            colorRgb: [0.12, 0.16, 0.23],
          });
        }
      }
    } else if (sec.kind === 'source_disclosure') {
      for (const wrapped of wrapText(
        'PROVENANCE & METHODOLOGY DISCLOSURE: This document is Template-Generated (not AI-generated) from deterministic Viewora calculations over recorded workspace data (public, cached, user-provided CSV, or clearly labeled demo datasets). Viewora never accesses private Instagram accounts, never scrapes behind logins, and never fabricates live external API outputs.',
        86
      )) {
        lines.push({
          text: wrapped,
          font: 'F1',
          size: 9,
          leading: 13,
          indent: 8,
          colorRgb: [0.28, 0.34, 0.42],
        });
      }
    }

    lines.push({ text: '', font: 'F1', size: 6, leading: 10 });
  }

  return lines;
}

/**
 * Generates a valid binary `%PDF-1.4` Buffer for any CustomReportDocument.
 */
export function buildReportPdfBuffer(
  report: CustomReportDocument,
  profiles: SavedProfileRecord[],
  generatedAtIso: string = new Date().toISOString()
): Buffer {
  const PAGE_WIDTH = 612; // US Letter (8.5in * 72pt)
  const PAGE_HEIGHT = 792; // US Letter (11in * 72pt)
  const MARGIN_LEFT = 48;
  const MARGIN_TOP = 744;
  const MARGIN_BOTTOM = 58;

  const allLines = buildReportLines(report, profiles, generatedAtIso);

  // Paginate lines across pages
  const pages: PdfLine[][] = [];
  let currentPage: PdfLine[] = [];
  let cursorY = MARGIN_TOP;

  for (const line of allLines) {
    if (cursorY - line.leading < MARGIN_BOTTOM && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      cursorY = MARGIN_TOP;
    }
    currentPage.push(line);
    cursorY -= line.leading;
  }
  if (currentPage.length === 0) {
    currentPage.push({
      text: report.title,
      font: 'F2',
      size: 14,
      leading: 18,
    });
  }
  pages.push(currentPage);

  // Build PDF object streams
  // Object numbering:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // 5..: Pairs of (Page object, Content stream object)
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    const pageObjId = 5 + i * 2;
    pageObjectIds.push(pageObjId);
  }

  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
  objects[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

  pages.forEach((pageLines, pageIndex) => {
    const pageObjId = 5 + pageIndex * 2;
    const contentObjId = pageObjId + 1;

    const cmds: string[] = [];
    // Top subtle accent bar
    cmds.push('0.47 0.34 1.00 rg');
    cmds.push(`0 ${PAGE_HEIGHT - 8} ${PAGE_WIDTH} 8 re f`);

    let y = MARGIN_TOP;
    for (const line of pageLines) {
      if (line.text) {
        const [r, g, b] = line.colorRgb ?? [0.06, 0.09, 0.16];
        const x = MARGIN_LEFT + (line.indent ?? 0);
        cmds.push(
          `BT /${line.font} ${line.size} Tf ${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)} rg 1 0 0 1 ${x} ${y.toFixed(1)} Tm (${escapePdfLiteral(line.text)}) Tj ET`
        );
      }
      y -= line.leading;
    }

    // Footer with page number and honest generation label
    const footerText = `Viewora Report Studio  |  Template-Generated (Not AI-Generated)  |  Page ${pageIndex + 1} of ${pages.length}`;
    cmds.push(
      `BT /F1 8 Tf 0.45 0.50 0.58 rg 1 0 0 1 ${MARGIN_LEFT} 30 Tm (${escapePdfLiteral(footerText)}) Tj ET`
    );

    const streamBody = cmds.join('\n');
    const streamLen = Buffer.byteLength(streamBody, 'latin1');

    objects[pageObjId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>`;
    objects[contentObjId] = `<< /Length ${streamLen} >>\nstream\n${streamBody}\nendstream`;
  });

  // Assemble PDF file with exact byte offsets for xref table
  const chunks: Buffer[] = [];
  let offset = 0;

  const pushStr = (s: string) => {
    const b = Buffer.from(s, 'latin1');
    chunks.push(b);
    offset += b.byteLength;
  };

  // Header + binary comment marker per PDF 1.4 spec
  pushStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const offsets: number[] = [0];
  const totalObjects = objects.length - 1;
  for (let id = 1; id <= totalObjects; id++) {
    offsets[id] = offset;
    pushStr(`${id} 0 obj\n${objects[id]}\nendobj\n`);
  }

  const xrefOffset = offset;
  pushStr(`xref\n0 ${totalObjects + 1}\n`);
  pushStr('0000000000 65535 f \n');
  for (let id = 1; id <= totalObjects; id++) {
    pushStr(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return Buffer.concat(chunks);
}
