'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDownAZ, CalendarDays, CheckCircle2, Clock3, Package, RotateCcw, Truck } from 'lucide-react';
import type { OrderWithShipments } from '@/lib/logistics';

type SortMode = 'newest' | 'oldest' | 'status' | 'amount';

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

function orderTime(order: OrderWithShipments) {
  return new Date(order.processed_at ?? order.created_at).getTime();
}

function isComplete(order: OrderWithShipments) {
  const fulfillment = (order.fulfillment_status ?? '').toLowerCase();
  if (fulfillment.includes('unfulfilled') || fulfillment.includes('partial')) return false;
  if (fulfillment.includes('fulfilled') || fulfillment.includes('delivered')) return true;
  return order.shipments.length > 0 && order.shipments.every((shipment) => shipment.status === 'delivered' || shipment.delivered_at);
}

function sortOrders(orders: OrderWithShipments[], sort: SortMode) {
  return [...orders].sort((a, b) => {
    if (sort === 'oldest') return orderTime(a) - orderTime(b);
    if (sort === 'status') return label(a.fulfillment_status).localeCompare(label(b.fulfillment_status));
    if (sort === 'amount') return (b.total_amount ?? 0) - (a.total_amount ?? 0);
    return orderTime(b) - orderTime(a);
  });
}

function OrderCard({ order }: { order: OrderWithShipments }) {
  const complete = isComplete(order);
  const latestShipment = order.shipments[0];

  return (
    <article className="border border-gold-600/20 bg-wine-900 px-5 py-5 transition hover:border-gold-400/35">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-serif text-2xl font-light text-ivory">#{order.shopify_order_number}</h3>
            <span className={`border px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest ${
              complete ? 'border-gold-600/30 text-ivory-dim' : 'border-gold-400/60 text-gold-400'
            }`}>
              {label(order.fulfillment_status)}
            </span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-widest text-ivory-dim">
            {formatDate(order.processed_at ?? order.created_at)}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-serif text-xl text-gold-400">{money(order.total_amount, order.currency)}</p>
          <p className="mt-1 text-xs text-ivory-dim">{order.order_items?.length ?? 0} item{(order.order_items?.length ?? 0) === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-gold-600/10 pt-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ivory-muted">
          <span className="inline-flex items-center gap-2">
            <Truck size={15} className="text-gold-400" />
            {order.shipments.length} shipment{order.shipments.length === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-2">
            {complete ? <CheckCircle2 size={15} className="text-gold-400" /> : <Clock3 size={15} className="text-gold-400" />}
            {latestShipment?.tracking_number ? latestShipment.tracking_number : complete ? 'Completed' : 'In progress'}
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/orders/${order.id}`}
            className="inline-flex items-center gap-2 border border-gold-400 px-4 py-2 text-[10px] uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
          >
            <RotateCcw size={14} />
            Manage / Return
          </Link>
          {latestShipment && (
            <Link
              href={`/track/${latestShipment.public_lookup_token}`}
              className="inline-flex items-center gap-2 border border-gold-600/35 px-4 py-2 text-[10px] uppercase tracking-widest text-ivory-muted transition hover:border-gold-400 hover:text-gold-400"
            >
              <Truck size={14} />
              Track
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function OrderSection({
  title,
  subtitle,
  orders,
}: {
  title: string;
  subtitle: string;
  orders: OrderWithShipments[];
}) {
  if (orders.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 border-b border-gold-600/20 pb-3">
        <div>
          <h2 className="font-serif text-2xl font-light text-ivory">{title}</h2>
          <p className="mt-1 text-xs uppercase tracking-widest text-ivory-dim">{subtitle}</p>
        </div>
        <span className="text-xs uppercase tracking-widest text-gold-400">{orders.length}</span>
      </div>
      <div className="space-y-4">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </section>
  );
}

export default function OrderHistoryClient({ orders }: { orders: OrderWithShipments[] }) {
  const [sort, setSort] = useState<SortMode>('newest');
  const sorted = useMemo(() => sortOrders(orders, sort), [orders, sort]);
  const activeOrders = sorted.filter((order) => !isComplete(order));
  const completedOrders = sorted.filter(isComplete);

  if (orders.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center border border-gold-600/20 bg-wine-900 text-center">
        <Package size={32} className="mb-3 text-wine-700" />
        <p className="font-serif text-xl font-light italic text-ivory-muted">Your order history is ready</p>
        <Link href="/" className="mt-4 text-xs uppercase tracking-widest text-gold-400 hover:underline">
          Explore private styles
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="border border-gold-600/20 bg-wine-900 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ivory-dim">Total Orders</p>
              <p className="mt-1 font-serif text-2xl text-ivory">{orders.length}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ivory-dim">In Progress</p>
              <p className="mt-1 font-serif text-2xl text-gold-400">{activeOrders.length}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ivory-dim">Completed</p>
              <p className="mt-1 font-serif text-2xl text-ivory">{completedOrders.length}</p>
            </div>
          </div>

          <label className="flex w-full items-center gap-3 text-xs uppercase tracking-widest text-ivory-dim sm:w-auto">
            <ArrowDownAZ size={15} className="text-gold-400" />
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
              className="min-w-40 border border-gold-600/25 bg-wine-950 px-3 py-2 text-xs uppercase tracking-widest text-ivory outline-none transition focus:border-gold-400"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="status">Status</option>
              <option value="amount">Order total</option>
            </select>
          </label>
        </div>
      </div>

      <OrderSection
        title="In Progress"
        subtitle="Orders still being prepared, shipped, or delivered"
        orders={activeOrders}
      />

      {activeOrders.length > 0 && completedOrders.length > 0 && (
        <div className="flex items-center gap-4" aria-hidden>
          <div className="h-px flex-1 bg-gold-600/20" />
          <CalendarDays size={16} className="text-gold-400/70" />
          <div className="h-px flex-1 bg-gold-600/20" />
        </div>
      )}

      <OrderSection
        title="Completed"
        subtitle="Fulfilled orders and past private purchases"
        orders={completedOrders}
      />
    </div>
  );
}
