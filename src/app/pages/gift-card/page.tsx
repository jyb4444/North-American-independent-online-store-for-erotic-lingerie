'use client';

import { useState } from 'react';
import { Gift, Check } from 'lucide-react';

const PRESET_AMOUNTS = [25, 50, 100, 150, 200];

type State = 'idle' | 'sending' | 'success' | 'error';

export default function GiftCardPage() {
  const [amount, setAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [giftCode, setGiftCode] = useState('');

  const finalAmount = useCustom ? Number(customAmount) : amount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!finalAmount || finalAmount < 10 || finalAmount > 500) {
      setErrorMsg('Please choose an amount between $10 and $500.');
      return;
    }
    setState('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/gift-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalAmount,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          sender_name: senderName,
          message,
        }),
      });
      const data = await res.json() as { ok?: boolean; code?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Failed');
      setGiftCode(data.code ?? '');
      setState('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center border border-gold-400/30 bg-wine-900">
            <Check size={28} className="text-gold-400" />
          </div>
        </div>
        <h1 className="font-serif text-3xl font-light text-ivory">Gift Card Sent</h1>
        <p className="mt-3 text-sm text-ivory-muted">
          Your ${finalAmount} gift card has been sent to <strong className="text-ivory">{recipientEmail}</strong>.
        </p>
        {giftCode && (
          <div className="mx-auto mt-8 max-w-sm border border-gold-600/30 bg-wine-900 p-6">
            <p className="mb-2 text-[11px] uppercase tracking-widest text-ivory-dim">Gift Card Code</p>
            <p className="font-serif text-xl tracking-[0.2em] text-gold-400">{giftCode}</p>
            <p className="mt-2 text-xs text-ivory-dim">Keep this for your records</p>
          </div>
        )}
        <p className="mt-8 text-xs text-ivory-dim">
          The recipient will receive an email with redemption instructions.
          Gift cards are valid for one year and can be used at checkout.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      {/* Header */}
      <div className="mb-12 text-center">
        <Gift size={32} className="mx-auto mb-4 text-gold-400/60" />
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Send a Gift</p>
        <h1 className="font-serif text-4xl font-light text-ivory">Velour Gift Card</h1>
        <p className="mt-3 text-sm text-ivory-muted">
          A thoughtful way to gift luxury intimate apparel.
          Delivered discreetly by email.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Amount selection */}
        <div>
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-ivory-muted">Choose Amount</p>
          <div className="flex flex-wrap gap-3">
            {PRESET_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => { setAmount(a); setUseCustom(false); }}
                className={`border px-5 py-3 text-sm font-light transition ${
                  !useCustom && amount === a
                    ? 'border-gold-400 text-gold-400'
                    : 'border-wine-700 text-ivory-muted hover:border-gold-400/50 hover:text-gold-400'
                }`}
              >
                ${a}
              </button>
            ))}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className={`border px-5 py-3 text-sm font-light transition ${
                  useCustom
                    ? 'border-gold-400 text-gold-400'
                    : 'border-wine-700 text-ivory-muted hover:border-gold-400/50'
                }`}
              >
                Custom
              </button>
              {useCustom && (
                <div className="flex items-center border border-wine-700 bg-wine-800">
                  <span className="px-3 text-sm text-ivory-dim">$</span>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Amount"
                    className="w-24 bg-transparent py-3 pr-3 text-sm text-ivory focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-px bg-gold-600/20" />

        {/* Recipient */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
              Recipient Name
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. Sarah"
              className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
              Recipient Email <span className="text-crimson-400">*</span>
            </label>
            <input
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@email.com"
              className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
            Your Name (shown to recipient)
          </label>
          <input
            type="text"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="e.g. Your name or 'A secret admirer'"
            className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
            Personal Message (optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={280}
            placeholder="Add a personal note…"
            className="w-full resize-none border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
          />
        </div>

        {errorMsg && (
          <p className="border border-crimson-400/30 bg-crimson-700/10 px-3 py-2 text-xs text-crimson-400">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={state === 'sending'}
          className="flex w-full items-center justify-center gap-2 border border-gold-400 py-4 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:cursor-wait disabled:opacity-50"
        >
          <Gift size={15} />
          {state === 'sending' ? 'Sending Gift Card…' : `Send $${finalAmount || '—'} Gift Card`}
        </button>

        <p className="text-center text-xs text-ivory-dim">
          Gift cards are delivered by email and valid for one year.
          The recipient&rsquo;s billing statement will show only &ldquo;VLR APPAREL&rdquo;.
        </p>
      </form>
    </div>
  );
}
