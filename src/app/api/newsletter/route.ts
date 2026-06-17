import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? 'Velour <onboarding@resend.dev>';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string };
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // Send a welcome email to the subscriber
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Welcome to Velour — Your Private Access',
      html: `
        <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #110a0d; color: #e8ddd0;">
          <p style="font-size: 22px; font-weight: 300; color: #c9a84c; font-style: italic; margin-bottom: 24px;">Velour</p>
          <h1 style="font-size: 20px; font-weight: 300; color: #e8ddd0; margin-bottom: 16px;">Welcome to Velour</h1>
          <p style="font-size: 13px; line-height: 1.8; color: #b0a090; margin-bottom: 20px;">
            You now have private early access to new arrivals, member-only offers, and exclusive styling guides —
            all sent discreetly to this address.
          </p>
          <p style="font-size: 11px; color: #6b5e50;">
            Sent from a discreet sender. To unsubscribe, reply with "unsubscribe".
          </p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
