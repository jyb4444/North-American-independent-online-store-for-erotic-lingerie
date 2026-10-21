import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getOrdersForUser, syncShopifyOrdersForUser } from '@/lib/logistics';
import OrderHistoryClient from '@/components/orders/OrderHistoryClient';

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (user.email) {
    await syncShopifyOrdersForUser({ userId: user.id, email: user.email });
  }

  const orders = await getOrdersForUser(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Account</p>
          <h1 className="font-serif text-4xl font-light text-ivory">Order History</h1>
          <p className="mt-2 max-w-xl text-sm text-ivory-dim">
            Review recent orders, track active shipments, and start a return request when eligible.
          </p>
        </div>
        <Link
          href="/account"
          className="inline-flex w-fit items-center gap-2 text-xs uppercase tracking-widest text-ivory-dim transition hover:text-gold-400"
        >
          <ArrowLeft size={14} />
          Account
        </Link>
      </div>

      <OrderHistoryClient orders={orders} />
    </div>
  );
}
