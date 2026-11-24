'use client';

import { CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<'general' | 'enterprise' | 'privacy' | 'provider_partnership' | 'support'>('general');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, topic, message, website }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; message?: string };
      if (!json.ok) {
        setError(json.error ?? 'Could not submit your inquiry.');
        return;
      }
      setSuccess(json.message ?? 'Message received.');
      setName('');
      setEmail('');
      setMessage('');
    } catch {
      setError('Network error while sending your message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot hidden from assistive tech & sighted users */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Your name
          </span>
          <input
            type="text"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Email address
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Inquiry topic
        </span>
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value as typeof topic)}
          className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
        >
          <option value="general">General Product Question</option>
          <option value="support">Customer Support</option>
          <option value="enterprise">Agency &amp; Team Plans</option>
          <option value="privacy">Privacy &amp; Data Rights Request</option>
          <option value="provider_partnership">Licensed Data Partnership</option>
        </select>
      </label>

      <label className="block">
        <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          Message
        </span>
        <textarea
          required
          minLength={10}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm dark:border-slate-700 dark:bg-[#080D19] dark:text-white"
        />
      </label>

      {error ? (
        <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}

      {success ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{success}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="h-11 rounded-xl bg-[#7957FF] px-6 text-sm font-semibold text-white transition hover:bg-[#6441f5] disabled:opacity-60"
      >
        {submitting ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}
