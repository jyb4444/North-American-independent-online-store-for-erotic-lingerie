import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

function confirmationPage() {
  return new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribe</title><body><main><h1>Unsubscribe from email</h1><p>Confirm that you no longer want to receive these messages.</p><form method="post"><button type="submit">Unsubscribe</button></form></main></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function GET() {
  // GET is deliberately read-only: security scanners commonly open email links.
  return confirmationPage();
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!token) return NextResponse.redirect(new URL('/?newsletter=invalid', req.url), 303);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const db = createAdminClient();
  const { data } = await db.from('newsletter_subscribers' as never).update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() } as never)
    .eq('unsubscribe_token_hash', hash).select('id').maybeSingle();
  return NextResponse.redirect(new URL(data ? '/?newsletter=unsubscribed' : '/?newsletter=invalid', req.url), 303);
}
