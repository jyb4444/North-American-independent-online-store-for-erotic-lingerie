import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWelcomeEmail, sendWishlistReminderEmail } from '@/lib/email';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

type WelcomePayload = { type: 'welcome' };
type WishlistReminderPayload = {
  type: 'wishlist_reminder';
  productTitle: string;
  productImage: string;
  productHandle: string;
};

type Payload = WelcomePayload | WishlistReminderPayload;

export async function POST(req: Request) {
  const { allowed } = rateLimit(`email-api:${getClientIp(req)}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload: Payload;
  try {
    payload = await req.json() as Payload;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const firstName = (user.user_metadata?.first_name as string | undefined) ?? '';

  try {
    if (payload.type === 'welcome') {
      await sendWelcomeEmail(user.email, firstName);
    } else if (payload.type === 'wishlist_reminder') {
      await sendWishlistReminderEmail(
        user.email,
        firstName,
        payload.productTitle,
        payload.productImage,
        payload.productHandle,
      );
    } else {
      return NextResponse.json({ error: 'Unknown email type' }, { status: 400 });
    }
  } catch (err) {
    console.error('Email send failed:', err);
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
