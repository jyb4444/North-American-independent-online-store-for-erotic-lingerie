'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Truck } from 'lucide-react';

export default function ReturnTrackingForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/returns/${requestId}/tracking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier, trackingNumber, trackingUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not add tracking.');
      setMessage('Return tracking saved.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add tracking.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-3 border-t border-gold-600/10 pt-4 sm:grid-cols-3">
      <label className="text-xs uppercase tracking-widest text-ivory-dim">
        Carrier
        <input
          value={carrier}
          onChange={(event) => setCarrier(event.target.value)}
          className="mt-2 w-full border border-gold-600/20 bg-wine-950 px-3 py-3 text-sm normal-case tracking-normal text-ivory outline-none focus:border-gold-400"
          placeholder="USPS"
        />
      </label>
      <label className="text-xs uppercase tracking-widest text-ivory-dim">
        Tracking
        <input
          required
          value={trackingNumber}
          onChange={(event) => setTrackingNumber(event.target.value)}
          className="mt-2 w-full border border-gold-600/20 bg-wine-950 px-3 py-3 text-sm normal-case tracking-normal text-ivory outline-none focus:border-gold-400"
          placeholder="Tracking number"
        />
      </label>
      <label className="text-xs uppercase tracking-widest text-ivory-dim">
        Link
        <input
          value={trackingUrl}
          onChange={(event) => setTrackingUrl(event.target.value)}
          className="mt-2 w-full border border-gold-600/20 bg-wine-950 px-3 py-3 text-sm normal-case tracking-normal text-ivory outline-none focus:border-gold-400"
          placeholder="Optional"
        />
      </label>
      <div className="sm:col-span-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {message && <p className="text-xs text-ivory-dim">{message}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-fit items-center gap-2 border border-gold-400 px-4 py-2 text-[10px] uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:opacity-50"
        >
          <Truck size={14} />
          {submitting ? 'Saving...' : 'Save Tracking'}
        </button>
      </div>
    </form>
  );
}
