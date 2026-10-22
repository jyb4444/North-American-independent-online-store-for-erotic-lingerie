import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { retryAt } from '@/lib/notification-jobs';
import { getProductByHandle } from '@/lib/products';
import { sendNewsletterConfirmationEmail, sendNewsletterWelcomeEmail, sendRestockAlertEmail, sendReturnRequestConfirmation, sendReturnRequestNotification } from '@/lib/email';

export const runtime = 'nodejs';
type Job = { id: string; kind: string; payload: Record<string, unknown>; attempts: number; lease_token: string };
const text = (value: unknown) => typeof value === 'string' ? value : '';

async function deliverJob(job: Job) {
  const p = job.payload;
  switch (job.kind) {
    case 'newsletter_confirmation': {
      const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3100';
      const url = new URL('/api/newsletter/confirm', base);
      url.searchParams.set('token', text(p.confirmationToken));
      url.searchParams.set('unsubscribe', text(p.unsubscribeToken));
      return sendNewsletterConfirmationEmail(text(p.email), url.toString());
    }
    case 'newsletter_welcome': return sendNewsletterWelcomeEmail(text(p.email), text(p.unsubscribeToken));
    case 'return_customer': return sendReturnRequestConfirmation({ to: text(p.to), requestNumber: text(p.requestNumber), orderNumber: text(p.orderNumber) });
    case 'return_merchant': return sendReturnRequestNotification({
      requestNumber: text(p.requestNumber), orderNumber: text(p.orderNumber), customerEmail: text(p.customerEmail),
      reason: text(p.reason), note: text(p.note) || null,
      items: Array.isArray(p.items) ? p.items as Array<{ title: string; quantity: number }> : [],
      photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls.filter((v): v is string => typeof v === 'string') : [],
    });
    case 'restock': return sendRestockAlertEmail(text(p.email), text(p.productTitle), text(p.size), text(p.color), text(p.productHandle));
    default: throw new Error('Unsupported notification kind');
  }
}

async function queueAvailableRestock() {
  if (process.env.RESTOCK_ALERTS_ENABLED !== 'true') return;
  const db = createAdminClient();
  const { data } = await db.from('restock_alerts').select('*').eq('notified', false).lte('next_attempt_at', new Date().toISOString()).limit(50);
  for (const alert of data ?? []) {
    try {
      const product = await getProductByHandle(alert.product_handle);
      const available = product?.variants.some((v) => v.size === alert.size && v.color === alert.color && v.stock > 0);
      if (!product || !available) continue;
      const { error } = await db.from('notification_jobs' as never).upsert({
        kind: 'restock', identity: `restock:${alert.id}`, payload: { alertId: alert.id, email: alert.email, productTitle: product.title, productHandle: product.handle, size: alert.size, color: alert.color },
      } as never, { onConflict: 'identity', ignoreDuplicates: true } as never);
      if (error) throw new Error(error.message);
    } catch (error) {
      await db.from('restock_alerts').update({ attempts: (alert.attempts ?? 0) + 1, next_attempt_at: retryAt((alert.attempts ?? 0) + 1), last_error: error instanceof Error ? error.message.slice(0, 500) : 'Availability check failed' }).eq('id', alert.id);
    }
  }
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await queueAvailableRestock();
  const db = createAdminClient();
  const { data, error } = await db.rpc('lease_notification_jobs' as never, { p_limit: 25 } as never) as { data: Job[] | null; error: { message: string } | null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let sent = 0; let failed = 0;
  for (const job of data ?? []) {
    try {
      const result = await deliverJob(job);
      await db.from('notification_jobs' as never).update({ status: 'sent', provider_message_id: result.id, sent_at: new Date().toISOString(), lease_token: null, lease_until: null, last_error: null } as never).eq('id', job.id).eq('lease_token', job.lease_token);
      const alertId = text(job.payload.alertId);
      if (alertId) await db.from('restock_alerts').update({ notified: true, last_error: null }).eq('id', alertId);
      sent++;
    } catch (error) {
      const exhausted = job.attempts >= 8;
      await db.from('notification_jobs' as never).update({ status: exhausted ? 'manual_review' : 'failed', next_attempt_at: retryAt(job.attempts), last_error: error instanceof Error ? error.message.slice(0, 500) : 'Delivery failed', lease_token: null, lease_until: null } as never).eq('id', job.id).eq('lease_token', job.lease_token);
      failed++;
    }
  }
  return NextResponse.json({ processed: data?.length ?? 0, sent, failed });
}
