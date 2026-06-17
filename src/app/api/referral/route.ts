import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

function generateReferralCode(userId: string): string {
  // Short deterministic code: first 6 chars of userId + 4 random chars
  const base = userId.replace(/-/g, '').slice(0, 6).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VLR-${base}-${suffix}`;
}

// GET: fetch or create referral code for current user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if code already exists
  const { data: existing } = await supabase
    .from('referrals')
    .select('code, uses, rewards_earned')
    .eq('referrer_id', user.id)
    .single();

  if (existing) {
    return NextResponse.json(existing);
  }

  // Create a new referral code
  const code = generateReferralCode(user.id);
  const { data, error } = await supabase
    .from('referrals')
    .insert({ referrer_id: user.id, code, uses: 0, rewards_earned: 0 })
    .select('code, uses, rewards_earned')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: validate and apply a referral code (called during signup — user not yet authenticated)
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json() as { code?: string };
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

    // Must use admin client — the signup caller is not yet authenticated, so RLS would block a regular client
    const admin = createAdminClient();
    const { data: referral } = await admin
      .from('referrals')
      .select('referrer_id, code, uses')
      .eq('code', code.toUpperCase())
      .single();

    if (!referral) return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });

    // Increment uses
    await admin
      .from('referrals')
      .update({ uses: (referral.uses ?? 0) + 1 })
      .eq('code', referral.code);

    return NextResponse.json({ ok: true, referrerCredit: 10, newUserCredit: 10 });
  } catch {
    return NextResponse.json({ error: 'Failed to apply code' }, { status: 500 });
  }
}
