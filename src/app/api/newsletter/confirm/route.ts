import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { enqueueNotification } from '@/lib/notification-jobs';

function confirmationPage() {
  return new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Confirm subscription</title><body><main><h1>Confirm your subscription</h1><p>Confirm that you want to receive email updates.</p><form method="post"><button type="submit">Confirm subscription</button></form></main></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function GET() {
  // GET is deliberately read-only: security scanners commonly open email links.
  return confirmationPage();
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const unsubscribeToken = req.nextUrl.searchParams.get('unsubscribe') || '';
  if (!token || !unsubscribeToken) return NextResponse.redirect(new URL('/?newsletter=invalid', req.url), 303);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const db = createAdminClient();
  const { data, error } = await db.from('newsletter_subscribers' as never).update({
    status: 'active', confirmed_at: new Date().toISOString(), confirmation_token_hash: null,
  } as never).eq('confirmation_token_hash', hash).eq('unsubscribe_token_hash', crypto.createHash('sha256').update(unsubscribeToken).digest('hex')).eq('status', 'pending').select('email').maybeSingle() as { data: { email: string } | null; error: { message: string } | null };
  if (error || !data) return NextResponse.redirect(new URL('/?newsletter=invalid', req.url), 303);
  await enqueueNotification('newsletter_welcome', `newsletter-welcome:${data.email}`, { email: data.email, unsubscribeToken });
  return NextResponse.redirect(new URL('/?newsletter=confirmed', req.url), 303);
}
