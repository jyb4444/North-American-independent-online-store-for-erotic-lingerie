import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const db = createAdminClient();
  const { data } = await db.from('newsletter_subscribers' as never).update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() } as never)
    .eq('unsubscribe_token_hash', hash).select('id').maybeSingle();
  return NextResponse.redirect(new URL(data ? '/?newsletter=unsubscribed' : '/?newsletter=invalid', req.url));
}
