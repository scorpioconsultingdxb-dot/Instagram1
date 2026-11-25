import { isDatabaseConfigured, isLocalDevFallbackAllowed } from '@/lib/env';
import {
  readDbUserModuleState,
  updateDbUserModuleState,
} from '@/lib/db/repositories/user-module-state.repo';
import { readJsonStore, updateJsonStore } from '@/lib/storage/persistence';
import { sanitizeCsvFormulaCell } from '@/lib/reports/export';
import type { SavedProfileRecord } from '@/lib/dashboard/store';
import {
  createDefaultSections,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  type AgencyReportBranding,
  type CustomReportDocument,
  type ReportBuilderType,
  type ReportSectionConfig,
  type ReportSectionKind,
  type ReportVersionSnapshot,
} from './builder-shared';

export {
  createDefaultSections,
  REPORT_TYPE_LABELS,
  REPORT_TYPES,
  type AgencyReportBranding,
  type CustomReportDocument,
  type ReportBuilderType,
  type ReportSectionConfig,
  type ReportSectionKind,
  type ReportVersionSnapshot,
};

const REPORT_BUILDER_STORE = 'report-builder.json';

export function listUserReports(userId: string): CustomReportDocument[] {
  const all = readJsonStore<Record<string, CustomReportDocument[]>>(REPORT_BUILDER_STORE, () => ({}));
  return all[userId] ?? [];
}

export function saveUserReport(
  userId: string,
  doc: CustomReportDocument
): CustomReportDocument[] {
  let nextList: CustomReportDocument[] = [];
  updateJsonStore<Record<string, CustomReportDocument[]>>(
    REPORT_BUILDER_STORE,
    () => ({}),
    (all) => {
      const existing = all[userId] ?? [];
      const idx = existing.findIndex((r) => r.id === doc.id);
      nextList =
        idx >= 0
          ? existing.map((r) => (r.id === doc.id ? doc : r))
          : [doc, ...existing].slice(0, 60);
      return { ...all, [userId]: nextList };
    }
  );
  return nextList;
}

export function deleteUserReport(userId: string, reportId: string): CustomReportDocument[] {
  let nextList: CustomReportDocument[] = [];
  updateJsonStore<Record<string, CustomReportDocument[]>>(
    REPORT_BUILDER_STORE,
    () => ({}),
    (all) => {
      nextList = (all[userId] ?? []).filter((r) => r.id !== reportId);
      return { ...all, [userId]: nextList };
    }
  );
  return nextList;
}

