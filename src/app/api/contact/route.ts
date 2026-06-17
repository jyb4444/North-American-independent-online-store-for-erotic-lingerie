import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { sendContactNotification, sendContactConfirmation } from '@/lib/email';

export async function POST(req: Request) {
  const { allowed } = rateLimit(`contact:${getClientIp(req)}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body: { name?: string; email?: string; subject?: string; message?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { name, email, subject, message } = body;
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message must be under 2000 characters.' }, { status: 400 });
  }

  const [notifyResult] = await Promise.allSettled([
    sendContactNotification(name.trim(), email.trim(), subject?.trim() ?? 'General', message.trim()),
    sendContactConfirmation(email.trim(), name.trim()),
  ]);

  if (notifyResult.status === 'rejected') {
    console.error('Contact email failed:', notifyResult.reason);
    return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
