'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

const SUBJECTS = [
  'Size Guidance',
  'Order Issue',
  'Return Request',
  'Privacy Concern',
  'Product Question',
  'Other',
] as const;

type FormState = 'idle' | 'sending' | 'success' | 'error';
type ContactSubject = (typeof SUBJECTS)[number];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<ContactSubject>(SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [subjectOpen, setSubjectOpen] = useState(false);
  const subjectMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (subjectMenuRef.current && !subjectMenuRef.current.contains(event.target as Node)) {
        setSubjectOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function handleSubjectKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') {
      setSubjectOpen(false);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSubjectOpen((open) => !open);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const currentIndex = SUBJECTS.indexOf(subject);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + direction + SUBJECTS.length) % SUBJECTS.length;
      setSubject(SUBJECTS[nextIndex]);
      setSubjectOpen(true);
    }
  }

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
      <p className="mb-10 text-base leading-7 text-ivory-muted">
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
              <label htmlFor="contact-name" className="mb-2 block text-sm font-medium uppercase tracking-[0.1em] text-ivory-muted">Name</label>
              <input id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
                className="w-full border border-wine-700 bg-wine-800 px-4 py-3 text-base text-ivory placeholder:text-ivory-dim focus:border-gold-400 focus:outline-none transition"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="mb-2 block text-sm font-medium uppercase tracking-[0.1em] text-ivory-muted">Email</label>
              <input id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full border border-wine-700 bg-wine-800 px-4 py-3 text-base text-ivory placeholder:text-ivory-dim focus:border-gold-400 focus:outline-none transition"
              />
            </div>
          </div>

          <div ref={subjectMenuRef} className="relative">
            <label id="contact-subject-label" htmlFor="contact-subject" className="mb-2 block text-sm font-medium uppercase tracking-[0.1em] text-ivory-muted">Subject</label>
            <button
              id="contact-subject"
              type="button"
              aria-labelledby="contact-subject-label contact-subject-value"
              aria-haspopup="listbox"
              aria-expanded={subjectOpen}
              aria-controls="contact-subject-options"
              onClick={() => setSubjectOpen((open) => !open)}
              onKeyDown={handleSubjectKeyDown}
              className={`flex w-full items-center justify-between gap-4 border bg-wine-800 px-4 py-3 text-left text-base text-ivory transition focus:outline-none ${
                subjectOpen ? 'border-gold-400' : 'border-wine-700 hover:border-gold-600'
              }`}
            >
              <span id="contact-subject-value">{subject}</span>
              <ChevronDown
                size={19}
                aria-hidden="true"
                className={`flex-none text-ivory-muted transition-transform duration-200 ${subjectOpen ? 'rotate-180 text-gold-400' : ''}`}
              />
            </button>
            {subjectOpen && (
              <div
                id="contact-subject-options"
                role="listbox"
                aria-label="Subject"
                className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden border border-wine-700 bg-wine-950 p-1.5 shadow-xl"
              >
                {SUBJECTS.map((option) => {
                  const selected = option === subject;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setSubject(option);
                        setSubjectOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-4 px-3 py-3 text-left text-base transition ${
                        selected
                          ? 'bg-wine-800 font-medium text-ivory'
                          : 'text-ivory-muted hover:bg-wine-900 hover:text-ivory'
                      }`}
                    >
                      <span>{option}</span>
                      {selected && <Check size={17} aria-hidden="true" className="flex-none text-gold-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="contact-message" className="mb-2 block text-sm font-medium uppercase tracking-[0.1em] text-ivory-muted">Message</label>
            <textarea id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              placeholder="How can we help?"
              className="w-full resize-none border border-wine-700 bg-wine-800 px-4 py-3 text-base text-ivory placeholder:text-ivory-dim focus:border-gold-400 focus:outline-none transition"
            />
          </div>

          {state === 'error' && (
            <p className="border border-crimson-400/30 bg-crimson-700/10 px-3 py-2 text-xs text-crimson-400">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={state === 'sending'}
            className="w-full border border-gold-400 py-3.5 text-sm font-medium uppercase tracking-[0.1em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:cursor-wait disabled:opacity-50"
          >
            {state === 'sending' ? 'Sending...' : 'Send Message'}
          </button>

          <p className="text-center text-sm text-ivory-dim">
            Your message is private. We will reply only to the email address you provide.
          </p>
        </form>
      )}
    </div>
  );
}