export async function loadUserReports(userId: string): Promise<CustomReportDocument[]> {
  if (isDatabaseConfigured()) {
    return readDbUserModuleState<CustomReportDocument[]>(userId, 'customReports', () => []);
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  return listUserReports(userId);
}

export async function persistUserReport(
  userId: string,
  doc: CustomReportDocument
): Promise<CustomReportDocument[]> {
  if (isDatabaseConfigured()) {
    return updateDbUserModuleState<CustomReportDocument[]>(
      userId,
      'customReports',
      () => [],
      (existing) => {
        const idx = existing.findIndex((r) => r.id === doc.id);
        return idx >= 0
          ? existing.map((r) => (r.id === doc.id ? doc : r))
          : [doc, ...existing].slice(0, 60);
      }
    );
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  return saveUserReport(userId, doc);
}

export async function removeUserReport(
  userId: string,
  reportId: string
): Promise<CustomReportDocument[]> {
  if (isDatabaseConfigured()) {
    return updateDbUserModuleState<CustomReportDocument[]>(
      userId,
      'customReports',
      () => [],
      (existing) => existing.filter((r) => r.id !== reportId)
    );
  }
  if (!isLocalDevFallbackAllowed()) {
    throw new Error('PostgreSQL DATABASE_URL is not configured.');
  }
  return deleteUserReport(userId, reportId);
}

export function buildReportMarkdown(
  report: CustomReportDocument,
  profiles: SavedProfileRecord[]
): string {
  const matched = profiles.filter((p) =>
    report.usernames.includes(p.username.toLowerCase())
  );
  const lines: string[] = [];

  if (report.branding.enabled && report.branding.agencyName) {
    lines.push(`> **${report.branding.agencyName}**${report.branding.clientName ? ` · Client: ${report.branding.clientName}` : ''}`);
    if (report.branding.headerNote) lines.push(`> ${report.branding.headerNote}`);
    lines.push('');
  }

  lines.push(`# ${report.title}`);
  lines.push('');
  lines.push(
    `- **Report Type:** ${REPORT_TYPE_LABELS[report.reportType]} | **Version:** v${report.version} | **Mode:** ${report.generationMode} (Not AI-Generated)`
  );
  lines.push(`- **Generated At:** ${new Date().toISOString()}`);
  if (report.description) {
    lines.push('');
    lines.push(report.description);
  }
  lines.push('');

  for (const sec of report.sections.filter((s) => s.enabled)) {
    lines.push(`## ${sec.title}`);
    lines.push('');
    if (sec.kind === 'metric_cards' || sec.kind === 'comparison_table') {
      if (matched.length === 0) {
        lines.push('_No saved profiles attached to this report yet._');
      } else {
        lines.push('| Profile | Category | Followers | Est. ER | Cadence | Data Class |');
        lines.push('| --- | --- | ---: | ---: | ---: | --- |');
        for (const p of matched) {
          lines.push(
            `| @${p.username} | ${p.profile.category} | ${p.profile.followersCount !== null ? p.profile.followersCount.toLocaleString() : 'N/A'} | ${p.profile.estimatedEngagementRate !== null ? `${p.profile.estimatedEngagementRate}%` : 'N/A'} | ${p.profile.postingCadencePerWeek !== null ? `${p.profile.postingCadencePerWeek}/wk` : 'N/A'} | ${p.dataClass.toUpperCase()} |`
          );
        }
      }
    } else if (sec.kind === 'trend_summary') {
      if (matched.length === 0) {
        lines.push('_Attach profiles with historical checkpoints to render trend summaries._');
      } else {
        for (const p of matched) {
          const pts = p.profile.historicalTrend;
          const first = pts[0];
          const last = pts[pts.length - 1];
          const delta = first && last ? last.followers - first.followers : null;
          lines.push(
            `- **@${p.username}**: ${pts.length} recorded checkpoint(s)${delta !== null ? ` · Window Δ ${delta >= 0 ? '+' : ''}${delta.toLocaleString()} followers` : ''}`
          );
        }
      }
    } else if (sec.kind === 'research_notes') {
      lines.push(
        '_Private customer notes are excluded from shared exports by default unless explicitly entered in Analyst Commentary._'
      );
    } else if (sec.kind === 'custom_text') {
      lines.push(sec.customText?.trim() || '_No custom commentary entered._');
    } else if (sec.kind === 'source_disclosure') {
      lines.push(
        'This report is **Template-Generated** from deterministic Viewora calculations over recorded workspace data (public, cached, user-provided, or clearly labeled demo datasets). Viewora never accesses private Instagram accounts or fabricates live API outputs.'
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function buildReportCsv(
  report: CustomReportDocument,
  profiles: SavedProfileRecord[]
): string {
  const matched = profiles.filter((p) =>
    report.usernames.includes(p.username.toLowerCase())
  );
  const exportedAt = new Date().toISOString();
  const rows: string[] = [
    [
      'ReportTitle',
      'ReportType',
      'Version',
      'GenerationMode',
      'Username',
      'Category',
      'Followers',
      'Following',
      'Posts',
      'EstimatedERPercent',
      'PostingCadencePerWeek',
      'DataClass',
      'ProviderLabel',
      'ExportedAt',
    ]
      .map(sanitizeCsvFormulaCell)
      .join(','),
  ];

  if (matched.length === 0) {
    rows.push(
      [
        report.title,
        REPORT_TYPE_LABELS[report.reportType],
        `v${report.version}`,
        report.generationMode,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'N/A',
        'No profiles attached',
        exportedAt,
      ]
        .map(sanitizeCsvFormulaCell)
        .join(',')
    );
  } else {
    for (const p of matched) {
      rows.push(
        [
          report.title,
          REPORT_TYPE_LABELS[report.reportType],
          `v${report.version}`,
          report.generationMode,
          `@${p.username}`,
          p.profile.category,
          p.profile.followersCount,
          p.profile.followingCount,
          p.profile.postsCount,
          p.profile.estimatedEngagementRate,
          p.profile.postingCadencePerWeek,
          p.dataClass,
          p.providerLabel,
          exportedAt,
        ]
          .map(sanitizeCsvFormulaCell)
          .join(',')
      );
    }
  }

  return rows.join('\n');
}
