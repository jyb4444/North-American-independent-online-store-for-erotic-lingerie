import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Package, Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getOrdersForUser } from '@/lib/logistics';

function formatDate(value: string | null) {
  if (!value) return 'Pending';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function money(value: number | null, currency: string) {
  if (value === null) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function statusLabel(status: string | null) {
  if (!status) return 'Preparing';
  return status.replace(/_/g, ' ');
}

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const orders = await getOrdersForUser(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-light text-ivory">Private Activity</h1>
        <Link href="/account" className="text-xs uppercase tracking-widest text-ivory-dim hover:text-gold-400 transition">
          ← Account
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center border border-gold-600/20 bg-wine-900 text-center">
          <Package size={32} className="mb-3 text-wine-700" />
          <p className="font-serif text-xl font-light italic text-ivory-muted">Your private activity is ready</p>
          <Link href="/" className="mt-4 text-xs uppercase tracking-widest text-gold-400 hover:underline">
            Explore private styles
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => (
            <div key={order.id} className="border border-gold-600/20 bg-wine-900 p-5 transition hover:border-gold-400/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-ivory">#{order.shopify_order_number}</p>
                  <p className="mt-0.5 text-xs text-ivory-dim">{formatDate(order.processed_at ?? order.created_at)}</p>
                </div>
                <span className="border border-gold-600/40 px-3 py-0.5 text-[10px] font-medium uppercase tracking-widest text-gold-400">
                  {statusLabel(order.fulfillment_status)}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-gold-600/10 pt-3 text-xs">
                <span className="text-ivory-dim">{order.shipments.length} shipment{order.shipments.length === 1 ? '' : 's'}</span>
                <span className="font-serif text-base text-gold-400">{money(order.total_amount, order.currency)}</span>
              </div>

              {order.shipments.length > 0 && (
                <div className="mt-5 space-y-4">
                  {order.shipments.map((shipment) => (
                    <div key={shipment.id} className="border border-gold-600/15 bg-wine-950/40 p-4">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="flex gap-3">
                          <div className="flex h-9 w-9 items-center justify-center border border-gold-600/30 text-gold-400">
                            <Truck size={16} />
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-widest text-ivory-dim">{shipment.carrier ?? 'Carrier'}</p>
                            <p className="mt-1 text-sm text-ivory-muted">{shipment.tracking_number ?? 'Tracking pending'}</p>
                          </div>
                        </div>
                        <Link
                          href={`/track/${shipment.public_lookup_token}`}
                          className="w-fit border border-gold-400 px-4 py-2 text-[10px] uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
                        >
                          Track
                        </Link>
                      </div>

                      {shipment.shipment_events.length > 0 && (
                        <div className="mt-4 space-y-3 border-t border-gold-600/10 pt-4">
                          {shipment.shipment_events.slice(0, 3).map((event) => (
                            <div key={event.id} className="flex gap-3">
                              <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-gold-400" />
                              <div>
                                <p className="text-sm text-ivory">{event.title}</p>
                                <p className="mt-0.5 text-[11px] uppercase tracking-widest text-ivory-dim">{formatDate(event.occurred_at)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
