import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAllowedCsrfOrigin } from '@/lib/auth/secret';
import { getCurrentSessionUser } from '@/lib/auth/session';
import {
  loadConfiguredPlans,
  loadUserEntitlementOverrides,
  resolveEntitlements,
} from '@/lib/entitlements/service';
import { isProviderEffectivelyEnabled } from '@/lib/integrations';
import { loadUserWorkspaceState } from '@/lib/dashboard/store';
import {
  AI_CAPABILITY_CATALOG,
  AI_CAPABILITY_IDS,
  executeAiStudioCapability,
  reserveAtomicAiMonthlyQuota,
} from '@/lib/ai/studio';
import {
  loadUserAiConversations,
  SUGGESTED_RESEARCH_QUESTIONS,
  updateUserAiConversations,
  type ResearchConversationRecord,
} from '@/lib/ai/conversations';

const studioActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_conversation'),
    title: z.string().trim().min(2).max(100),
    savedProfileUsername: z.string().trim().max(60).nullable().optional(),
    researchProjectId: z.string().max(80).nullable().optional(),
    comparisonProjectId: z.string().max(80).nullable().optional(),
    reportId: z.string().max(80).nullable().optional(),
    allowPrivateNotesInContext: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('send_message'),
    conversationId: z.string().min(1),
    capabilityId: z.enum(AI_CAPABILITY_IDS).default('profile_intelligence_summary'),
    prompt: z.string().trim().min(3).max(4000),
    idempotencyKey: z.string().trim().min(6).max(120).optional(),
  }),
  z.object({
    type: z.literal('rename_conversation'),
    conversationId: z.string().min(1),
    title: z.string().trim().min(2).max(100),
  }),
  z.object({
    type: z.literal('archive_conversation'),
    conversationId: z.string().min(1),
    archived: z.boolean(),
  }),
  z.object({
    type: z.literal('delete_conversation'),
    conversationId: z.string().min(1),
  }),
  z.object({
    type: z.literal('run_capability'),
    capabilityId: z.enum(AI_CAPABILITY_IDS),
    prompt: z.string().trim().min(3).max(4000),
    targetUsername: z.string().trim().max(60).optional(),
    contextSummary: z.string().trim().max(3000).optional(),
    idempotencyKey: z.string().trim().min(6).max(120).optional(),
  }),
]);

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const [plans, overrides, ws, convState] = await Promise.all([
    loadConfiguredPlans(),
    loadUserEntitlementOverrides(user.id),
    loadUserWorkspaceState(user.id),
    loadUserAiConversations(user.id),
  ]);
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
    plans,
    overrides,
  });

  const aiEnt = entitlements.rules.ai_profile_reports;
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const usedThisMonth = ws.reports.filter((r) => r.savedAt.startsWith(currentMonthPrefix)).length;

  return NextResponse.json({
    ok: true,
    providerStatus: {
      geminiEnabled: isProviderEffectivelyEnabled('gemini_ai'),
      modeLabel: isProviderEffectivelyEnabled('gemini_ai')
        ? 'Gemini AI Ready'
        : 'Gemini AI Disabled — Deterministic Research Tools Active (Clearly Labeled)',
    },
    quota: {
      enabled: aiEnt.enabled,
      limit: aiEnt.numericLimit,
      usedThisMonth,
    },
    capabilities: AI_CAPABILITY_CATALOG,
    suggestedQuestions: SUGGESTED_RESEARCH_QUESTIONS,
    conversations: convState.conversations,
  });
}

