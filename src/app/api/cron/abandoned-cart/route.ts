import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendAbandonedCartEmail } from '@/lib/email';
import type { CartItem } from '@/types';

export const runtime = 'nodejs';

type CartSnapshot = {
  id: string;
  user_id: string;
  email: string;
  items: CartItem[];
  reminder_sent: boolean;
  updated_at: string;
  reminder_attempts?: number;
};

function isAuthorizedCronRequest(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; `x-cron-secret` is kept for manual runs.
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const provided = bearer || req.headers.get('x-cron-secret') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let { data: snapshots, error } = await supabase
    .from('cart_snapshots')
    .select('*')
    .eq('reminder_sent', false)
    .lt('reminder_attempts', 5)
    .lt('updated_at', cutoff)
    .limit(50);

  if (error && ['42703', 'PGRST204'].includes(error.code ?? '')) {
    const legacy = await supabase.from('cart_snapshots').select('*').eq('reminder_sent', false).lt('updated_at', cutoff).limit(50);
    snapshots = legacy.data;
    error = legacy.error;
  }

  if (error) {
    console.error('Abandoned cart cron error:', error);
    return NextResponse.json({ error: 'Abandoned-cart processing is temporarily unavailable.' }, { status: 503 });
  }

  const rows = (snapshots ?? []) as CartSnapshot[];
  let sent = 0;
  let failed = 0;

  for (const snapshot of rows) {
    const items = Array.isArray(snapshot.items) ? snapshot.items as CartItem[] : [];
    if (items.length === 0) {
      await supabase.from('cart_snapshots').update({ reminder_sent: true }).eq('id', snapshot.id);
      continue;
    }

    const { data: completedOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', snapshot.user_id)
      .eq('financial_status', 'paid')
      .gte('created_at', snapshot.updated_at)
      .limit(1)
      .maybeSingle();
    if (completedOrder) {
      await supabase.from('cart_snapshots').update({ reminder_sent: true }).eq('id', snapshot.id);
      continue;
    }

    // A checkout email is transactional data, not marketing consent. Only shoppers who
    // completed newsletter double opt-in may receive an abandoned-cart message.
    const { data: subscriber } = await supabase.from('newsletter_subscribers' as never)
      .select('status').eq('email', snapshot.email.trim().toLowerCase()).maybeSingle() as { data: { status: string } | null };
    if (subscriber?.status !== 'active') {
      await supabase.from('cart_snapshots').update({ reminder_sent: true }).eq('id', snapshot.id);
      continue;
    }
    const { data: consentJob } = await supabase.from('notification_jobs' as never)
      .select('payload').eq('kind','newsletter_confirmation').like('identity',`newsletter-confirm:${snapshot.email.trim().toLowerCase()}:%`)
      .order('created_at',{ascending:false}).limit(1).maybeSingle() as { data: { payload: { unsubscribeToken?: string } } | null };
    const unsubscribeToken = consentJob?.payload?.unsubscribeToken;
    if (!unsubscribeToken) {
      await supabase.from('cart_snapshots').update({ reminder_sent: true }).eq('id', snapshot.id);
      continue;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', snapshot.user_id)
      .maybeSingle() as { data: { first_name: string | null } | null };

    const firstName = profile?.first_name ?? '';

    try {
      await sendAbandonedCartEmail(snapshot.email, firstName, items, unsubscribeToken);
      await supabase
        .from('cart_snapshots')
        .update({ reminder_sent: true })
        .eq('id', snapshot.id);
      sent++;
    } catch (err) {
      console.error(`Failed to send abandoned cart email to ${snapshot.email}:`, err);
      await supabase.from('cart_snapshots').update({
        reminder_attempts: (snapshot.reminder_attempts ?? 0) + 1,
        reminder_last_error: err instanceof Error ? err.message.slice(0, 500) : 'Delivery failed',
      }).eq('id', snapshot.id);
      failed++;
    }
  }

  return NextResponse.json({ processed: rows.length, sent, failed });
}
