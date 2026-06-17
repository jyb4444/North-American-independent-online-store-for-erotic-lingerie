import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { rateLimit } from '@/lib/rate-limit';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? 'Velour <onboarding@resend.dev>';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 16 }, (_, i) => {
    const ch = chars[Math.floor(Math.random() * chars.length)];
    return i > 0 && i % 4 === 0 ? `-${ch}` : ch;
  }).join('');
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = rateLimit(`gift-card:${ip}`, { limit: 3, windowMs: 3_600_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { amount, recipient_email, recipient_name, message, sender_name } =
      await req.json() as {
        amount?: number;
        recipient_email?: string;
        recipient_name?: string;
        message?: string;
        sender_name?: string;
      };

    if (!amount || amount < 10 || amount > 500) {
      return NextResponse.json({ error: 'Amount must be between $10 and $500' }, { status: 400 });
    }
    if (!recipient_email || !recipient_email.includes('@')) {
      return NextResponse.json({ error: 'Invalid recipient email' }, { status: 400 });
    }

    const supabase = await createClient();
    const code = generateCode();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { error } = await supabase.from('gift_cards').insert({
      code,
      amount,
      balance: amount,
      recipient_email,
      recipient_name: recipient_name ?? '',
      message: message ?? '',
      sender_name: sender_name ?? 'A friend',
      expires_at: expiresAt.toISOString(),
      is_redeemed: false,
    });

    if (error) throw new Error(error.message);

    // Email the gift card to recipient
    await resend.emails.send({
      from: FROM,
      to: recipient_email,
      subject: `You've received a Velour gift card — ${sender_name ?? 'A friend'} sent you a gift`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #110a0d; color: #e8ddd0;">
          <p style="font-size: 22px; font-weight: 300; color: #c9a84c; font-style: italic; margin-bottom: 24px;">Velour</p>
          <h1 style="font-size: 20px; font-weight: 300; margin-bottom: 8px;">A gift for you, ${recipient_name ?? 'you'}</h1>
          <p style="font-size: 13px; color: #b0a090; margin-bottom: 20px;">
            ${sender_name ?? 'Someone special'} sent you a Velour gift card worth
            <strong style="color: #c9a84c;">$${amount.toFixed(2)}</strong>.
          </p>
          ${message ? `<blockquote style="border-left: 2px solid #c9a84c; padding-left: 16px; margin: 20px 0; font-style: italic; color: #b0a090; font-size: 13px;">"${message}"</blockquote>` : ''}
          <div style="background: #1a0d10; border: 1px solid #4a3020; padding: 20px; text-align: center; margin: 24px 0;">
            <p style="font-size: 11px; color: #6b5e50; margin-bottom: 8px; letter-spacing: 0.2em; text-transform: uppercase;">Your Gift Card Code</p>
            <p style="font-size: 22px; font-weight: 300; color: #c9a84c; letter-spacing: 0.15em;">${code}</p>
            <p style="font-size: 11px; color: #6b5e50; margin-top: 8px;">Balance: $${amount.toFixed(2)} · Expires: ${expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</p>
          </div>
          <p style="font-size: 12px; color: #b0a090;">Enter this code at checkout on velour.com to redeem your gift.</p>
          <p style="font-size: 11px; color: #4a3020; margin-top: 24px;">Sent discreetly. The gift card is valid for one year from issue date.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true, code });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create gift card' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('gift_cards')
    .select('code, balance, amount, expires_at, is_redeemed')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !data) return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });

  const expired = new Date(data.expires_at) < new Date();
  if (expired) return NextResponse.json({ error: 'Gift card has expired' }, { status: 400 });
  if (data.is_redeemed && data.balance <= 0) {
    return NextResponse.json({ error: 'Gift card has been fully redeemed' }, { status: 400 });
  }

  return NextResponse.json({ balance: data.balance, amount: data.amount });
}
