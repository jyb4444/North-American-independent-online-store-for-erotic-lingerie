import { rateLimit, getClientIp } from '@/lib/rate-limit';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { referralRewardSettings, missingRewardSchema, referralRewardsEnabled } from '@/lib/referral-rewards';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateReferralCode(userId: string): string {
  const base = userId.replace(/-/g, '').slice(0, 6).toUpperCase();
  const suffix = Array.from(crypto.randomBytes(4), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
  return `SL-${base}-${suffix}`;
}

// GET: fetch or create referral code for current user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Users can read their own referral but not write it (RLS); creation uses the service role
  // so `uses` / `rewards_earned` always start at their defaults.
  const admin = createAdminClient();
  const readOwn = () => admin
    .from('referrals')
    .select('code, uses, rewards_earned')
    .eq('referrer_id', user.id)
    .maybeSingle();

  const withRewards = async (referral: { code: string; uses: number; rewards_earned: number }) => {
    const { data: rewards, error: rewardsError } = await admin
      .from('referral_rewards')
      .select('code, amount, minimum_subtotal, kind, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (rewardsError && !missingRewardSchema(rewardsError)) return NextResponse.json({ error: 'Reward lookup unavailable' }, { status: 503 });
    return NextResponse.json({ ...referral, rewards: rewards ?? [], settings: referralRewardSettings(), rewardsEnabled: referralRewardsEnabled() });
  };

  const { data: existing } = await readOwn();
  if (existing) return withRewards(existing);

  const { data, error } = await admin
    .from('referrals')
    .upsert({ referrer_id: user.id, code: generateReferralCode(user.id) }, { onConflict: 'referrer_id', ignoreDuplicates: true })
    .select('code, uses, rewards_earned')
    .maybeSingle();

  if (error) {
    // A concurrent request may have created it first (referrer_id is unique).
    const { data: raced } = await readOwn();
    if (raced) return withRewards(raced);
    return NextResponse.json({ error: 'Referral code creation temporarily unavailable; schema verification required' }, { status: 503 });
  }
  if (!data) { const { data: raced } = await readOwn(); if (raced) return withRewards(raced); return NextResponse.json({ error: 'Referral lookup unavailable' }, { status: 503 }); }
  return withRewards(data);
}

// Cached legacy signup pages may still POST to validate a code. Validation never credits it.
export async function POST(req: Request) {
  const { allowed } = await rateLimit(`referral-validation:${getClientIp(req)}`, { limit: 10, windowMs: 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  let code: unknown;
  try { code = (await req.json()).code; } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  if (typeof code !== 'string' || !/^[A-Z0-9-]{1,64}$/i.test(code.trim())) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  const { data, error } = await createAdminClient().from('referrals').select('id').eq('code', code.trim().toUpperCase()).maybeSingle();
  if (error) return NextResponse.json({ error: 'Validation unavailable' }, { status: 503 });
  if (!data) return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
  return NextResponse.json({ ok: true, applied: false });
}
