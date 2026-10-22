'use client';
import { FormEvent, useState } from 'react';

export default function RestockAlertForm(props: { productId: string; productHandle: string; size: string; color: string }) {
  const [email, setEmail] = useState(''); const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/restock-notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, product_id: props.productId, product_handle: props.productHandle, size: props.size, color: props.color }) });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? 'We will email you when this option is available.' : body.error || 'Please try again.');
    if (response.ok) setEmail('');
  }
  return <form onSubmit={submit} className="mt-4 border border-gold-600/30 p-4">
    <p className="mb-3 text-xs text-ivory-muted">This option is out of stock. Request one availability email.</p>
    <div className="flex gap-2"><input aria-label="Restock email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1 border border-wine-700 bg-wine-950 px-3 py-2 text-sm text-ivory" placeholder="Email address"/><button className="border border-gold-400 px-3 text-xs uppercase text-gold-400">Notify me</button></div>
    {message && <p role="status" className="mt-2 text-xs text-ivory-muted">{message}</p>}
  </form>;
}
