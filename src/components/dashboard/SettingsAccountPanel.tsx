'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';
import { StatusBanner } from '@/components/layout/PageShell';

export function SettingsAccountPanel({
  locale,
  userEmail,
}: {
  locale: Locale;
  userEmail: string;
}) {
  const router = useRouter();
  const [confirmEmail, setConfirmEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null
  );

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (confirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()) {
      setBanner({
        tone: 'error',
        message: `Type your exact account email (${userEmail}) to confirm deletion.`,
      });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: confirmEmail.trim() }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        setBanner({
          tone: 'error',
          message: json?.error ?? `Account deletion failed (HTTP ${res.status}).`,
        });
        return;
      }

      router.push(`/${locale}`);
      router.refresh();
    } catch {
      setBanner({ tone: 'error', message: 'Network error while processing account deletion.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {banner ? (
        <StatusBanner
          tone={banner.tone}
          message={banner.message}
          onDismiss={() => setBanner(null)}
        />
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="viewora-card rounded-2xl p-6">
          <h2 className="font-display text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            Personal Data Export (GDPR / LGPD / UAE PDPL)
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
            Download a machine-readable JSON archive of your account identity, persisted Personal
            Digital HQ preferences, saved profiles, folders, private notes, and entitlements.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href="/api/auth/export-data"
              prefetch={false}
              className="viewora-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download My Data (JSON)
            </Link>
            <Link
              href={`/${locale}/dashboard/profile`}
              className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-[#0F172A] hover:border-[#7957FF] dark:border-[#263047] dark:text-slate-200"
            >
              Open Personal Digital HQ
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-900/50 dark:bg-[#131C2E]">
          <div className="flex items-center gap-2 text-rose-600 dark:text-[#F87171]">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            <h2 className="font-display text-base font-bold">Permanent Account Deletion</h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
            Permanently revoke your session and request deletion of{' '}
            <code className="font-mono font-semibold text-[#0F172A] dark:text-white">
              {userEmail}
            </code>
            . This action is recorded in audit logs and cannot be undone.
          </p>
          <form onSubmit={handleDelete} className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Type your email address to confirm
              <input
                type="email"
                required
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={userEmail}
                className="mt-1.5 h-10 w-full rounded-xl border border-rose-200 bg-white px-3 text-xs font-normal dark:border-rose-900/60 dark:bg-[#080D19] dark:text-white"
              />
            </label>
            <button
              type="submit"
              disabled={busy || confirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Permanently Delete Account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
