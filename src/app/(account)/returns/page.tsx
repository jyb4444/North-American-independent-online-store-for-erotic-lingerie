import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ExternalLink, Package, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getReturnRequestsForUser } from '@/lib/returns';

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

export default async function ReturnsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const requests = await getReturnRequestsForUser(user.id);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/account" className="mb-3 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ivory-dim transition hover:text-gold-400">
            <ArrowLeft size={14} />
            Account
          </Link>
          <h1 className="font-serif text-4xl font-light text-ivory">Return Items</h1>
          <p className="mt-2 max-w-xl text-sm text-ivory-dim">
            Review requests submitted from your orders. We will email you when a decision or shipping instruction is ready.
          </p>
        </div>
        <Link
          href="/orders"
          className="inline-flex w-fit items-center gap-2 border border-gold-600/30 px-4 py-3 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400 hover:text-gold-400"
        >
          <Package size={14} />
          Order History
        </Link>
      </div>

      {requests.length === 0 ? (
        <section className="border border-gold-600/20 bg-wine-900 p-8 text-center">
          <RotateCcw size={24} className="mx-auto text-gold-400" />
          <h2 className="mt-4 font-serif text-2xl font-light text-ivory">No return requests yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ivory-dim">
            Start from an order detail page when you need us to review a return.
          </p>
          <Link
            href="/orders"
            className="mt-5 inline-flex items-center gap-2 border border-gold-600/30 px-4 py-3 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400 hover:text-gold-400"
          >
            View Orders
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <article key={request.id} className="border border-gold-600/20 bg-wine-900 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Link href={`/returns/${request.id}`} className="text-base font-medium text-ivory transition hover:text-gold-400">
                    {request.request_number}
                  </Link>
                  <p className="mt-1 text-xs text-ivory-dim">
                    {formatDate(request.submitted_at)} · {label(request.reason)} · {label(request.desired_resolution)}
                  </p>
                  {request.orders && (
                    <Link
                      href={`/orders/${request.orders.id}`}
                      className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-gold-400/80 transition hover:text-gold-400"
                    >
                      Order #{request.orders.shopify_order_number}
                      <ExternalLink size={12} />
                    </Link>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`border px-2.5 py-1.5 text-xs uppercase tracking-widest ${statusTone(request.status)}`}>
                    {label(request.status)}
                  </span>
                </div>
              </div>

              <div className="mt-5 border-t border-gold-600/10 pt-5">
                <div className="space-y-3">
                  {request.return_request_items.map((item) => (
                    <div key={item.id} className="border border-gold-600/10 bg-wine-950/30 p-4">
                      <p className="text-sm text-ivory">{item.order_items.title}</p>
                      <p className="mt-1 text-xs text-ivory-dim">Qty {item.quantity}</p>
                    </div>
                  ))}
                  {request.customer_note && (
                    <p className="text-sm text-ivory-muted">{request.customer_note}</p>
                  )}
                </div>

              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/returns/${request.id}`}
                  className="inline-flex items-center justify-center border border-gold-600/30 px-4 py-3 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400 hover:text-gold-400"
                >
                  View Return Request
                </Link>
                {request.orders && (
                  <Link
                    href={`/orders/${request.orders.id}`}
                    className="inline-flex items-center justify-center border border-gold-600/20 px-4 py-3 text-xs uppercase tracking-widest text-ivory-dim transition hover:border-gold-400 hover:text-gold-400"
                  >
                    View Order
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
