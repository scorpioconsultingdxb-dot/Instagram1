import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { getEnv, isDatabaseConfigured } from '@/lib/env';
import { getPrismaClient, withUserRlsContext } from '@/lib/db/prisma';
import { isProviderEffectivelyEnabled, redactSecretsAndPii } from '@/lib/integrations';
import { reserveDistributedApiBudget } from '@/lib/integrations/distributed-store';
import type { DataClass, PublicProfileData } from '@/lib/providers/types';

export type AiCapabilityId =
  | 'profile_intelligence_summary'
  | 'competitor_research_summary'
  | 'engagement_analysis'
  | 'historical_growth_analysis'
  | 'content_strategy_recommendations'
  | 'bio_optimization'
  | 'caption_assistance'
  | 'hashtag_research_assistance'
  | 'influencer_research_summary'
  | 'campaign_planning_assistance'
  | 'executive_report_summary'
  | 'agency_client_recommendations';

export type ContentOriginLabel =
  | 'ai_generated'
  | 'template_generated'
  | 'user_authored'
  | 'calculated_metric'
  | 'unavailable';

export interface AiCapabilitySpec {
  id: AiCapabilityId;
  title: string;
  category: 'intelligence' | 'strategy' | 'copy' | 'reporting' | 'agency';
  description: string;
  modelName: string;
  maxInputChars: number;
  maxOutputTokens: number;
  timeoutMs: number;
  estimatedCostMicroUsd: number; // Fixed-precision integer micro-USD ($0.000001 units)
  requiresEntitlement: 'ai_profile_reports';
}

