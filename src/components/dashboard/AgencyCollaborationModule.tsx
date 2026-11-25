'use client';

import {
  Activity,
  Building2,
  Loader2,
  MessageSquare,
  Plus,
  Share2,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/config';
import type { AgencyOrgState, WorkspaceMemberRole } from '@/lib/agency/service';
import { UpgradePreviewCard } from '@/components/ui/Primitives';
import { StatusBanner } from '@/components/layout/PageShell';

export function AgencyCollaborationModule({
  locale,
  canAgency,
  seatLimit,
  workspaceLimit,
}: {
  locale: Locale;
  canAgency: boolean;
  seatLimit: number | null;
  workspaceLimit: number | null;
}) {
  const [agency, setAgency] = useState<AgencyOrgState | null>(null);
  const [selectedWsId, setSelectedWsId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  // Client workspace form
  const [clientName, setClientName] = useState('');
  const [industry, setIndustry] = useState('');
  const [reportHeader, setReportHeader] = useState('');

  // Invite member form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');

  // Shared project & comment forms
  const [shareProjectTitle, setShareProjectTitle] = useState('');
  const [commentBody, setCommentBody] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/agency')
      .then((r) => r.json())
      .then((json: { ok?: boolean; agency?: AgencyOrgState }) => {
        if (active && json?.ok && json.agency) {
          setAgency(json.agency);
          setSelectedWsId(json.agency.clientWorkspaces[0]?.id ?? '');
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!canAgency && (seatLimit ?? 1) <= 1) {
    return (
      <UpgradePreviewCard
        title="Agency Multi-Client & Team Collaboration Center"
        description="Organize isolated client workspaces, enforce role-based team seats (Owner, Admin, Editor, Viewer), share research projects, and post internal team commentary without exposing personal private notes."
        requiredTier="Pro (3 seats) or Agency (15 seats · 25 client workspaces)"
        ctaHref={`/${locale}/pricing`}
      />
    );
  }

  const runAction = async (payload: Record<string, unknown>, successMsg: string) => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/agency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        agency?: AgencyOrgState;
        workspaceId?: string;
        deliveryNotice?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        setBanner({ tone: 'error', message: json?.error ?? 'Agency action failed.' });
        return false;
      }
      if (json.agency) setAgency(json.agency);
      if (json.workspaceId) setSelectedWsId(json.workspaceId);
      setBanner({
        tone: 'success',
        message: json.deliveryNotice ? `${successMsg} ${json.deliveryNotice}` : successMsg,
      });
      return true;
    } catch {
      setBanner({ tone: 'error', message: 'Network error communicating with agency service.' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading || !agency) {
    return (
      <div className="viewora-card flex items-center justify-center gap-2 rounded-2xl p-10 text-xs text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin text-[#7957FF]" aria-hidden="true" />
        Loading Agency Collaboration Center…
      </div>
    );
  }

  const activeWs =
    agency.clientWorkspaces.find((w) => w.id === selectedWsId) ?? agency.clientWorkspaces[0]!;
  const wsMembers = agency.members.filter((m) => m.workspaceId === activeWs.id);
  const wsComments = agency.comments.filter((c) => c.workspaceId === activeWs.id);
  const wsActivity = agency.activity.filter((a) => a.workspaceId === activeWs.id);
  const activeSeatCount = agency.members.filter((m) => m.status !== 'revoked').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
            Agency &amp; Team Collaboration Center
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Client-isolated workspaces ({agency.clientWorkspaces.length}/{workspaceLimit ?? '∞'}) · Active seats ({activeSeatCount}/{seatLimit ?? '∞'}). Private personal notes are never shared with team members.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Cross-Client Isolation Enforced
        </span>
      </div>

      {banner ? <StatusBanner tone={banner.tone} message={banner.message} /> : null}

      {/* Client Workspace Switcher & Creator */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="viewora-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
            <Building2 className="h-4 w-4 text-[#7957FF]" aria-hidden="true" />
            Client Workspaces
          </h3>
          <div className="mt-3 space-y-2">
            {agency.clientWorkspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => setSelectedWsId(ws.id)}
                className={`w-full rounded-xl border p-3 text-left text-xs transition ${
                  activeWs.id === ws.id
                    ? 'border-[#7957FF] bg-violet-50/70 dark:border-[#A99AFF] dark:bg-[#192337]'
                    : 'border-slate-200 bg-slate-50/60 dark:border-[#263047] dark:bg-[#0F172A]'
                }`}
              >
                <p className="font-bold text-[#0F172A] dark:text-white">{ws.clientName}</p>
                <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  {ws.industry} · {ws.sharedProjectTitles.length} shared project(s)
                </p>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 dark:border-[#263047]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              Add Client Workspace
            </p>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client brand name"
              className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Industry (e.g. Hospitality, D2C)"
              className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <input
              type="text"
              value={reportHeader}
              onChange={(e) => setReportHeader(e.target.value)}
              placeholder="Branded report header note"
              className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <button
              type="button"
              disabled={busy || clientName.trim().length < 2}
              onClick={() => {
                void runAction(
                  {
                    type: 'create_client_workspace',
                    clientName: clientName.trim(),
                    industry: industry.trim() || 'Consumer Brand',
                    reportHeader: reportHeader.trim() || 'Client Intelligence Brief',
                  },
                  `Created client workspace "${clientName.trim()}".`
                ).then((ok) => {
                  if (ok) {
                    setClientName('');
                    setIndustry('');
                    setReportHeader('');
                  }
                });
              }}
              className="viewora-btn-primary inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Create Client Workspace
            </button>
          </div>
        </section>

        {/* Team Members & Invitations */}
        <section className="viewora-card rounded-2xl p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
              <Users className="h-4 w-4 text-[#22D3EE]" aria-hidden="true" />
              Team Roster — {activeWs.clientName}
            </h3>
            <span className="text-[11px] font-semibold text-[#64748B]">
              Header: {activeWs.reportHeader}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@agency.com"
              aria-label="Teammate email"
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs sm:col-span-2 dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Name"
              aria-label="Teammate display name"
              className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'editor' | 'viewer')}
              aria-label="Teammate role"
              className="h-9 rounded-xl border border-slate-300 bg-white px-2.5 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={busy || !inviteEmail.includes('@') || inviteName.trim().length < 2}
              onClick={() => {
                void runAction(
                  {
                    type: 'invite_member',
                    workspaceId: activeWs.id,
                    email: inviteEmail.trim(),
                    displayName: inviteName.trim(),
                    role: inviteRole,
                  },
                  `Invited ${inviteEmail.trim()} as ${inviteRole}.`
                ).then((ok) => {
                  if (ok) {
                    setInviteEmail('');
                    setInviteName('');
                  }
                });
              }}
              className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Invite Teammate
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {wsMembers.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
              >
                <div>
                  <p className="font-bold text-[#0F172A] dark:text-white">
                    {m.displayName}{' '}
                    <span className="font-normal text-[#64748B]">({m.email})</span>
                  </p>
                  <p className="text-[11px] uppercase text-[#64748B]">
                    Role: {m.role} · Status: {m.status}
                  </p>
                </div>
                {m.role !== 'owner' && m.status !== 'revoked' ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={m.role}
                      aria-label={`Change role for ${m.email}`}
                      onChange={(e) =>
                        void runAction(
                          {
                            type: 'update_member_role',
                            memberId: m.id,
                            role: e.target.value as WorkspaceMemberRole,
                          },
                          `Updated role for ${m.email}.`
                        )
                      }
                      className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          { type: 'revoke_member', memberId: m.id },
                          `Revoked access for ${m.email}.`
                        )
                      }
                      className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:border-rose-900/60 dark:text-rose-300"
                    >
                      Revoke
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Shared Projects, Internal Team Comments, and Activity Log */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="viewora-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
            <Share2 className="h-4 w-4 text-[#7957FF]" aria-hidden="true" />
            Shared Projects &amp; Team Commentary
          </h3>
          <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
            Team comments are scoped strictly to <strong>{activeWs.clientName}</strong>. Personal private research notes remain strictly isolated.
          </p>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={shareProjectTitle}
              onChange={(e) => setShareProjectTitle(e.target.value)}
              placeholder="Project title to share with client workspace"
              className="h-9 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <button
              type="button"
              disabled={busy || shareProjectTitle.trim().length < 2}
              onClick={() => {
                void runAction(
                  {
                    type: 'share_project',
                    workspaceId: activeWs.id,
                    projectTitle: shareProjectTitle.trim(),
                  },
                  `Shared "${shareProjectTitle.trim()}" with ${activeWs.clientName}.`
                ).then((ok) => {
                  if (ok) setShareProjectTitle('');
                });
              }}
              className="rounded-xl bg-[#7957FF] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Share
            </button>
          </div>

          {activeWs.sharedProjectTitles.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {activeWs.sharedProjectTitles.map((p) => (
                <span
                  key={p}
                  className="rounded-lg bg-violet-100/70 px-2.5 py-1 text-[11px] font-semibold text-[#6941EF] dark:bg-violet-950/60 dark:text-[#A99AFF]"
                >
                  {p}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Post an internal team comment…"
              aria-label="Team comment"
              className="h-9 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-xs dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
            />
            <button
              type="button"
              disabled={busy || commentBody.trim().length < 2}
              onClick={() => {
                void runAction(
                  {
                    type: 'add_comment',
                    workspaceId: activeWs.id,
                    projectTitle: activeWs.sharedProjectTitles[0] ?? activeWs.clientName,
                    body: commentBody.trim(),
                  },
                  'Posted internal team comment.'
                ).then((ok) => {
                  if (ok) setCommentBody('');
                });
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] dark:border-[#263047] dark:bg-[#131C2E] dark:text-white"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Post
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {wsComments.slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
              >
                <p className="text-[#0F172A] dark:text-slate-100">{c.body}</p>
                <p className="mt-1 text-[10px] text-[#64748B]">
                  {c.authorEmail} · {c.projectTitle} · {new Date(c.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="viewora-card rounded-2xl p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-[#0F172A] dark:text-white">
            <Activity className="h-4 w-4 text-[#22D3EE]" aria-hidden="true" />
            Workspace Activity History
          </h3>
          <ul className="mt-3 space-y-2 text-xs">
            {wsActivity.slice(0, 8).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-[#263047] dark:bg-[#0F172A]"
              >
                <span className="text-[#0F172A] dark:text-slate-200">{a.summary}</span>
                <span className="shrink-0 font-mono text-[10px] text-[#64748B]">
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
