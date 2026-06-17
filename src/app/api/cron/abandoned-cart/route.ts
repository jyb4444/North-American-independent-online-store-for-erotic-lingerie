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

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized calls
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
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
      .maybeSingle();

    const firstName = (profile?.first_name as string | null | undefined) ?? '';

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
