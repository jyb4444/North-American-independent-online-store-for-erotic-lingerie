import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/server';
import { enqueueNotification } from '@/lib/notification-jobs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export async function POST(req: NextRequest) {
  if (process.env.NEWSLETTER_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Newsletter signup is not currently available.' }, { status: 503 });
  }
  const { allowed } = await rateLimit(`newsletter:${getClientIp(req)}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });

  let email = '';
  try {
    const body = await req.json() as { email?: unknown };
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: existing } = await db.from('newsletter_subscribers' as never).select('status').eq('email', email).maybeSingle() as { data: { status: string } | null };
  if (existing?.status === 'active') return NextResponse.json({ ok: true, confirmationRequired: false });

  // Repeated form submissions must not create a stream of confirmation emails.
  // Keep the latest confirmation usable for 24 hours before issuing a fresh token.
  if (existing?.status === 'pending') {
    const { data: latestConfirmation } = await db
      .from('notification_jobs' as never)
      .select('created_at,status')
      .eq('kind', 'newsletter_confirmation')
      .like('identity', `newsletter-confirm:${email}:%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { created_at: string; status: string } | null };
    const isRecent = latestConfirmation
      && Date.now() - new Date(latestConfirmation.created_at).getTime() < 24 * 60 * 60_000;
    if (isRecent && ['pending', 'processing', 'sent'].includes(latestConfirmation.status)) {
      return NextResponse.json({ ok: true, confirmationRequired: true });
    }
  }
  const confirmationToken = crypto.randomBytes(32).toString('base64url');
  const unsubscribeToken = crypto.randomBytes(32).toString('base64url');
  const { error } = await db.from('newsletter_subscribers' as never).upsert({
    email, status: 'pending', confirmation_token_hash: digest(confirmationToken),
    unsubscribe_token_hash: digest(unsubscribeToken), unsubscribed_at: null,
  } as never, { onConflict: 'email' } as never);
  if (error) return NextResponse.json({ error: 'Subscription could not be saved.' }, { status: 500 });
  await enqueueNotification('newsletter_confirmation', `newsletter-confirm:${email}:${digest(confirmationToken)}`, { email, confirmationToken, unsubscribeToken });
  return NextResponse.json({ ok: true, confirmationRequired: true });
}
