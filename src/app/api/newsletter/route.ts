import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { sendNewsletterWelcomeEmail } from '@/lib/email';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const { allowed } = await rateLimit(`newsletter:${getClientIp(req)}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });

  let email = '';
  try {
    const body = await req.json() as { email?: unknown };
    email = typeof body.email === 'string' ? body.email.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  // One welcome email per address per day, so this endpoint cannot be used to spam a third party.
  const { allowed: sendAllowed } = await rateLimit(`newsletter-recipient:${email.toLowerCase()}`, {
    limit: 1,
    windowMs: 24 * 60 * 60_000,
  });
  if (!sendAllowed) return NextResponse.json({ ok: true });

  try {
    await sendNewsletterWelcomeEmail(email);
  } catch (error) {
    console.error('Newsletter email failed:', error);
    return NextResponse.json({ error: 'Failed to subscribe. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