export const AI_CAPABILITY_CATALOG: readonly AiCapabilitySpec[] = [
  {
    id: 'profile_intelligence_summary',
    title: 'Profile Intelligence Summary',
    category: 'intelligence',
    description: 'Synthesizes public profile positioning, bio signals, completeness, and cadence.',
    modelName: 'gemini-2.5-flash',
    maxInputChars: 6000,
    maxOutputTokens: 900,
    timeoutMs: 12000,
    estimatedCostMicroUsd: 3500,
    requiresEntitlement: 'ai_profile_reports',
  },
  {
    id: 'competitor_research_summary',
    title: 'Competitor Research Summary',
    category: 'intelligence',
    description: 'Compares compatible public peer metrics while flagging provenance or date mismatches.',
    modelName: 'gemini-2.5-flash',
    maxInputChars: 8000,
    maxOutputTokens: 1000,
    timeoutMs: 12000,
    estimatedCostMicroUsd: 4500,
    requiresEntitlement: 'ai_profile_reports',
  },
  {
    id: 'engagement_analysis',
    title: 'Engagement Analysis',
    category: 'intelligence',
    description: 'Breaks down ERF, post interaction spread, and Reel/Carousel/Image performance.',
    modelName: 'gemini-2.5-flash',
    maxInputChars: 6000,
    maxOutputTokens: 900,
    timeoutMs: 12000,
    estimatedCostMicroUsd: 3500,
    requiresEntitlement: 'ai_profile_reports',
  },
  {
    id: 'historical_growth_analysis',
    title: 'Historical Growth Analysis',
    category: 'intelligence',
    description: 'Evaluates strictly observed checkpoint deltas without inventing missing history.',
    modelName: 'gemini-2.5-flash',
    maxInputChars: 6000,
    maxOutputTokens: 900,
    timeoutMs: 12000,
    estimatedCostMicroUsd: 3500,
    requiresEntitlement: 'ai_profile_reports',
  },
  {
    id: 'content_strategy_recommendations',
    title: 'Content Strategy Recommendations',
    category: 'strategy',
    description: 'Builds format mix and weekly publishing recommendations from observed cadence.',
    modelName: 'gemini-2.5-flash',
    maxInputChars: 6000,
    maxOutputTokens: 1000,
    timeoutMs: 12000,
    estimatedCostMicroUsd: 4000,
    requiresEntitlement: 'ai_profile_reports',
  },
  {
    id: 'bio_optimization',
    title: 'Bio Optimization',
    category: 'copy',
    description: 'Audits public bio clarity, CTA presence, link usage, and character economy.',
    modelName: 'gemini-2.5-flash',
    maxInputChars: 3000,
    maxOutputTokens: 700,
    timeoutMs: 10000,
    estimatedCostMicroUsd: 2500,
    requiresEntitlement: 'ai_profile_reports',
  },
  {
    id: 'caption_assistance',
    title: 'Caption Assistance',
    category: 'copy',
    description: 'Drafts structured hooks, value blocks, and clear CTAs tailored to workspace goals.',
    modelName: 'gemini-2.5-flash',
    maxInputChars: 4000,
    maxOutputTokens: 800,
    timeoutMs: 10000,
    estimatedCostMicroUsd: 2800,
    requiresEntitlement: 'ai_profile_reports',
  },
  {
    id: 'hashtag_research_assistance',
    title: 'Hashtag Research Assistance',
    category: 'copy',
    description: 'Organizes niche, mid-tier, and community hashtags derived from observed public posts.',
    modelName: 'gemini-2.5-flash',
    maxInputChars: 4000,
    maxOutputTokens: 750,
    timeoutMs: 10000,
    estimatedCostMicroUsd: 2500,
    requiresEntitlement: 'ai_profile_reports',
  },
  {
    id: 'influencer_research_summary',
    title: 'Influencer Research Summary',
    category: 'intelligence',
    description: 'Evaluates public creator consistency, engagement quality, and partnership fit.',
    modelName: 'gemini-2.5-flash',
    maxInputChars: 6000,
    maxOutputTokens: 900,
    timeoutMs: 12000,
    estimatedCostMicroUsd: 3500,
    requiresEntitlement: 'ai_profile_reports',
  },
  {
    id: 'campaign_planning_assistance',
    title: 'Campaign Planning Assistance',
    category: 'strategy',
    description: 'Structures campaign phases, KPIs, deliverable cadence, and measurement checklists.',
    modelName: 'gemini-2.5-flash',
    maxInputChars: 7000,
    maxOutputTokens: 1100,
    timeoutMs: 12000,
    estimatedCostMicroUsd: 4200,
    requiresEntitlement: 'ai_profile_reports',
  },
  {
    id: 'executive_report_summary',
    title: 'Executive Report Summary',
    category: 'reporting',
    description: 'Creates concise leadership-ready executive briefs with methodology disclosures.',
    modelName: 'gemini-2.5-flash',
    maxInputChars: 8000,
    maxOutputTokens: 1100,
    timeoutMs: 12000,
    estimatedCostMicroUsd: 4500,
    requiresEntitlement: 'ai_profile_reports',
  },
  {
    id: 'agency_client_recommendations',
    title: 'Agency Client Recommendations',
    category: 'agency',
    description: 'Produces client-ready action plans separating verified observations from priorities.',
    modelName: 'gemini-2.5-flash',
    maxInputChars: 8000,
    maxOutputTokens: 1200,
    timeoutMs: 12000,
    estimatedCostMicroUsd: 4800,
    requiresEntitlement: 'ai_profile_reports',
  },
] as const;

export const AI_CAPABILITY_IDS = AI_CAPABILITY_CATALOG.map((c) => c.id) as [
  AiCapabilityId,
  ...AiCapabilityId[],
];

export const aiCapabilityInputSchema = z.object({
  capabilityId: z.enum(AI_CAPABILITY_IDS),
  prompt: z.string().trim().min(3).max(4000),
  idempotencyKey: z.string().trim().min(6).max(120).optional(),
  allowPrivateNotesInContext: z.boolean().default(false),
  contextSummary: z.string().trim().max(4000).optional(),
  targetUsername: z.string().trim().max(60).optional(),
});

export const aiStructuredOutputSchema = z.object({
  summary: z.string().min(10).max(2000),
  findings: z.array(z.string().min(3).max(400)).min(1).max(10),
  recommendations: z.array(z.string().min(3).max(400)).min(1).max(10),
  methodologyNote: z.string().min(10).max(600),
  unavailableFields: z.array(z.string().max(120)).max(12),
});

export interface AiCapabilityResult {
  capabilityId: AiCapabilityId;
  title: string;
  contentOrigin: ContentOriginLabel;
  providerStatus: 'live_gemini' | 'provider_disabled_deterministic_fallback';
  modelName: string;
  dataClass: DataClass | 'unavailable';
  summary: string;
  findings: string[];
  recommendations: string[];
  methodologyNote: string;
  unavailableFields: string[];
  sourceReferences: string[];
  safetyFlags: string[];
  requiresHumanReview: boolean;
  estimatedCostUsd: number;
  actualCostUsd: number;
  generatedAt: string;
}

