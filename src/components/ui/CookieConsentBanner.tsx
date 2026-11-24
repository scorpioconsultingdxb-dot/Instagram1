'use client';

import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

const CONSENT_KEY = 'viewora_cookie_consent_v1';

export interface ConsentState {
  essential: true;
  analytics: boolean;
  decidedAt: string;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const existing = window.localStorage.getItem(CONSENT_KEY);
      if (!existing) setVisible(true);
    } catch {
      // Ignore storage access failures in restricted browsing contexts.
    }
  }, []);

  const saveConsent = (analytics: boolean) => {
    const payload: ConsentState = {
      essential: true,
      analytics,
      decidedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
      document.cookie = `viewora_analytics_consent=${analytics ? '1' : '0'}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Cookie and privacy consent"
      className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-[#131C2E]/95"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-[#7957FF]"
            aria-hidden="true"
          />
          <p>
            Viewora uses essential cookies for security and locale preferences, plus optional
            privacy-safe analytics (never sending searched usernames or private notes).
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => saveConsent(false)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={() => saveConsent(true)}
            className="rounded-lg bg-[#7957FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6441f5]"
          >
            Accept Analytics
          </button>
        </div>
      </div>
    </aside>
  );
}
