'use client';

import { useState } from 'react';
import { Gift } from 'lucide-react';
import type { GiftCardDenomination } from '@/lib/shopify/gift-card';

const MESSAGE_MAX = 200;

const inputClass =
  'w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition';
const labelClass = 'mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted';

function formatAmount({ amount, currencyCode }: GiftCardDenomination) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(amount);
}

export default function GiftCardForm({ denominations }: { denominations: GiftCardDenomination[] }) {
  const [variantId, setVariantId] = useState(denominations[0]?.variantId ?? '');
  const [sendToRecipient, setSendToRecipient] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selected = denominations.find((option) => option.variantId === variantId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setErrorMsg('Please choose a gift card amount.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/shopify/gift-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, sendToRecipient, recipientEmail, recipientName, message }),
      });
      const data = await res.json() as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error ?? 'Could not start checkout.');
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Amount selection */}
      <fieldset>
        <legend className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-ivory-muted">Choose Amount</legend>
        <div className="flex flex-wrap gap-3">
          {denominations.map((option) => (
            <button
              key={option.variantId}
              type="button"
              aria-pressed={option.variantId === variantId}
              onClick={() => setVariantId(option.variantId)}
              className={`border px-5 py-3 text-sm font-light transition ${
                option.variantId === variantId
                  ? 'border-gold-400 text-gold-400'
                  : 'border-wine-700 text-ivory-muted hover:border-gold-400/50 hover:text-gold-400'
              }`}
            >
              {formatAmount(option)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="h-px bg-gold-600/20" />

      {/* Delivery */}
      <fieldset className="space-y-3">
        <legend className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-ivory-muted">Delivery</legend>
        <label className="flex items-center gap-3 text-sm text-ivory-muted">
          <input type="radio" name="delivery" checked={sendToRecipient} onChange={() => setSendToRecipient(true)} />
          Email it to someone
        </label>
        <label className="flex items-center gap-3 text-sm text-ivory-muted">
          <input type="radio" name="delivery" checked={!sendToRecipient} onChange={() => setSendToRecipient(false)} />
          Send it to me (I&rsquo;ll pass it on)
        </label>
      </fieldset>

      {sendToRecipient && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="gc-recipient-name" className={labelClass}>Recipient Name</label>
              <input
                id="gc-recipient-name"
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                maxLength={255}
                placeholder="e.g. Sarah"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="gc-recipient-email" className={labelClass}>
                Recipient Email <span className="text-crimson-400">*</span>
              </label>
              <input
                id="gc-recipient-email"
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="recipient@email.com"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="gc-message" className={labelClass}>Personal Message (optional)</label>
            <textarea
              id="gc-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={MESSAGE_MAX}
              placeholder="Add a personal note — sign it so they know who it's from"
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1 text-right text-[11px] text-ivory-dim">{message.length}/{MESSAGE_MAX}</p>
          </div>
        </>
      )}

      {errorMsg && (
        <p role="alert" className="border border-crimson-400/30 bg-crimson-700/10 px-3 py-2 text-xs text-crimson-400">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !selected}
        className="flex w-full items-center justify-center gap-2 border border-gold-400 py-4 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:cursor-wait disabled:opacity-50"
      >
        <Gift size={15} />
        {submitting ? 'Preparing checkout…' : `Continue to checkout · ${selected ? formatAmount(selected) : '—'}`}
      </button>

      <p className="text-center text-xs text-ivory-dim">
        Payment is completed at secure checkout. The gift card code is emailed
        {sendToRecipient ? ' to the recipient' : ' to you'} after purchase and can be used at checkout.
      </p>
    </form>
  );
}
