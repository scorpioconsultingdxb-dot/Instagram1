export const REPORT_TYPES = [
  'executive_summary',
  'competitor_analysis',
  'engagement_analysis',
  'growth_analysis',
  'research_summary',
  'brand_audit',
  'content_performance',
  'client_performance',
  'custom_report',
] as const;

export type ReportBuilderType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Record<ReportBuilderType, string> = {
  executive_summary: 'Executive Summary',
  competitor_analysis: 'Competitor Analysis',
  engagement_analysis: 'Engagement Analysis',
  growth_analysis: 'Growth Analysis',
  research_summary: 'Research Summary',
  brand_audit: 'Brand Audit',
  content_performance: 'Content Performance',
  client_performance: 'Client Performance',
  custom_report: 'Custom Report',
};

export type ReportSectionKind =
  | 'metric_cards'
  | 'trend_summary'
  | 'comparison_table'
  | 'research_notes'
  | 'custom_text'
  | 'source_disclosure';

export interface ReportSectionConfig {
  id: string;
  kind: ReportSectionKind;
  title: string;
  enabled: boolean;
  customText?: string;
}

export interface AgencyReportBranding {
  enabled: boolean;
  agencyName: string;
  clientName: string;
  accentHex: string;
  headerNote: string;
}

export interface ReportVersionSnapshot {
  version: number;
  savedAt: string;
  title: string;
  description: string;
  sections: ReportSectionConfig[];
  usernames: string[];
  summaryNote: string;
}

export interface CustomReportDocument {
  id: string;
  ownerId: string;
  reportType: ReportBuilderType;
  title: string;
  description: string;
  status: 'draft' | 'ready' | 'archived';
  usernames: string[];
  sections: ReportSectionConfig[];
  branding: AgencyReportBranding;
  version: number;
  versionHistory: ReportVersionSnapshot[];
  generationMode: 'Template-Generated';
  createdAt: string;
  updatedAt: string;
}

export function createDefaultSections(reportType: ReportBuilderType): ReportSectionConfig[] {
  return [
    {
      id: 'sec-metrics',
      kind: 'metric_cards',
      title: 'Key Profile Metric Cards',
      enabled: true,
    },
    {
      id: 'sec-trend',
      kind: 'trend_summary',
      title: 'Historical Trajectory & Moving Averages',
      enabled: reportType !== 'research_summary',
    },
    {
      id: 'sec-compare',
      kind: 'comparison_table',
      title: 'Profile Comparison Table',
      enabled: true,
    },
    {
      id: 'sec-notes',
      kind: 'research_notes',
      title: 'Workspace Observations (Opt-In Excerpt)',
      enabled: reportType === 'research_summary' || reportType === 'brand_audit',
    },
    {
      id: 'sec-custom',
      kind: 'custom_text',
      title: 'Analyst Commentary & Recommendations',
      enabled: true,
      customText:
        'Summary notes prepared from recorded Viewora workspace datasets. Verify live channel KPIs before executive publication.',
    },
    {
      id: 'sec-source',
      kind: 'source_disclosure',
      title: 'Data Provenance & Methodology Disclosure',
      enabled: true,
    },
  ];
}
