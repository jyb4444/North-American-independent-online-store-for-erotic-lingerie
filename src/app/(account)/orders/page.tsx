import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // TODO: show real order activity after ordering is connected.
  const mockOrders: { id: string; date: string; status: string; total: string; items: number }[] = [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-light text-ivory">Private Activity</h1>
        <Link href="/account" className="text-xs uppercase tracking-widest text-ivory-dim hover:text-gold-400 transition">
          ← Account
        </Link>
      </div>

      {mockOrders.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center border border-gold-600/20 bg-wine-900 text-center">
          <Package size={32} className="mb-3 text-wine-700" />
          <p className="font-serif text-xl font-light italic text-ivory-muted">Your private activity is ready</p>
          <Link href="/" className="mt-4 text-xs uppercase tracking-widest text-gold-400 hover:underline">
            Explore private styles
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {mockOrders.map((order) => (
            <div key={order.id} className="border border-gold-600/20 bg-wine-900 p-5 transition hover:border-gold-400/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-ivory">{order.id}</p>
                  <p className="mt-0.5 text-xs text-ivory-dim">{order.date}</p>
                </div>
                <span className="border border-gold-600/40 px-3 py-0.5 text-[10px] font-medium uppercase tracking-widest text-gold-400">
                  {order.status}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-gold-600/10 pt-3 text-xs">
                <span className="text-ivory-dim">{order.items} item{order.items > 1 ? 's' : ''}</span>
                <span className="font-serif text-base text-gold-400">{order.total}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
