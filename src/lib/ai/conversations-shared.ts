import type { AiCapabilityId, ContentOriginLabel } from './studio';

export interface ResearchContextBinding {
  savedProfileUsername?: string | null;
  researchProjectId?: string | null;
  comparisonProjectId?: string | null;
  reportId?: string | null;
  allowPrivateNotesInContext?: boolean;
}

export interface ResearchMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contentOrigin: ContentOriginLabel;
  capabilityId?: AiCapabilityId;
  findings?: string[];
  recommendations?: string[];
  sourceReferences?: string[];
  safetyFlags?: string[];
  createdAt: string;
}

export interface ResearchConversationRecord {
  id: string;
  title: string;
  archived: boolean;
  context: ResearchContextBinding;
  messages: ResearchMessageRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface UserAiConversationsState {
  userId: string;
  conversations: ResearchConversationRecord[];
  updatedAt: string;
}

export const SUGGESTED_RESEARCH_QUESTIONS: ReadonlyArray<{
  label: string;
  capabilityId: AiCapabilityId;
  prompt: string;
}> = [
  {
    label: 'Audit profile completeness & bio CTA',
    capabilityId: 'bio_optimization',
    prompt: 'Audit the public bio clarity, CTA presence, and missing public profile fields.',
  },
  {
    label: 'Benchmark engagement & format mix',
    capabilityId: 'engagement_analysis',
    prompt: 'Analyze engagement rate efficiency and Reel/Carousel/Image format balance.',
  },
  {
    label: 'Evaluate observed historical trends',
    capabilityId: 'historical_growth_analysis',
    prompt: 'Summarize observed historical growth checkpoints and flag any missing history.',
  },
  {
    label: 'Prepare executive client brief',
    capabilityId: 'executive_report_summary',
    prompt: 'Draft an executive leadership summary with transparent methodology disclosures.',
  },
];

export function exportConversationAsMarkdown(conv: ResearchConversationRecord): string {
  const lines: string[] = [
    `# ${conv.title}`,
    `- **Updated:** ${conv.updatedAt}`,
    `- **Context Profile:** ${conv.context.savedProfileUsername ? `@${conv.context.savedProfileUsername}` : 'Workspace-level'}`,
    `- **Privacy Notice:** Private notes excluded unless explicitly authorized by account owner.`,
    '',
  ];
  for (const msg of conv.messages) {
    lines.push(
      `## ${msg.role === 'user' ? 'Research Question (User-Authored)' : `Response (${msg.contentOrigin})`}`
    );
    lines.push(msg.content);
    if (msg.findings?.length) {
      lines.push('', '### Findings', ...msg.findings.map((f) => `- ${f}`));
    }
    if (msg.recommendations?.length) {
      lines.push('', '### Recommendations', ...msg.recommendations.map((r) => `- ${r}`));
    }
    if (msg.sourceReferences?.length) {
      lines.push('', `**Sources:** ${msg.sourceReferences.join('; ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