export async function POST(request: NextRequest) {
  if (!isAllowedCsrfOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'Cross-origin request rejected.' }, { status: 403 });
  }

  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = studioActionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid AI Studio request payload.' }, { status: 400 });
  }

  const action = parsed.data;
  const now = new Date().toISOString();

  if (action.type === 'create_conversation') {
    const conv: ResearchConversationRecord = {
      id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: action.title,
      archived: false,
      context: {
        savedProfileUsername: action.savedProfileUsername ?? null,
        researchProjectId: action.researchProjectId ?? null,
        comparisonProjectId: action.comparisonProjectId ?? null,
        reportId: action.reportId ?? null,
        allowPrivateNotesInContext: action.allowPrivateNotesInContext,
      },
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    const nextState = await updateUserAiConversations(user.id, (s) => ({
      ...s,
      conversations: [conv, ...s.conversations],
    }));
    return NextResponse.json(
      { ok: true, conversation: conv, conversations: nextState.conversations },
      { status: 201 }
    );
  }

  if (action.type === 'rename_conversation') {
    const nextState = await updateUserAiConversations(user.id, (s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === action.conversationId ? { ...c, title: action.title, updatedAt: now } : c
      ),
    }));
    return NextResponse.json({ ok: true, conversations: nextState.conversations });
  }

  if (action.type === 'archive_conversation') {
    const nextState = await updateUserAiConversations(user.id, (s) => ({
      ...s,
      conversations: s.conversations.map((c) =>
        c.id === action.conversationId ? { ...c, archived: action.archived, updatedAt: now } : c
      ),
    }));
    return NextResponse.json({ ok: true, conversations: nextState.conversations });
  }

  if (action.type === 'delete_conversation') {
    const nextState = await updateUserAiConversations(user.id, (s) => ({
      ...s,
      conversations: s.conversations.filter((c) => c.id !== action.conversationId),
    }));
    return NextResponse.json({ ok: true, conversations: nextState.conversations });
  }

  // Quota-checked AI / Deterministic Capability Execution (`send_message` or `run_capability`)
  const [plans, overrides, ws] = await Promise.all([
    loadConfiguredPlans(),
    loadUserEntitlementOverrides(user.id),
    loadUserWorkspaceState(user.id),
  ]);
  const entitlements = resolveEntitlements({
    planCode: user.planCode,
    billingInterval: user.billingInterval,
    userId: user.id,
    plans,
    overrides,
  });
  const aiFeature = entitlements.rules.ai_profile_reports;
  if (!aiFeature.enabled) {
    return NextResponse.json(
      {
        ok: false,
        error: 'AI Intelligence Studio requires Starter, Premium, Pro, or Agency membership.',
      },
      { status: 403 }
    );
  }

  const reservation = await reserveAtomicAiMonthlyQuota({
    userId: user.id,
    monthlyLimit: aiFeature.numericLimit,
    reportType: action.capabilityId,
    executionMode: isProviderEffectivelyEnabled('gemini_ai') ? 'live_gemini' : 'template_fallback',
    modelName: isProviderEffectivelyEnabled('gemini_ai') ? 'gemini-2.5-flash' : 'deterministic_template',
  });
  if (!reservation.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: reservation.code,
        error: `Monthly AI Intelligence quota reached (${reservation.usedThisMonth}/${reservation.limit}).`,
      },
      { status: 403 }
    );
  }

  if (action.type === 'run_capability') {
    const target = action.targetUsername
      ? ws.savedProfiles.find(
          (p) => p.username.toLowerCase() === action.targetUsername!.replace(/^@+/, '').toLowerCase()
        )
      : ws.savedProfiles[0];
    const result = await executeAiStudioCapability({
      userId: user.id,
      capabilityId: action.capabilityId,
      prompt: action.prompt,
      profile: target?.profile ?? null,
      dataClass: target?.dataClass ?? 'unavailable',
      contextSummary: action.contextSummary,
      idempotencyKey: action.idempotencyKey,
    });
    return NextResponse.json({ ok: true, result, quotaUsed: reservation.usedThisMonth });
  }

  // send_message inside persisted conversation
  const convState = await loadUserAiConversations(user.id);
  const conv = convState.conversations.find((c) => c.id === action.conversationId);
  if (!conv) {
    return NextResponse.json({ ok: false, error: 'Research conversation not found.' }, { status: 404 });
  }

  const boundProfile = conv.context.savedProfileUsername
    ? ws.savedProfiles.find(
        (p) => p.username.toLowerCase() === conv.context.savedProfileUsername!.toLowerCase()
      )
    : ws.savedProfiles[0];

  // Privacy guard: NEVER include private notes unless user explicitly authorized it
  const safeContextParts: string[] = [];
  if (boundProfile) {
    safeContextParts.push(`Profile @${boundProfile.username} (${boundProfile.dataClass})`);
    if (conv.context.allowPrivateNotesInContext && boundProfile.privateNote) {
      safeContextParts.push(`Owner-authorized note: ${boundProfile.privateNote.slice(0, 400)}`);
    }
  }

  const result = await executeAiStudioCapability({
    userId: user.id,
    capabilityId: action.capabilityId,
    prompt: action.prompt,
    profile: boundProfile?.profile ?? null,
    dataClass: boundProfile?.dataClass ?? 'unavailable',
    contextSummary: safeContextParts.join(' | '),
    idempotencyKey: action.idempotencyKey,
  });

  const userMsg = {
    id: `msg-u-${Date.now()}`,
    role: 'user' as const,
    content: action.prompt,
    contentOrigin: 'user_authored' as const,
    capabilityId: action.capabilityId,
    createdAt: now,
  };
  const assistantMsg = {
    id: `msg-a-${Date.now() + 1}`,
    role: 'assistant' as const,
    content: result.summary,
    contentOrigin: result.contentOrigin,
    capabilityId: result.capabilityId,
    findings: result.findings,
    recommendations: result.recommendations,
    sourceReferences: result.sourceReferences,
    safetyFlags: result.safetyFlags,
    createdAt: result.generatedAt,
  };

  const nextState = await updateUserAiConversations(user.id, (s) => ({
    ...s,
    conversations: s.conversations.map((c) =>
      c.id === conv.id
        ? { ...c, messages: [...c.messages, userMsg, assistantMsg].slice(-60), updatedAt: result.generatedAt }
        : c
    ),
  }));

  return NextResponse.json({
    ok: true,
    result,
    conversations: nextState.conversations,
    quotaUsed: reservation.usedThisMonth,
  });
}
