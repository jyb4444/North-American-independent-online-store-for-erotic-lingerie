import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin-access';
import { createAdminClient } from '@/lib/supabase/server';
import RetryButton from '@/components/admin/RetryButton';
import DeletionRequestActions from '@/components/admin/DeletionRequestActions';

export default async function AdminOperationsPage() {
  if (!await currentAdmin()) redirect('/account');
  const db = createAdminClient();
  const [notifications, webhooks, returns, reviews, deletions] = await Promise.all([
    db.from('notification_jobs' as never)
      .select('id,kind,identity,attempts,last_error,created_at')
      .eq('status', 'manual_review')
      .not('kind', 'in', '(newsletter_confirmation,newsletter_welcome)')
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('shopify_webhook_inbox' as never).select('event_id,topic,shopify_order_id,attempts,last_error,created_at').eq('status', 'manual_review').order('created_at', { ascending: false }).limit(100),
    db.from('return_requests').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'needs_more_info']),
    db.from('reviews').select('id', { count: 'exact', head: true }).eq('approved', false),
    db.from('account_deletion_requests' as never).select('id,email,status,requested_at').in('status',['requested','processing']).order('requested_at',{ascending:true}).limit(100),
  ]);
  const notificationRows = (notifications.data ?? []) as unknown as Array<Record<string, unknown>>;
  const webhookRows = (webhooks.data ?? []) as unknown as Array<Record<string, unknown>>;
  const deletionRows = (deletions.data ?? []) as unknown as Array<Record<string, unknown>>;
  return <main className="mx-auto max-w-5xl px-4 py-16">
    <p className="text-xs uppercase tracking-[0.3em] text-gold-400">Admin</p>
    <h1 className="mt-2 font-serif text-3xl">Store Operations</h1>
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <Link href="/admin/returns" className="border border-gold-600/20 p-5">Return requests awaiting review: {returns.count ?? 0}</Link>
      <Link href="/admin/reviews" className="border border-gold-600/20 p-5">Reviews awaiting moderation: {reviews.count ?? 0}</Link>
    </div>
    <section className="mt-10"><h2 className="font-serif text-2xl">Failed notifications</h2>
      <div className="mt-4 space-y-3">{notificationRows.map((row) => <article key={String(row.id)} className="border border-crimson-400/30 p-4 text-sm"><p>{String(row.kind)} · attempts {String(row.attempts)}</p><p className="mt-1 break-words text-ivory-dim">{String(row.last_error ?? 'No error recorded')}</p><RetryButton endpoint={`/api/admin/operations/notifications/${encodeURIComponent(String(row.id))}/retry`} /></article>)}{!notificationRows.length && <p className="text-sm text-ivory-dim">No notifications require manual review.</p>}</div>
    </section>
    <section className="mt-10"><h2 className="font-serif text-2xl">Failed Shopify webhooks</h2>
      <div className="mt-4 space-y-3">{webhookRows.map((row) => <article key={String(row.event_id)} className="border border-crimson-400/30 p-4 text-sm"><p>{String(row.topic)} · order {String(row.shopify_order_id ?? 'unknown')} · attempts {String(row.attempts)}</p><p className="mt-1 break-words text-ivory-dim">{String(row.last_error ?? 'No error recorded')}</p><RetryButton endpoint={`/api/admin/operations/webhooks/${encodeURIComponent(String(row.event_id))}/retry`} /></article>)}{!webhookRows.length && <p className="text-sm text-ivory-dim">No webhooks require manual review.</p>}</div>
    </section>
    <section className="mt-10"><h2 className="font-serif text-2xl">Account deletion requests</h2>
      <div className="mt-4 space-y-3">{deletionRows.map((row)=><article key={String(row.id)} className="border border-gold-600/20 p-4 text-sm"><p>{String(row.email)} · {String(row.status)}</p><p className="text-ivory-dim">Requested {new Date(String(row.requested_at)).toLocaleString()}</p><DeletionRequestActions id={String(row.id)} status={String(row.status)} /></article>)}{!deletionRows.length&&<p className="text-sm text-ivory-dim">No active deletion requests.</p>}</div>
    </section>
  </main>;
}
