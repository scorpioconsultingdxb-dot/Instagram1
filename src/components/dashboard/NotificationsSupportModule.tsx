'use client';

import { Bell, CheckCheck, LifeBuoy, Loader2, Send } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { EmailPreferences } from '@/lib/auth/session';
import type { UserWorkspaceState } from '@/lib/dashboard/store';
import type { BroadcastNotificationRecord, SupportTicketRecord } from '@/lib/admin/store';
import { StatusBanner } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/ui/Primitives';

export function NotificationsSupportModule({
  mode,
  workspace,
  broadcasts,
  initialEmailPrefs,
  onWorkspaceChange,
}: {
  mode: 'notifications' | 'support';
  workspace: UserWorkspaceState;
  broadcasts: BroadcastNotificationRecord[];
  initialEmailPrefs: EmailPreferences;
  onWorkspaceChange: (next: UserWorkspaceState) => void;
}) {
  const [emailPrefs, setEmailPrefs] = useState(initialEmailPrefs);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null
  );

  // Support ticket state
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(mode === 'support');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');

  useEffect(() => {
    if (mode !== 'support') return;
    let active = true;
    setTicketsLoading(true);
    fetch('/api/support', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { ok?: boolean; tickets?: SupportTicketRecord[] } | null) => {
        if (!active) return;
        if (json?.ok && json.tickets) setTickets(json.tickets);
      })
      .finally(() => {
        if (active) setTicketsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode]);

  const markRead = async (id: string) => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mark_notification_read', id, read: true }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        workspace?: UserWorkspaceState;
      } | null;
      if (!res.ok || !json?.ok || !json.workspace) {
        setBanner({ tone: 'error', message: json?.error ?? 'Could not update notification state.' });
        return;
      }
      onWorkspaceChange(json.workspace);
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mark_all_notifications_read' }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        workspace?: UserWorkspaceState;
      } | null;
      if (!res.ok || !json?.ok || !json.workspace) {
        setBanner({ tone: 'error', message: json?.error ?? 'Could not mark notifications read.' });
        return;
      }
      onWorkspaceChange(json.workspace);
      setBanner({ tone: 'success', message: 'All workspace notifications marked as read.' });
    } finally {
      setBusy(false);
    }
  };

  const saveEmailPreferences = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/auth/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailPreferences: emailPrefs }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setBanner({
          tone: 'error',
          message: json?.error ?? `Could not save email preferences (HTTP ${res.status}).`,
        });
        return;
      }
      setBanner({ tone: 'success', message: 'Email notification preferences persisted.' });
    } catch {
      setBanner({ tone: 'error', message: 'Network error while saving preferences.' });
    } finally {
      setBusy(false);
    }
  };

  const submitTicket = async (e: FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (subject.trim().length < 4 || message.trim().length < 10) {
      setBanner({
        tone: 'error',
        message: 'Enter a subject (4+ characters) and a clear message (10+ characters).',
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim(), priority }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        ticket?: SupportTicketRecord;
      } | null;
      if (!res.ok || !json?.ok || !json.ticket) {
        setBanner({ tone: 'error', message: json?.error ?? 'Unable to create support request.' });
        return;
      }
      setTickets((prev) => [json.ticket!, ...prev]);
      setSubject('');
      setMessage('');
      setPriority('normal');
      setBanner({
        tone: 'success',
        message: `Support ticket ${json.ticket.id} recorded and routed to the operations queue.`,
      });
    } catch {
      setBanner({ tone: 'error', message: 'Network error while submitting support request.' });
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'support') {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="viewora-card space-y-4 rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              Submit a Support Request
            </h2>
          </div>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Tickets are persisted to the Viewora operations queue and visible in Admin Support
            workflows.
          </p>

          {banner ? (
            <StatusBanner
              tone={banner.tone}
              message={banner.message}
              onDismiss={() => setBanner(null)}
            />
          ) : null}

          <form onSubmit={submitTicket} className="space-y-3.5">
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Subject *
              <input
                type="text"
                required
                minLength={4}
                maxLength={160}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Question about Meta Business Discovery setup"
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-normal dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
            </label>

            <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-normal dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Message *
              <textarea
                rows={4}
                required
                minLength={10}
                maxLength={2000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your question or issue with relevant details…"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-normal dark:border-[#263047] dark:bg-[#080D19] dark:text-white"
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Submit Support Ticket
            </button>
          </form>
        </div>

        <div className="viewora-card space-y-4 rounded-2xl p-6">
          <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            My Support Tickets ({tickets.length})
          </h2>
          {ticketsLoading ? (
            <p className="text-xs text-[#64748B]">Loading support history…</p>
          ) : tickets.length === 0 ? (
            <EmptyState
              title="No support requests submitted yet"
              description="Any request you submit appears here with live status updates from the Viewora support team."
            />
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-[#263047] dark:bg-[#0F172A]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[#0F172A] dark:text-white">{t.subject}</span>
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-[#6941EF] dark:bg-violet-950 dark:text-[#A99AFF]">
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[#64748B] dark:text-[#94A3B8]">{t.message}</p>
                  {t.adminNotes ? (
                    <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 text-[11px] text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                      <strong>Support Note:</strong> {t.adminNotes}
                    </p>
                  ) : null}
                  <p className="mt-2 font-mono text-[10px] text-[#64748B]">
                    {t.id} · Priority: {t.priority} · {new Date(t.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {banner ? (
        <StatusBanner
          tone={banner.tone}
          message={banner.message}
          onDismiss={() => setBanner(null)}
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="viewora-card space-y-4 rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#6941EF] dark:text-[#A99AFF]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Notification Center
              </h2>
            </div>
            {workspace.notifications.some((n) => !n.read) ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            ) : null}
          </div>

          {broadcasts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">
                Platform Announcements
              </p>
              {broadcasts.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-3.5 text-xs dark:border-cyan-900/60 dark:bg-cyan-950/30"
                >
                  <p className="font-bold text-[#0F172A] dark:text-white">{b.title}</p>
                  <p className="mt-1 text-[#64748B] dark:text-slate-300">{b.body}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-3">
            {workspace.notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl border p-3.5 text-xs ${
                  n.read
                    ? 'border-slate-200 bg-slate-50 dark:border-[#263047] dark:bg-[#0F172A]'
                    : 'border-[#7957FF]/40 bg-violet-50/50 dark:bg-violet-950/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-semibold text-[#0F172A] dark:text-white">
                  <span>{n.title}</span>
                  <span className="font-mono text-[10px] font-normal text-[#64748B]">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 text-[#64748B] dark:text-[#94A3B8]">{n.body}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase text-[#64748B]">
                    {n.read ? 'Read' : 'Unread'}
                  </span>
                  {!n.read ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void markRead(n.id)}
                      className="text-[11px] font-semibold text-[#6941EF] hover:underline dark:text-[#A99AFF]"
                    >
                      Mark as read
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="viewora-card rounded-2xl p-6">
          <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            Email Notification Controls
          </h2>
          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Changes are persisted to your account profile immediately.
          </p>
          <div className="mt-4 space-y-3 text-xs text-[#0F172A] dark:text-slate-300">
            {(
              [
                ['trackingAlerts', 'Saved profile tracking alerts'],
                ['weeklyDigest', 'Weekly analytics summary'],
                ['productUpdates', 'Product updates & new tools'],
                ['marketing', 'Promotional offers'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={emailPrefs[key]}
                  onChange={(e) => setEmailPrefs({ ...emailPrefs, [key]: e.target.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveEmailPreferences()}
            className="viewora-btn-primary mt-5 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
