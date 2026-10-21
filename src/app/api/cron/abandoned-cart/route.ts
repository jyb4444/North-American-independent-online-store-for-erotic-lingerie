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

  const { data: snapshots, error } = await supabase
    .from('cart_snapshots')
    .select('*')
    .eq('reminder_sent', false)
    .lt('updated_at', cutoff)
    .limit(50);

  if (error) {
    console.error('Abandoned cart cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (snapshots ?? []) as CartSnapshot[];
  let sent = 0;
  let failed = 0;

  for (const snapshot of rows) {
    const items = Array.isArray(snapshot.items) ? snapshot.items as CartItem[] : [];
    if (items.length === 0) continue;

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', snapshot.user_id)
      .maybeSingle() as { data: { first_name: string | null } | null };

    const firstName = profile?.first_name ?? '';

    try {
      await sendAbandonedCartEmail(snapshot.email, firstName, items);
      await supabase
        .from('cart_snapshots')
        .update({ reminder_sent: true })
        .eq('id', snapshot.id);
      sent++;
    } catch (err) {
      console.error(`Failed to send abandoned cart email to ${snapshot.email}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ processed: rows.length, sent, failed });
}
