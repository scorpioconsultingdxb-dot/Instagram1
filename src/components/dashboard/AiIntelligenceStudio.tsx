'use client';

import {
  AlertTriangle,
  Archive,
  Check,
  Copy,
  Download,
  FileDown,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/types';
import type { AiReportOutput, AiReportType } from '@/lib/ai/gemini';
import type { AiCapabilityId, AiCapabilityResult, AiCapabilitySpec } from '@/lib/ai/studio';
import {
  exportConversationAsMarkdown,
  SUGGESTED_RESEARCH_QUESTIONS,
  type ResearchConversationRecord,
} from '@/lib/ai/conversations-shared';
import type { SavedAiReportRecord } from '@/lib/dashboard/store';
import type { DashboardSavedProfile } from './CustomerDashboard';
import { ProvenanceBadge } from '@/components/ui/ProvenanceBadge';
import { EmptyState, ErrorState, UpgradePreviewCard } from '@/components/ui/Primitives';

const REPORT_TYPES: Array<{ id: AiReportType; label: string; layoutTag: string; desc: string }> = [
  { id: 'profile_performance', label: 'Profile Performance Report', layoutTag: 'Benchmark', desc: 'Overall health, cadence & interaction depth' },
  { id: 'growth_opportunity', label: 'Growth Opportunity Report', layoutTag: 'Growth', desc: 'Audience velocity & format expansion levers' },
  { id: 'competitor_comparison', label: 'Competitor Comparison Report', layoutTag: 'Competitor', desc: 'Positioning gaps vs. niche peers' },
  { id: 'influencer_evaluation', label: 'Influencer Evaluation Report', layoutTag: 'Research', desc: 'Tier quality, consistency & estimated reach' },
  { id: 'content_strategy', label: 'Content Strategy Report', layoutTag: 'Engagement', desc: 'Reels vs. Carousel publishing roadmap' },
  { id: 'social_media_audit', label: 'Social Media Audit', layoutTag: 'Audit', desc: 'Bio, CTA, cadence & profile readiness' },
  { id: 'weekly_executive_summary', label: 'Weekly Executive Summary', layoutTag: 'Executive', desc: 'Concise leadership brief for teams/clients' },
];

export function AiIntelligenceStudio({
  locale,
  dict,
  profiles,
  canGenerateAi,
  canPdf,
  canCsv,
  onReportSaved,
  onEnableDemoPreview,
}: {
  locale: Locale;
  dict: Dictionary;
  profiles: DashboardSavedProfile[];
  canGenerateAi: boolean;
  canPdf: boolean;
  canCsv: boolean;
  onReportSaved?: (entry: SavedAiReportRecord) => void;
  onEnableDemoPreview?: () => void;
}) {
  const [studioTab, setStudioTab] = useState<'assistant' | 'capabilities' | 'reports'>('assistant');

  // Stage 46 Conversational Research Assistant + 12 Capabilities state
  const [providerStatus, setProviderStatus] = useState<{
    geminiEnabled: boolean;
    modeLabel: string;
  }>({
    geminiEnabled: false,
    modeLabel: 'Gemini AI Disabled — Deterministic Research Tools Active (Clearly Labeled)',
  });
  const [quota, setQuota] = useState<{ enabled: boolean; limit: number | null; usedThisMonth: number }>({
    enabled: canGenerateAi,
    limit: null,
    usedThisMonth: 0,
  });
  const [capabilities, setCapabilities] = useState<AiCapabilitySpec[]>([]);
  const [conversations, setConversations] = useState<ResearchConversationRecord[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [convSearch, setConvSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [newConvTitle, setNewConvTitle] = useState('');
  const [contextProfile, setContextProfile] = useState<string>(profiles[0]?.profile.username ?? '');
  const [allowPrivateNotes, setAllowPrivateNotes] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [selectedCapability, setSelectedCapability] = useState<AiCapabilityId>('profile_intelligence_summary');
  const [capabilityOutput, setCapabilityOutput] = useState<AiCapabilityResult | null>(null);
  const [editableSummary, setEditableSummary] = useState('');
  const [studioBusy, setStudioBusy] = useState(false);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);

  // Classic 7-layout structured report studio state
  const [reportType, setReportType] = useState<AiReportType>('profile_performance');
  const [selectedUsername, setSelectedUsername] = useState<string>(profiles[0]?.profile.username ?? '');
  const [dateRange, setDateRange] = useState<'30d' | '90d' | '180d'>('90d');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AiReportOutput | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch('/api/ai/studio')
      .then((r) => r.json())
      .then((json: {
        ok?: boolean;
        providerStatus?: { geminiEnabled: boolean; modeLabel: string };
        quota?: { enabled: boolean; limit: number | null; usedThisMonth: number };
        capabilities?: AiCapabilitySpec[];
        conversations?: ResearchConversationRecord[];
      }) => {
        if (!mounted || !json?.ok) return;
        if (json.providerStatus) setProviderStatus(json.providerStatus);
        if (json.quota) setQuota(json.quota);
        if (json.capabilities) setCapabilities(json.capabilities);
        if (json.conversations) {
          setConversations(json.conversations);
          setActiveConvId((prev) => prev ?? json.conversations?.[0]?.id ?? null);
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const filteredConversations = useMemo(() => {
    const q = convSearch.trim().toLowerCase();
    return conversations.filter((c) => {
      if (!showArchived && c.archived) return false;
      if (!q) return true;
      return c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q));
    });
  }, [conversations, convSearch, showArchived]);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  const createConversation = async () => {
    const title = newConvTitle.trim() || `Research Thread (${contextProfile ? `@${contextProfile}` : 'Workspace'})`;
    setStudioBusy(true);
    setStudioNotice(null);
    try {
      const res = await fetch('/api/ai/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create_conversation',
          title,
          savedProfileUsername: contextProfile || null,
          allowPrivateNotesInContext: allowPrivateNotes,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        conversation?: ResearchConversationRecord;
        conversations?: ResearchConversationRecord[];
        error?: string;
      };
      if (!res.ok || !json.ok || !json.conversations) {
        setError(json.error ?? 'Could not create conversation.');
        return;
      }
      setConversations(json.conversations);
      if (json.conversation) setActiveConvId(json.conversation.id);
      setNewConvTitle('');
      setStudioNotice(`Created persistent research thread "${title}".`);
    } finally {
      setStudioBusy(false);
    }
  };

  const sendMessage = async (overridePrompt?: string, overrideCap?: AiCapabilityId) => {
    const text = (overridePrompt ?? promptInput).trim();
    if (text.length < 3) return;
    let targetConvId = activeConvId;
    if (!targetConvId) {
      const createdRes = await fetch('/api/ai/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create_conversation',
          title: text.slice(0, 56),
          savedProfileUsername: contextProfile || null,
          allowPrivateNotesInContext: allowPrivateNotes,
        }),
      });
      const createdJson = (await createdRes.json()) as {
        ok?: boolean;
        conversation?: ResearchConversationRecord;
        conversations?: ResearchConversationRecord[];
      };
      if (createdJson.ok && createdJson.conversation && createdJson.conversations) {
        targetConvId = createdJson.conversation.id;
        setConversations(createdJson.conversations);
        setActiveConvId(targetConvId);
      } else {
        setError('Could not initialize research conversation.');
        return;
      }
    }

    setStudioBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'send_message',
          conversationId: targetConvId,
          capabilityId: overrideCap ?? selectedCapability,
          prompt: text,
          idempotencyKey: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        conversations?: ResearchConversationRecord[];
        quotaUsed?: number;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.conversations) {
        setError(json.error ?? 'Could not execute research query.');
        return;
      }
      setConversations(json.conversations);
      if (typeof json.quotaUsed === 'number') {
        setQuota((q) => ({ ...q, usedThisMonth: json.quotaUsed! }));
      }
      setPromptInput('');
    } finally {
      setStudioBusy(false);
    }
  };

  const runCapabilityTool = async (capId: AiCapabilityId) => {
    setStudioBusy(true);
    setError(null);
    setSelectedCapability(capId);
    try {
      const spec = capabilities.find((c) => c.id === capId);
      const res = await fetch('/api/ai/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'run_capability',
          capabilityId: capId,
          targetUsername: contextProfile || profiles[0]?.profile.username || undefined,
          prompt:
            promptInput.trim().length >= 3
              ? promptInput.trim()
              : `Run ${spec?.title ?? capId} using verified public and workspace data.`,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        result?: AiCapabilityResult;
        quotaUsed?: number;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.result) {
        setError(json.error ?? 'Could not run intelligence capability.');
        return;
      }
      setCapabilityOutput(json.result);
      setEditableSummary(json.result.summary);
      if (typeof json.quotaUsed === 'number') {
        setQuota((q) => ({ ...q, usedThisMonth: json.quotaUsed! }));
      }
    } finally {
      setStudioBusy(false);
    }
  };

  const sendReviewedOutputToReportStudio = async () => {
    if (!capabilityOutput) return;
    setStudioBusy(true);
    try {
      const res = await fetch('/api/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create',
          reportType: 'executive_summary',
          title: `${capabilityOutput.title} (${capabilityOutput.contentOrigin})`,
          description: `${editableSummary} — Human-reviewed draft. ${capabilityOutput.methodologyNote}`,
          usernames: contextProfile ? [contextProfile] : [],
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Could not save draft to Report Studio.');
        return;
      }
      setStudioNotice('Saved human-reviewed draft to Report Studio 3.0.');
    } finally {
      setStudioBusy(false);
    }
  };

  const downloadConversation = (conv: ResearchConversationRecord) => {
    const md = exportConversationAsMarkdown(conv);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viewora-research-${conv.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMarkdownBrief = async (r: AiReportOutput) => {
    const md = [
      `# ${REPORT_TYPES.find((t) => t.id === r.reportType)?.label ?? r.reportType} — @${r.username}`,
      `- **Execution Mode:** ${r.executionMode} (${r.modelName})`,
      `- **Data Provenance:** ${r.dataClass} (${r.sourceLabel})`,
      `- **Generated:** ${r.generatedAt}`,
      '',
      '## Executive Summary',
      r.executiveSummary,
      '',
      '## Key Findings',
      ...r.keyFindings.map((f) => `- ${f}`),
      '',
      '## Actionable Recommendations',
      ...r.recommendations.map((rec) => `- ${rec}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(md);
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 2200);
    } catch {
      // clipboard unavailable
    }
  };

  if (!canGenerateAi) {
    return (
      <UpgradePreviewCard
        title="Unlock the AI Intelligence Studio"
        description="Access the Conversational Research Assistant, all 12 structured intelligence capabilities, and Report Studio 3.0 synthesis with strict provenance disclosures."
        requiredTier="Starter+ Plan (3–150 reports/mo)"
        ctaHref={`/${locale}/pricing`}
      />
    );
  }

  const resolvedUsername =
    profiles.some((p) => p.profile.username === selectedUsername)
      ? selectedUsername
      : profiles[0]?.profile.username ?? '';

  const handleGenerate = async () => {
    if (!resolvedUsername) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resolvedUsername, reportType, dateRange }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        report?: AiReportOutput;
        savedReport?: SavedAiReportRecord;
      };
      if (!res.ok || !json.ok || !json.report) {
        setError(json.error ?? 'Could not generate intelligence report.');
        return;
      }
      setReport(json.report);
      if (json.savedReport) onReportSaved?.(json.savedReport);
    } catch {
      setError('Network error while requesting the intelligence report.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Provider Availability & Quota Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div>
            <p className="font-bold">{providerStatus.modeLabel}</p>
            <p className="mt-0.5 text-[11px] opacity-90">
              Deterministic templates are always explicitly labeled <strong>Template-Generated (Not AI-Generated)</strong>. Private research notes stay excluded unless explicitly opted in.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold">
          <span className="rounded-lg bg-white/80 px-2.5 py-1 text-[#0F172A] dark:bg-[#0F172A] dark:text-white">
            Monthly Usage: {quota.usedThisMonth} / {quota.limit ?? '∞'}
          </span>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['assistant', 'Research Assistant', MessageSquare],
            ['capabilities', `12 Intelligence Tools (${capabilities.length || 12})`, Sparkles],
            ['reports', 'Structured Report Studio', FileText],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStudioTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              studioTab === id
                ? 'bg-[#7957FF] text-white'
                : 'border border-slate-200 bg-white text-[#64748B] hover:border-[#7957FF] dark:border-[#263047] dark:bg-[#0F172A] dark:text-[#94A3B8]'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {studioNotice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {studioNotice}
        </div>
      ) : null}

      {error ? <ErrorState title="Intelligence Studio notice" description={error} /> : null}

      {/* TAB 1: CONVERSATIONAL RESEARCH ASSISTANT */}
      {studioTab === 'assistant' ? (
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Conversation Sidebar */}
          <aside className="viewora-card space-y-3 rounded-2xl p-4 lg:col-span-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Conversations ({filteredConversations.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowArchived((s) => !s)}
                className="text-[11px] font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
              >
                {showArchived ? 'Hide Archived' : 'Show Archived'}
              </button>
            </div>

            <label className="relative block">
              <span className="sr-only">Search conversations</span>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
              <input
                type="search"
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                placeholder="Search threads…"
                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pr-2.5 pl-8 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
            </label>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={newConvTitle}
                onChange={(e) => setNewConvTitle(e.target.value)}
                placeholder="New research thread title"
                aria-label="New conversation title"
                className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
              <button
                type="button"
                disabled={studioBusy}
                onClick={() => void createConversation()}
                aria-label="Create research conversation"
                className="viewora-btn-primary inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            </div>

            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {filteredConversations.length === 0 ? (
                <p className="py-4 text-center text-xs text-[#64748B]">
                  No saved research conversations yet. Start a thread below.
                </p>
              ) : (
                filteredConversations.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between gap-1 rounded-xl border p-2.5 text-xs transition ${
                      activeConvId === c.id
                        ? 'border-[#7957FF] bg-violet-50/70 dark:bg-[#192337]'
                        : 'border-slate-200 bg-slate-50/60 dark:border-[#263047] dark:bg-[#0F172A]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveConvId(c.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-semibold text-[#0F172A] dark:text-white">
                        {c.title}
                      </p>
                      <p className="text-[10px] text-[#64748B]">
                        {c.messages.length} msg · {c.archived ? 'Archived' : 'Active'}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Archive ${c.title}`}
                      onClick={async () => {
                        const res = await fetch('/api/ai/studio', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'archive_conversation',
                            conversationId: c.id,
                            archived: !c.archived,
                          }),
                        });
                        const j = (await res.json()) as { conversations?: ResearchConversationRecord[] };
                        if (j.conversations) setConversations(j.conversations);
                      }}
                      className="p-1 text-slate-400 hover:text-[#6941EF]"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${c.title}`}
                      onClick={async () => {
                        const res = await fetch('/api/ai/studio', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ type: 'delete_conversation', conversationId: c.id }),
                        });
                        const j = (await res.json()) as { conversations?: ResearchConversationRecord[] };
                        if (j.conversations) {
                          setConversations(j.conversations);
                          if (activeConvId === c.id) setActiveConvId(j.conversations[0]?.id ?? null);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Main Research Workspace */}
          <section className="viewora-card flex flex-col justify-between space-y-4 rounded-2xl p-5 lg:col-span-8">
            <div className="space-y-3">
              {/* Context Selection Panel */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-[#263047]">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="inline-flex items-center gap-1.5 font-semibold text-[#0F172A] dark:text-white">
                    Context:
                    <select
                      value={contextProfile}
                      onChange={(e) => setContextProfile(e.target.value)}
                      className="h-8 rounded-lg border border-slate-300 bg-white px-2 font-mono text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
                    >
                      <option value="">Workspace-level</option>
                      {profiles.map((p) => (
                        <option key={p.profile.username} value={p.profile.username}>
                          @{p.profile.username} ({p.dataClass})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-[#64748B]">
                    <input
                      type="checkbox"
                      checked={allowPrivateNotes}
                      onChange={(e) => setAllowPrivateNotes(e.target.checked)}
                    />
                    Include private note (explicit opt-in)
                  </label>
                </div>
                {activeConv ? (
                  <button
                    type="button"
                    onClick={() => downloadConversation(activeConv)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-slate-200"
                  >
                    <Download className="h-3 w-3" />
                    Export MD
                  </button>
                ) : null}
              </div>

              {/* Suggested Questions */}
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_RESEARCH_QUESTIONS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    disabled={studioBusy}
                    onClick={() => void sendMessage(q.prompt, q.capabilityId)}
                    className="rounded-full border border-violet-200 bg-violet-50/70 px-2.5 py-1 text-[11px] font-semibold text-[#6941EF] hover:bg-violet-100 disabled:opacity-50 dark:border-[#263047] dark:bg-violet-950/40 dark:text-[#A99AFF]"
                  >
                    + {q.label}
                  </button>
                ))}
              </div>

              {/* Messages Feed */}
              <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-[#263047] dark:bg-[#080D19]">
                {!activeConv || activeConv.messages.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[#64748B]">
                    Ask a research question or pick a suggested prompt above. Responses persist to PostgreSQL under your account&apos;s Row-Level Security scope.
                  </p>
                ) : (
                  activeConv.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl p-3 text-xs ${
                        m.role === 'user'
                          ? 'ml-8 bg-[#7957FF] text-white'
                          : 'mr-4 border border-slate-200 bg-white text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-slate-100'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] opacity-80">
                        <span className="font-mono uppercase">{m.contentOrigin.replace(/_/g, ' ')}</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="leading-relaxed">{m.content}</p>
                      {m.findings?.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] opacity-90">
                          {m.findings.map((f, idx) => (
                            <li key={idx}>{f}</li>
                          ))}
                        </ul>
                      ) : null}
                      {m.sourceReferences?.length ? (
                        <p className="mt-2 font-mono text-[10px] opacity-75">
                          Sources: {m.sourceReferences.join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Ask about profile health, engagement, bio optimization, or campaign strategy…"
                aria-label="Research assistant prompt"
                className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
              <button
                type="submit"
                disabled={studioBusy || promptInput.trim().length < 3}
                className="viewora-btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold disabled:opacity-50"
              >
                {studioBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Run
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {/* TAB 2: 12 AI INTELLIGENCE CAPABILITIES */}
      {studioTab === 'capabilities' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((cap) => (
              <div
                key={cap.id}
                className="viewora-card flex flex-col justify-between rounded-2xl p-4 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-violet-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]">
                      {cap.category}
                    </span>
                    <span className="font-mono text-[10px] text-[#64748B]">
                      Est. ${(cap.estimatedCostMicroUsd / 1_000_000).toFixed(4)}
                    </span>
                  </div>
                  <h3 className="mt-2 font-bold text-[#0F172A] dark:text-white">{cap.title}</h3>
                  <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    {cap.description}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={studioBusy}
                  onClick={() => void runCapabilityTool(cap.id)}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-[#0F172A] hover:border-[#7957FF] disabled:opacity-50 dark:border-[#263047] dark:bg-[#0F172A] dark:text-white"
                >
                  <Sparkles className="h-3 w-3 text-[#6941EF]" />
                  Run Capability
                </button>
              </div>
            ))}
          </div>

          {capabilityOutput ? (
            <div className="viewora-card space-y-3 rounded-2xl p-5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                    {capabilityOutput.title}
                  </h3>
                  <p className="font-mono text-[10px] text-[#64748B]">
                    Origin: {capabilityOutput.contentOrigin} · Model: {capabilityOutput.modelName} · Actual Cost: ${capabilityOutput.actualCostUsd.toFixed(4)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={studioBusy}
                  onClick={() => void sendReviewedOutputToReportStudio()}
                  className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Approve &amp; Send to Report Studio
                </button>
              </div>
              <label className="block">
                <span className="font-semibold text-[#0F172A] dark:text-white">
                  Editable Summary (Human Review Required Before Finalization)
                </span>
                <textarea
                  rows={3}
                  value={editableSummary}
                  onChange={(e) => setEditableSummary(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
                />
              </label>
              <p className="text-[11px] text-[#64748B]">{capabilityOutput.methodologyNote}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* TAB 3: CLASSIC 7-LAYOUT STRUCTURED REPORT STUDIO */}
      {studioTab === 'reports' ? (
        profiles.length === 0 ? (
          <EmptyState
            title="No profiles available for structured report generation"
            description="Save an eligible public profile in Saved Profiles or turn on explicit Demo Preview Mode to generate structured briefs."
            actionLabel={onEnableDemoPreview ? 'Enable Demo Preview Mode' : undefined}
            onAction={onEnableDemoPreview}
          />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {REPORT_TYPES.map((rt) => {
                const active = reportType === rt.id;
                return (
                  <button
                    key={rt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setReportType(rt.id)}
                    className={`rounded-2xl border p-3.5 text-left transition ${
                      active
                        ? 'border-[#7957FF] bg-violet-50/70 ring-1 ring-[#7957FF] dark:border-[#A99AFF] dark:bg-[#192337]'
                        : 'border-slate-200 bg-white hover:border-[#7957FF]/40 dark:border-[#263047] dark:bg-[#0F172A]'
                    }`}
                  >
                    <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#64748B] uppercase dark:bg-[#131C2E] dark:text-[#94A3B8]">
                      {rt.layoutTag}
                    </span>
                    <span className="mt-2 block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      {rt.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      {rt.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 md:grid-cols-3 dark:border-[#263047] dark:bg-[#0F172A]">
              <label className="block">
                <span className="block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">1. Report Type</span>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as AiReportType)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#F8FAFC]"
                >
                  {REPORT_TYPES.map((rt) => (
                    <option key={rt.id} value={rt.id}>{rt.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">2. Eligible Profile</span>
                <select
                  value={resolvedUsername}
                  onChange={(e) => setSelectedUsername(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#F8FAFC]"
                >
                  {profiles.map((p) => (
                    <option key={p.profile.username} value={p.profile.username}>
                      @{p.profile.username} ({p.dataClass})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">3. Lookback Window</span>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#131C2E] dark:text-[#F8FAFC]"
                >
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="180d">Last 180 days</option>
                </select>
              </label>
              <div className="flex justify-end md:col-span-3">
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => void handleGenerate()}
                  className="viewora-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold disabled:opacity-60"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {generating ? 'Processing structured report…' : 'Generate Intelligence Report'}
                </button>
              </div>
            </div>

            {report ? (
              <div className="viewora-card space-y-4 rounded-2xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-[#263047]">
                  <div>
                    <h3 className="font-display text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
                      {REPORT_TYPES.find((r) => r.id === report.reportType)?.label}
                    </h3>
                    <p className="mt-1 font-mono text-[11px] text-[#64748B]">
                      @{report.username} · {report.executionMode} · {report.modelName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ProvenanceBadge dataClass={report.dataClass} labels={dict.provenance} />
                    <button
                      type="button"
                      onClick={() => void copyMarkdownBrief(report)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold dark:border-[#263047]"
                    >
                      {copiedReport ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {copiedReport ? 'Copied' : 'Copy Brief'}
                    </button>
                    {canPdf ? (
                      <a
                        href={`/api/dashboard/export?format=pdf&username=${encodeURIComponent(report.username)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold dark:border-[#263047]"
                      >
                        <FileDown className="h-3 w-3" />
                        PDF
                      </a>
                    ) : null}
                    {canCsv ? (
                      <a
                        href={`/api/dashboard/export?format=csv&username=${encodeURIComponent(report.username)}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold dark:border-[#263047]"
                      >
                        <FileDown className="h-3 w-3" />
                        CSV
                      </a>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-[#0F172A] dark:text-slate-100">
                  {report.executiveSummary}
                </p>
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}
