'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle2, Loader2, Package, Search, Truck } from 'lucide-react';

export type PublicTrackingOrder = {
  orderNumber: string;
  fulfillmentStatus: string | null;
  processedAt: string | null;
  createdAt: string;
  shipments: {
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    status: string;
    estimatedDeliveryAt: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    events: {
      id: string;
      status: string;
      title: string;
      description: string | null;
      location: string | null;
      occurredAt: string;
    }[];
  }[];
};

function formatDate(value: string | null) {
  if (!value) return 'Pending';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status: string | null) {
  if (!status) return 'Preparing';
  return status.replace(/_/g, ' ');
}

export default function TrackingLookup({
  initialOrder = null,
  initialError = '',
}: {
  initialOrder?: PublicTrackingOrder | null;
  initialError?: string;
}) {
  const [orderNumber, setOrderNumber] = useState('');
  const [contact, setContact] = useState('');
  const [order, setOrder] = useState<PublicTrackingOrder | null>(initialOrder);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function lookup(payload: { token?: string; orderNumber?: string; email?: string; phone?: string }) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/logistics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { order?: PublicTrackingOrder; error?: string };
      if (!res.ok || !data.order) throw new Error(data.error ?? 'Tracking lookup failed.');
      setOrder(data.order);
    } catch (err) {
      setOrder(null);
      setError(err instanceof Error ? err.message : 'Tracking lookup failed.');
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = contact.trim();
    void lookup({
      orderNumber: orderNumber.trim(),
      email: value.includes('@') ? value : undefined,
      phone: value.includes('@') ? undefined : value,
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="mb-8">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Private Tracking</p>
        <h1 className="font-serif text-4xl font-light text-ivory">Order Status</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ivory-dim">
          Status updates come from the Self Love order system. For the most recent carrier scan,
          open the Carrier Page when a tracking number is available. If your package looks delayed
          or unusual, contact support and we will help review it.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mb-8 border border-gold-600/20 bg-wine-900 p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">Order</span>
            <input
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              placeholder="1001"
              className="h-11 w-full border border-wine-700 bg-wine-800 px-3 text-sm text-ivory outline-none transition focus:border-gold-400"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">Email or Phone</span>
            <input
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="you@example.com"
              className="h-11 w-full border border-wine-700 bg-wine-800 px-3 text-sm text-ivory outline-none transition focus:border-gold-400"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-auto flex h-11 items-center justify-center gap-2 border border-gold-400 px-5 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Track
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 border border-crimson-400/30 bg-crimson-700/10 px-4 py-3 text-sm text-crimson-400">
          {error}
        </div>
      )}

      {order && (
        <div className="space-y-5">
          <div className="border border-gold-600/20 bg-wine-900 p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs uppercase tracking-widest text-ivory-dim">Order</p>
                <p className="mt-1 font-serif text-2xl font-light text-ivory">#{order.orderNumber}</p>
              </div>
              <span className="w-fit border border-gold-600/40 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-gold-400">
                {statusLabel(order.fulfillmentStatus)}
              </span>
            </div>
            <p className="mt-4 text-xs text-ivory-dim">Placed {formatDate(order.processedAt ?? order.createdAt)}</p>
          </div>

          {order.shipments.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center border border-gold-600/20 bg-wine-900 text-center">
              <Package size={28} className="mb-3 text-wine-700" />
              <p className="font-serif text-lg font-light italic text-ivory-muted">Preparing for fulfillment</p>
            </div>
          ) : order.shipments.map((shipment, index) => (
            <div key={`${shipment.trackingNumber ?? index}-${shipment.status}`} className="border border-gold-600/20 bg-wine-900 p-5">
              <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 items-center justify-center border border-gold-600/30 text-gold-400">
                    <Truck size={18} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-ivory-dim">{shipment.carrier ?? 'Carrier'}</p>
                    <p className="mt-1 font-medium text-ivory">{shipment.trackingNumber ?? 'Tracking pending'}</p>
                  </div>
                </div>
                {shipment.trackingUrl && (
                  <a
                    href={shipment.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-fit border border-gold-400 px-4 py-2 text-[10px] uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
                  >
                    Carrier Page
                  </a>
                )}
              </div>

              <div className="grid gap-3 border-y border-gold-600/10 py-4 text-xs sm:grid-cols-3">
                <div>
                  <p className="uppercase tracking-widest text-ivory-dim">Status</p>
                  <p className="mt-1 capitalize text-ivory-muted">{statusLabel(shipment.status)}</p>
                </div>
                <div>
                  <p className="uppercase tracking-widest text-ivory-dim">Shipped</p>
                  <p className="mt-1 text-ivory-muted">{formatDate(shipment.shippedAt)}</p>
                </div>
                <div>
                  <p className="uppercase tracking-widest text-ivory-dim">Estimated</p>
                  <p className="mt-1 text-ivory-muted">{formatDate(shipment.estimatedDeliveryAt)}</p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {shipment.events.map((event, eventIndex) => (
                  <div key={event.id || `${event.status}-${event.occurredAt}-${eventIndex}`} className="flex gap-3">
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-gold-400" />
                    <div>
                      <p className="text-sm font-medium text-ivory">{event.title}</p>
                      {event.description && <p className="mt-1 text-xs text-ivory-dim">{event.description}</p>}
                      <p className="mt-1 text-[11px] uppercase tracking-widest text-ivory-dim">{formatDate(event.occurredAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
