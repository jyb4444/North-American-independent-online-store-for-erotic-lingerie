import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { sendContactNotification, sendContactConfirmation } from '@/lib/email';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const { allowed } = await rateLimit(`contact:${getClientIp(req)}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body: { name?: unknown; email?: unknown; subject?: unknown; message?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const subject = (typeof body.subject === 'string' ? body.subject.trim() : '') || 'General';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  if (name.length > 100 || subject.length > 150) {
    return NextResponse.json({ error: 'Name or subject is too long.' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message must be under 2000 characters.' }, { status: 400 });
  }

  try {
    await sendContactNotification(name, email, subject, message);
  } catch (error) {
    console.error('Contact email failed:', error);
    return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 });
  }

  // The confirmation goes to an address anyone can type in; cap it per recipient so the
  // form cannot be used to flood a third party's inbox.
  const { allowed: confirmationAllowed } = await rateLimit(`contact-confirmation:${email.toLowerCase()}`, {
    limit: 1,
    windowMs: 24 * 60 * 60_000,
  });
  if (confirmationAllowed) {
    await sendContactConfirmation(email).catch((error) => console.error('Contact confirmation failed:', error));
  }

  return NextResponse.json({ ok: true });
}
