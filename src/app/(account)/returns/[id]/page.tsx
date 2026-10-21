import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ExternalLink, Package, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { canCancelReturnRequest, getReturnRequestForUser, getSignedReturnMediaUrls, isSafeTrackingUrl } from '@/lib/returns';
import CancelReturnRequestButton from '@/components/returns/CancelReturnRequestButton';
import ReturnPhotoGallery from '@/components/returns/ReturnPhotoGallery';

function formatDate(value: string | null) {
  if (!value) return 'Pending';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function label(value: string | null) {
  return value ? value.replace(/_/g, ' ') : 'Preparing';
}

function statusTone(status: string) {
  if (status === 'rejected') return 'border-crimson-400/35 text-crimson-300';
  if (['approved', 'refunded', 'exchanged', 'reshipped'].includes(status)) return 'border-gold-400/60 text-gold-400';
  return 'border-gold-600/30 text-gold-400';
}

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const request = await getReturnRequestForUser(id, user.id);
  if (!request) notFound();

  const photos = await getSignedReturnMediaUrls(request.media_urls, user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/returns" className="mb-3 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ivory-dim transition hover:text-gold-400">
            <ArrowLeft size={14} />
            Return Items
          </Link>
          <h1 className="font-serif text-4xl font-light text-ivory">{request.request_number}</h1>
          <p className="mt-2 text-sm text-ivory-dim">
            Submitted {formatDate(request.submitted_at)} · {label(request.reason)} · {label(request.desired_resolution)}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <span className={`border px-2.5 py-1.5 text-[10px] uppercase tracking-widest ${statusTone(request.status)}`}>
              {label(request.status)}
            </span>
          </div>
          {canCancelReturnRequest(request.status) && <CancelReturnRequestButton requestId={request.id} />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="h-full border border-gold-600/20 bg-wine-900 p-6 lg:col-span-8">
          <div className="mb-4 flex items-center gap-3">
            <Package size={18} className="text-gold-400" />
            <h2 className="font-serif text-xl font-light text-ivory">Returned Items</h2>
          </div>
          <div className="grid gap-3">
            {request.return_request_items.map((item) => (
              <div key={item.id} className="border border-gold-600/10 bg-wine-950/30 p-4">
                <p className="text-sm text-ivory">{item.order_items.title}</p>
                <p className="mt-1 text-xs text-ivory-dim">
                  {item.order_items.variant_title ?? 'Default'} · Qty {item.quantity} · {label(item.item_condition)}
                </p>
                {item.reason_detail && <p className="mt-3 text-sm text-ivory-muted">Item note: {item.reason_detail}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="h-full border border-gold-600/20 bg-wine-900 p-6 lg:col-span-4">
          <h2 className="font-serif text-xl font-light text-ivory">Related Order</h2>
          {request.orders ? (
            <>
              <p className="mt-3 text-sm text-ivory">Order #{request.orders.shopify_order_number}</p>
              <p className="mt-1 text-xs text-ivory-dim">{formatDate(request.orders.processed_at ?? request.orders.created_at)}</p>
              <Link
                href={`/orders/${request.orders.id}`}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 border border-gold-600/30 px-4 py-3 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400 hover:text-gold-400"
              >
                View Order
                <ExternalLink size={12} />
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-ivory-dim">Order details are unavailable.</p>
          )}
        </section>

        <section className="h-full border border-gold-600/20 bg-wine-900 p-6 lg:col-span-8">
          <div className="mb-4 flex items-center gap-3">
            <RotateCcw size={18} className="text-gold-400" />
            <h2 className="font-serif text-xl font-light text-ivory">Review Details</h2>
          </div>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-ivory-dim">Resolution</p>
              <p className="mt-1 text-ivory-muted">{label(request.desired_resolution)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-ivory-dim">Reason</p>
              <p className="mt-1 text-ivory-muted">{label(request.reason)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-ivory-dim">Photos</p>
              <p className="mt-1 text-ivory-muted">{request.media_urls.length} uploaded</p>
            </div>
          </div>
          {request.customer_note && (
            <div className="mt-5 border-t border-gold-600/10 pt-5">
              <p className="text-xs uppercase tracking-widest text-ivory-dim">Customer Message</p>
              <p className="mt-2 text-sm leading-relaxed text-ivory-muted">{request.customer_note}</p>
            </div>
          )}
          <div className="mt-5 border-t border-gold-600/10 pt-5">
            <p className="mb-3 text-xs uppercase tracking-widest text-ivory-dim">Photos</p>
            <ReturnPhotoGallery photos={photos} />
          </div>
        </section>

        <section className="h-full border border-gold-600/20 bg-wine-900 p-6 lg:col-span-4">
          <h2 className="font-serif text-xl font-light text-ivory">Timeline</h2>
          <div className="mt-4 space-y-4">
            {request.return_request_events.length === 0 ? (
              <p className="text-sm text-ivory-dim">No updates yet.</p>
            ) : (
              request.return_request_events.map((event) => (
                <div key={event.id} className="border-l border-gold-600/30 pl-4">
                  <p className="text-sm text-ivory">{event.title}</p>
                  <p className="mt-1 text-xs text-ivory-dim">{formatDate(event.created_at)}</p>
                  {event.description && <p className="mt-2 text-xs leading-relaxed text-ivory-muted">{event.description}</p>}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="border border-gold-600/20 bg-wine-900 p-6 lg:col-span-12">
          <h2 className="font-serif text-xl font-light text-ivory">Policy Review</h2>
          <div className="mt-4 space-y-2">
            {request.policy_notes.map((note) => (
              <div key={note} className="flex gap-2 text-sm text-ivory-muted">
                <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-gold-400" />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </section>

        {request.return_tracking_number && (
          <section className="border border-gold-600/20 bg-wine-900 p-6 lg:col-span-12">
            <h2 className="font-serif text-xl font-light text-ivory">Return Shipment</h2>
            {request.return_tracking_number && (
              <div className="mt-4 text-sm text-ivory-muted">
                <p>{request.return_carrier ?? 'Carrier'} · {request.return_tracking_number}</p>
                {isSafeTrackingUrl(request.return_tracking_url) && (
                  <Link href={request.return_tracking_url} rel="noopener noreferrer" target="_blank" className="mt-2 inline-flex text-xs uppercase tracking-widest text-gold-400 transition hover:text-gold-300">
                    Track Return
                  </Link>
                )}
              </div>
            )}
            <p className="mt-4 text-xs leading-relaxed text-ivory-dim">
              Send any tracking updates by replying to your return approval email.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