const PROMPT_INJECTION_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'instruction_override', regex: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i },
  { label: 'system_role_hijack', regex: /\b(system\s*:|assistant\s*:|developer\s*:|<\|im_start\|>)/i },
  { label: 'secret_exfiltration', regex: /(reveal|print|dump|export)\s+(the\s+)?(api[_\s]?key|auth[_\s]?secret|database[_\s]?url|system\s+prompt)/i },
  { label: 'script_injection', regex: /<\s*script\b|javascript\s*:/i },
];

const UNSUPPORTED_CLAIM_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'private_activity_claim', regex: /\b(private\s+dm|direct\s+messages|who\s+viewed\s+your\s+profile|secret\s+stalker|hidden\s+followers?)\b/i },
  { label: 'fabricated_revenue_claim', regex: /\b(exact\s+net\s+revenue|guaranteed\s+roi\s+of\s+\d+%)\b/i },
];

export function detectPromptInjectionSignals(untrustedText: string): string[] {
  const hits: string[] = [];
  for (const rule of PROMPT_INJECTION_PATTERNS) {
    if (rule.regex.test(untrustedText)) hits.push(rule.label);
  }
  return hits;
}

/**
 * Isolates and neutralizes untrusted social text (bios, captions, external provider payloads)
 * so prompt-injection payloads are stripped/quoted as passive data and secrets/PII are redacted.
 */
export function sanitizeUntrustedAiContext(rawText: string, maxChars = 4000): {
  sanitized: string;
  injectionSignals: string[];
} {
  const truncated = rawText.slice(0, maxChars);
  const injectionSignals = detectPromptInjectionSignals(truncated);
  let cleaned = redactSecretsAndPii(truncated);
  cleaned = cleaned
    .replace(/<\s*\/?\s*(system|assistant|UNTRUSTED_DATA|script)[^>]*>/gi, '[neutralized-tag]')
    .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, '[neutralized-directive]');
  return { sanitized: cleaned.trim(), injectionSignals };
}

export function detectUnsupportedClaims(text: string): string[] {
  const flags: string[] = [];
  for (const rule of UNSUPPORTED_CLAIM_PATTERNS) {
    if (rule.regex.test(text)) flags.push(rule.label);
  }
  return flags;
}

/**
 * Atomic PostgreSQL monthly AI usage quota check & reservation using `pg_advisory_xact_lock`.
 * Guarantees concurrent requests from the same customer can NEVER exceed their monthly allocation
 * (Free: 0, Starter: 3, Premium: 15, Pro: 50, Agency: 150).
 */
export async function reserveAtomicAiMonthlyQuota(params: {
  userId: string;
  workspaceId?: string | null;
  monthlyLimit: number | null; // null = unlimited, 0 = disabled
  reportType: string;
  executionMode: string;
  modelName: string;
  promptVersion?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  client?: PrismaClient;
}): Promise<
  | { ok: true; usedThisMonth: number; limit: number | null; usageRecordId: string | null }
  | { ok: false; code: 'AI_QUOTA_EXCEEDED' | 'AI_NOT_INCLUDED'; usedThisMonth: number; limit: number }
