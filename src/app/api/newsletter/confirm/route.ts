import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { enqueueNotification } from '@/lib/notification-jobs';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const unsubscribeToken = req.nextUrl.searchParams.get('unsubscribe') || '';
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const db = createAdminClient();
  const { data, error } = await db.from('newsletter_subscribers' as never).update({
    status: 'active', confirmed_at: new Date().toISOString(), confirmation_token_hash: null,
  } as never).eq('confirmation_token_hash', hash).eq('unsubscribe_token_hash', crypto.createHash('sha256').update(unsubscribeToken).digest('hex')).eq('status', 'pending').select('email').maybeSingle() as { data: { email: string } | null; error: { message: string } | null };
  if (error || !data) return NextResponse.redirect(new URL('/?newsletter=invalid', req.url));
  await enqueueNotification('newsletter_welcome', `newsletter-welcome:${data.email}`, { email: data.email, unsubscribeToken });
  return NextResponse.redirect(new URL('/?newsletter=confirmed', req.url));
}
