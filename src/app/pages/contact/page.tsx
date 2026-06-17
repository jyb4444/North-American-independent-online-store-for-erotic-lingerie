'use client';

import { useState } from 'react';

const SUBJECTS = [
  'Size Guidance',
  'Order Issue',
  'Return Request',
  'Privacy Concern',
  'Product Question',
  'Other',
] as const;

type FormState = 'idle' | 'sending' | 'success' | 'error';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to send message');
      }
      setState('success');
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Help</p>
      <h1 className="font-serif text-4xl font-light text-ivory">Contact Us</h1>
      <div className="mx-auto mt-4 mb-4 h-px w-12 bg-gold-400/40" />
      <p className="mb-10 text-sm leading-relaxed text-ivory-muted">
        We reply within 24 hours. For sizing questions, our{' '}
        <a href="/pages/size-guide" className="text-gold-400 hover:underline">Size Guide</a>{' '}
        and{' '}
        <a href="/pages/faq" className="text-gold-400 hover:underline">FAQ</a>{' '}
        may have an immediate answer.
      </p>

      {state === 'success' ? (
        <div className="border border-gold-600/30 bg-wine-900 p-8 text-center">
          <p className="font-serif text-2xl font-light text-ivory">Thank you.</p>
          <p className="mt-3 text-sm text-ivory-muted">We received your message and will reply to <strong className="text-ivory">{email}</strong> within 24 hours.</p>
          <button
            onClick={() => { setState('idle'); setName(''); setEmail(''); setMessage(''); }}
            className="mt-6 border border-wine-700 px-5 py-2.5 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400/50 hover:text-gold-400"
          >
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 border border-gold-600/20 bg-wine-900 p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
                className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value as typeof subject)}
              className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory focus:border-gold-400 focus:outline-none transition"
            >
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              placeholder="How can we help?"
              className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition resize-none"
            />
          </div>

          {state === 'error' && (
            <p className="border border-crimson-400/30 bg-crimson-700/10 px-3 py-2 text-xs text-crimson-400">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={state === 'sending'}
            className="w-full border border-gold-400 py-3.5 text-xs font-medium uppercase tracking-[0.2em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:cursor-wait disabled:opacity-50"
          >
            {state === 'sending' ? 'Sending...' : 'Send Message'}
          </button>

          <p className="text-center text-xs text-ivory-dim">
            Your message is private. We will reply only to the email address you provide.
          </p>
        </form>
      )}
    </div>
  );
}
