import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const TIER_THRESHOLDS = { bronze: 0, silver: 200, gold: 500 } as const;

export async function GET(req: Request) {
  const { allowed } = rateLimit(getClientIp(req), { limit: 30, windowMs: 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership, error } = await (supabase as any)
    .from('memberships').select('*').eq('user_id', user.id).single();

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...membership, thresholds: TIER_THRESHOLDS });
}

export async function POST(req: Request) {
  const { allowed } = rateLimit(getClientIp(req), { limit: 10, windowMs: 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { points, total_spent } = await req.json();
  const spent = total_spent ?? 0;
  const tier =
    spent >= TIER_THRESHOLDS.gold ? 'gold' :
    spent >= TIER_THRESHOLDS.silver ? 'silver' : 'bronze';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('memberships')
    .update({ points, total_spent: spent, tier, updated_at: new Date().toISOString() })
    .eq('user_id', user.id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