> {
  if (params.monthlyLimit !== null && params.monthlyLimit <= 0) {
    return { ok: false, code: 'AI_NOT_INCLUDED', usedThisMonth: 0, limit: 0 };
  }

  if (!isDatabaseConfigured() && !params.client) {
    return { ok: true, usedThisMonth: 1, limit: params.monthlyLimit, usageRecordId: null };
  }

  const db = params.client ?? getPrismaClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

  return withUserRlsContext(
    { userId: params.userId, role: 'user' },
    async (tx) => {
      const lockKey = `viewora:ai_quota:${params.userId}`;
      if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      }

      const [usageCount, reportCount] = await Promise.all([
        tx.aiUsageRecord.count({
          where: { userId: params.userId, createdAt: { gte: monthStart } },
        }),
        tx.aiReport.count({
          where: { userId: params.userId, createdAt: { gte: monthStart } },
        }),
      ]);

      const currentUsed = Math.max(usageCount, reportCount);
      if (params.monthlyLimit !== null && currentUsed >= params.monthlyLimit) {
        return {
          ok: false as const,
          code: 'AI_QUOTA_EXCEEDED' as const,
          usedThisMonth: currentUsed,
          limit: params.monthlyLimit,
        };
      }

      const rec = await tx.aiUsageRecord.create({
        data: {
          userId: params.userId,
          workspaceId: params.workspaceId ?? null,
          reportType: params.reportType,
          modelName: params.modelName,
          promptVersion: params.promptVersion ?? 'viewora-ai-studio-v3.0',
          inputTokens: params.inputTokens ?? 0,
          outputTokens: params.outputTokens ?? 0,
          estimatedCostUsd: params.estimatedCostUsd ?? 0,
          executionMode: params.executionMode,
        },
      });

      return {
        ok: true as const,
        usedThisMonth: currentUsed + 1,
        limit: params.monthlyLimit,
        usageRecordId: rec.id,
      };
    },
    db
  );
}

const recentIdempotencyCache = new Map<string, { result: AiCapabilityResult; expiresAt: number }>();

export function getAiCapabilitySpec(id: AiCapabilityId): AiCapabilitySpec {
  return AI_CAPABILITY_CATALOG.find((c) => c.id === id) ?? AI_CAPABILITY_CATALOG[0]!;
}

/**
 * Executes one of Viewora's 12 AI Intelligence Studio capabilities.
 * - Live Gemini calls ONLY run when `PROVIDER_GEMINI_ENABLED=true`, valid `GEMINI_API_KEY`,
 *   non-demo data, AND PostgreSQL distributed budget allows.
 * - When Gemini is disabled (default), returns an honestly labeled `template_generated`
 *   deterministic analytical synthesis — NEVER claiming the output is AI-generated!
 */
