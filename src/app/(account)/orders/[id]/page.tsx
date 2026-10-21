import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Package, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getOrderForUser } from '@/lib/logistics';
import { getReturnRequestsForOrder, getSignedReturnMediaUrls } from '@/lib/returns';
import ReturnRequestForm from '@/components/returns/ReturnRequestForm';
import ReturnPhotoGallery from '@/components/returns/ReturnPhotoGallery';

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

function label(value: string | null) {
  return value ? value.replace(/_/g, ' ') : 'Preparing';
}

function requestStatusTone(status: string) {
  if (status === 'rejected') return 'border-crimson-400/35 text-crimson-300';
  if (['approved', 'refunded', 'exchanged', 'reshipped'].includes(status)) return 'border-gold-400/60 text-gold-400';
  return 'border-gold-600/30 text-gold-400';
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const order = await getOrderForUser(id, user.id);
  if (!order) notFound();

  const returnRequests = await getReturnRequestsForOrder(order.id, user.id);
  const hasReturnRequests = returnRequests.length > 0;
  const returnPhotos = Object.fromEntries(
    await Promise.all(
      returnRequests.map(async (request) => [
        request.id,
        await getSignedReturnMediaUrls(request.media_urls, user.id),
      ] as const),
    ),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <Link href="/orders" className="mb-3 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ivory-dim transition hover:text-gold-400">
            <ArrowLeft size={14} />
            Orders
          </Link>
          <h1 className="font-serif text-3xl font-light text-ivory">Order #{order.shopify_order_number}</h1>
          <p className="mt-1 text-sm text-ivory-dim">{formatDate(order.processed_at ?? order.created_at)}</p>
        </div>
        <span className="border border-gold-600/40 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-gold-400">
          {label(order.fulfillment_status)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="h-full border border-gold-600/20 bg-wine-900 p-6">
          <div className="mb-4 flex items-center gap-3">
            <Package size={18} className="text-gold-400" />
            <h2 className="font-serif text-xl font-light text-ivory">Items</h2>
          </div>
          <div className="space-y-3">
            {(order.order_items ?? []).length === 0 ? (
              <p className="text-sm text-ivory-muted">Item details are syncing from Shopify.</p>
            ) : (
              order.order_items?.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 border border-gold-600/10 bg-wine-950/30 p-4">
                  <div>
                    <p className="text-sm text-ivory">{item.title}</p>
                    <p className="mt-1 text-xs text-ivory-dim">{item.variant_title ?? 'Default'} · Qty {item.quantity}</p>
                  </div>
                  <p className="text-sm text-gold-400">{money(item.price, order.currency)}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="h-full border border-gold-600/20 bg-wine-900 p-6">
          <div className="mb-4 flex items-center gap-3">
            <Truck size={18} className="text-gold-400" />
            <h2 className="font-serif text-xl font-light text-ivory">Shipping</h2>
          </div>
          {order.shipments.length === 0 ? (
            <p className="text-sm text-ivory-muted">No shipment yet.</p>
          ) : (
            <div className="space-y-3">
              {order.shipments.map((shipment) => (
                <div key={shipment.id} className="border border-gold-600/10 bg-wine-950/30 p-4">
                  <p className="text-xs uppercase tracking-widest text-ivory-dim">{shipment.carrier ?? 'Carrier'}</p>
                  <p className="mt-1 text-sm text-ivory">{shipment.tracking_number ?? 'Tracking pending'}</p>
                  <p className="mt-2 text-xs capitalize text-gold-400">{label(shipment.status)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {hasReturnRequests ? (
          <section className="h-full border border-gold-600/20 bg-wine-900 p-6">
            <div className="mb-4 flex items-center gap-3">
              <RotateCcw size={18} className="text-gold-400" />
              <h2 className="font-serif text-xl font-light text-ivory">Return Started</h2>
            </div>
            <p className="text-sm leading-relaxed text-ivory-muted">
              This order already has a return request. Review the existing RMA below instead of submitting another request for the same order.
            </p>
            <Link
              href={`/returns/${returnRequests[0].id}`}
              className="mt-5 inline-flex items-center justify-center border border-gold-600/30 px-4 py-3 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400 hover:text-gold-400"
            >
              View Latest Request
            </Link>
          </section>
        ) : (
          <ReturnRequestForm orderId={order.id} items={order.order_items ?? []} />
        )}

        <section className="h-full border border-gold-600/20 bg-wine-900 p-6">
          <div className="mb-4 flex items-center gap-3">
            <ShieldCheck size={18} className="text-gold-400" />
            <h2 className="font-serif text-xl font-light text-ivory">Policy</h2>
          </div>
          <ul className="space-y-2 text-xs leading-relaxed text-ivory-muted">
            <li>Underwear and bottom intimate items are final sale for hygiene reasons.</li>
            <li>Damaged hosiery or stockings cannot be returned unless the issue is a verified defect or transit damage.</li>
            <li>Unopened eligible items can be reviewed within 30 days.</li>
            <li>Approved returns use customer self-ship first; add tracking after approval.</li>
          </ul>
        </section>
      </div>

      <section className="mt-6 border border-gold-600/20 bg-wine-900 p-6">
        <div className="mb-4 flex items-center gap-3">
          <RotateCcw size={18} className="text-gold-400" />
          <h2 className="font-serif text-xl font-light text-ivory">Return Requests</h2>
        </div>
        {returnRequests.length === 0 ? (
          <p className="text-sm text-ivory-muted">No return requests for this order.</p>
        ) : (
          <div className="space-y-4">
            {returnRequests.map((request) => (
              <div key={request.id} className="border border-gold-600/15 bg-wine-950/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-ivory">{request.request_number}</p>
                    <p className="mt-1 text-xs text-ivory-dim">
                      {formatDate(request.submitted_at)} · {label(request.reason)} · {label(request.desired_resolution)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`border px-2 py-1 text-[10px] uppercase tracking-widest ${requestStatusTone(request.status)}`}>
                      {label(request.status)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {request.policy_notes.map((note) => (
                    <div key={note} className="flex gap-2 text-xs text-ivory-muted">
                      <CheckCircle2 size={13} className="mt-0.5 flex-shrink-0 text-gold-400" />
                      {note}
                    </div>
                  ))}
                </div>

                {request.return_request_items.length > 0 && (
                  <div className="mt-4 grid gap-3 border-t border-gold-600/10 pt-4 text-xs text-ivory-dim sm:grid-cols-2">
                    {request.return_request_items.map((item) => (
                      <div key={item.id} className="border border-gold-600/10 bg-wine-900/50 p-3">
                        <p className="text-sm text-ivory">{item.order_items.title}</p>
                        <p className="mt-1">Qty {item.quantity} · {label(item.item_condition)}</p>
                        {item.reason_detail && (
                          <p className="mt-2 text-ivory-muted">Item note: {item.reason_detail}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 grid gap-4 border-t border-gold-600/10 pt-4 text-xs text-ivory-dim sm:grid-cols-3">
                  <div>
                    <p className="uppercase tracking-widest text-ivory-dim">Resolution</p>
                    <p className="mt-1 text-ivory-muted">{label(request.desired_resolution)}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-widest text-ivory-dim">Photos</p>
                    <div className="mt-2">
                      <ReturnPhotoGallery photos={returnPhotos[request.id] ?? []} />
                    </div>
                  </div>
                  <div>
                    <p className="uppercase tracking-widest text-ivory-dim">Reason</p>
                    <p className="mt-1 text-ivory-muted">{label(request.reason)}</p>
                  </div>
                  {request.customer_note && (
                    <div className="sm:col-span-3">
                      <p className="uppercase tracking-widest text-ivory-dim">Details</p>
                      <p className="mt-1 text-ivory-muted">{request.customer_note}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/returns/${request.id}`}
                    className="inline-flex items-center justify-center border border-gold-600/30 px-4 py-3 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400 hover:text-gold-400"
                  >
                    View Return Request
                  </Link>
                  <Link
                    href="/returns"
                    className="inline-flex items-center justify-center border border-gold-600/20 px-4 py-3 text-xs uppercase tracking-widest text-ivory-dim transition hover:border-gold-400 hover:text-gold-400"
                  >
                    All Returns
                  </Link>
                </div>

              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
