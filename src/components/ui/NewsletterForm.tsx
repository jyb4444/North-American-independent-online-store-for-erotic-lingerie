'use client';
import { FormEvent, useState } from 'react';

export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage('');
    const response = await fetch('/api/newsletter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? 'Check your email to confirm your subscription.' : body.error || 'Please try again.');
    if (response.ok) setEmail('');
  }
  return <form onSubmit={submit} className="mt-5 space-y-2">
    <label htmlFor="newsletter-email" className="sr-only">Newsletter signup address</label>
    <div className="flex"><input id="newsletter-email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="min-w-0 flex-1 border border-gold-600/30 bg-wine-950 px-3 py-2 text-xs text-ivory"/><button className="border border-l-0 border-gold-600/30 px-3 text-xs uppercase tracking-wider text-gold-400">Join</button></div>
    {message && <p role="status" className="text-xs leading-relaxed text-ivory-muted">{message}</p>}
  </form>;
}
