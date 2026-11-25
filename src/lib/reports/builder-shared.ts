export const REPORT_TYPES = [
  'executive_summary',
  'competitor_analysis',
  'social_profile_audit',
  'engagement_analysis',
  'growth_analysis',
  'content_performance',
  'influencer_research',
  'client_performance',
  'campaign_review',
  'research_summary',
  'brand_audit',
  'custom_report',
] as const;

export type ReportBuilderType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Record<ReportBuilderType, string> = {
  executive_summary: 'Executive Intelligence Report',
  competitor_analysis: 'Competitor Benchmark Report',
  social_profile_audit: 'Social Profile Audit',
  engagement_analysis: 'Engagement Analysis',
  growth_analysis: 'Growth Research Report',
  content_performance: 'Content Strategy Report',
  influencer_research: 'Influencer Research Report',
  client_performance: 'Agency Client Report',
  campaign_review: 'Campaign Review Report',
  research_summary: 'Research Summary',
  brand_audit: 'Brand Audit',
  custom_report: 'Custom Research Report',
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