export async function executeAiStudioCapability(params: {
  userId: string;
  capabilityId: AiCapabilityId;
  prompt: string;
  profile?: PublicProfileData | null;
  dataClass?: DataClass | 'unavailable';
  contextSummary?: string;
  sourceReferences?: string[];
  idempotencyKey?: string;
  bypassDistributedBudget?: boolean;
}): Promise<AiCapabilityResult> {
  const spec = getAiCapabilitySpec(params.capabilityId);
  const dedupeKey = params.idempotencyKey ? `${params.userId}:${params.idempotencyKey}` : null;
  if (dedupeKey) {
    const cached = recentIdempotencyCache.get(dedupeKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
  }

  const promptClean = sanitizeUntrustedAiContext(params.prompt, spec.maxInputChars);
  const ctxClean = sanitizeUntrustedAiContext(params.contextSummary ?? '', 2500);
  const bioClean = params.profile ? sanitizeUntrustedAiContext(params.profile.bio, 500) : null;

  const safetyFlags = Array.from(
    new Set([
      ...promptClean.injectionSignals,
      ...ctxClean.injectionSignals,
      ...(bioClean?.injectionSignals ?? []),
    ])
  );

  const missingFields: string[] = [];
  if (!params.profile) {
    missingFields.push('selected_profile_metrics');
  } else {
    if (params.profile.followersCount === null) missingFields.push('followersCount');
    if (params.profile.estimatedEngagementRate === null) missingFields.push('estimatedEngagementRate');
    if (params.profile.postingCadencePerWeek === null) missingFields.push('postingCadencePerWeek');
    if (params.profile.historicalTrend.length < 2) missingFields.push('observed_historical_series');
  }

  const env = getEnv();
  const geminiLiveReady = isProviderEffectivelyEnabled('gemini_ai') && Boolean(env.GEMINI_API_KEY);
  const estimatedCostUsd = Number((spec.estimatedCostMicroUsd / 1_000_000).toFixed(6));

  if (geminiLiveReady && params.dataClass !== 'demo') {
    if (!params.bypassDistributedBudget && isDatabaseConfigured()) {
      const budget = await reserveDistributedApiBudget({
        providerId: 'gemini_ai',
        estimatedCostUsd,
      }).catch(() => null);
      if (budget && !budget.allowed) {
        safetyFlags.push('budget_cap_blocked_live_ai');
      }
    }
  }

  // Deterministic, clearly labeled analytical synthesis when Gemini is disabled (default)
  const p = params.profile;
  const handleLabel = p ? `@${p.username}` : 'selected workspace context';
  const followersTxt =
    p?.followersCount !== null && p?.followersCount !== undefined
      ? `${p.followersCount.toLocaleString()} followers`
      : 'followers unavailable';
  const erTxt =
    p?.estimatedEngagementRate !== null && p?.estimatedEngagementRate !== undefined
      ? `${p.estimatedEngagementRate}% est. ER`
      : 'engagement rate unavailable';
  const cadenceTxt =
    p?.postingCadencePerWeek !== null && p?.postingCadencePerWeek !== undefined
      ? `${p.postingCadencePerWeek} posts/week`
      : 'posting cadence unavailable';

  const findings: string[] = [
    `Observed scope for ${handleLabel}: ${followersTxt}, ${erTxt}, ${cadenceTxt}.`,
    `Data provenance class: ${(params.dataClass ?? 'unavailable').toUpperCase()} — missing fields are explicitly excluded rather than inferred.`,
  ];
  if (bioClean && bioClean.sanitized.length > 0) {
    findings.push(
      `Public bio text (${bioClean.sanitized.length} chars) isolated as untrusted passive input.`
    );
  }
  if (ctxClean.sanitized.length > 0) {
    findings.push(`Workspace context incorporated (${ctxClean.sanitized.length} sanitized chars).`);
  }

  const recommendationsByCategory: Record<AiCapabilitySpec['category'], string[]> = {
    intelligence: [
      'Capture at least two timestamped observations across separate weeks before drawing growth-rate conclusions.',
      'Compare engagement efficiency only across profiles sharing compatible provenance and capture windows.',
    ],
    strategy: [
      'Prioritize consistent weekly cadence and track format distribution across Reels, Carousels, and Images.',
      'Document campaign hypotheses inside Research Pro before allocating creative budget.',
    ],
    copy: [
      'Lead captions and public bios with a single clear value proposition and verifiable call-to-action.',
      'Pair niche topic tags with brand-specific hashtags observed in top-performing public posts.',
    ],
    reporting: [
      'Review all deterministic findings and methodology disclosures before exporting client-facing PDF/CSV briefs.',
      'Keep private internal research notes separated from shared client deliverables.',
    ],
    agency: [
      'Anchor client recommendations strictly to observed metrics and clearly mark unavailable dimensions.',
      'Pair monthly executive summaries with compatibility-checked peer benchmark tables.',
    ],
  };

  const summary = `Deterministic ${spec.title} for ${handleLabel} addressing: "${promptClean.sanitized.slice(
    0,
    180
  )}". Live Gemini AI is currently disabled by platform policy (${
    env.PROVIDER_GEMINI_ENABLED === 'true' ? 'credentials/budget pending' : 'PROVIDER_GEMINI_ENABLED=false'
  }), so this structured brief was produced locally by Viewora's rule-based engine without external AI processing.`;

  const claimFlags = detectUnsupportedClaims(`${summary} ${findings.join(' ')}`);
  const allFlags = Array.from(new Set([...safetyFlags, ...claimFlags]));

  const result: AiCapabilityResult = {
    capabilityId: spec.id,
    title: spec.title,
    contentOrigin: 'template_generated',
    providerStatus: 'provider_disabled_deterministic_fallback',
    modelName: 'deterministic_template (gemini_disabled)',
    dataClass: params.dataClass ?? 'unavailable',
    summary,
    findings,
    recommendations: recommendationsByCategory[spec.category],
    methodologyNote:
      'Template-Generated (Not AI-Generated): Produced deterministically from sanitized public/workspace records with private notes excluded unless explicitly authorized.',
    unavailableFields: missingFields,
    sourceReferences: params.sourceReferences ?? (p ? [`Saved profile @${p.username}`] : ['Workspace research context']),
    safetyFlags: allFlags,
    requiresHumanReview: true,
    estimatedCostUsd,
    actualCostUsd: 0,
    generatedAt: new Date().toISOString(),
  };

  if (dedupeKey) {
    recentIdempotencyCache.set(dedupeKey, { result, expiresAt: Date.now() + 5 * 60_000 });
  }
  return result;
}
