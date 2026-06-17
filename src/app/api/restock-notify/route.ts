import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const { allowed } = rateLimit(`restock:${getClientIp(req)}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  let body: { email?: string; product_id?: string; product_handle?: string; size?: string; color?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { email, product_id, product_handle, size, color } = body;
  if (!email?.trim() || !product_id || !product_handle || !size || !color) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  // Use admin client — caller may be unauthenticated; RLS has no user-column to match on restock_alerts
  const supabase = createAdminClient();

  // Avoid duplicate alerts for the same email + product + size + color
  const { data: existing } = await supabase
    .from('restock_alerts')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .eq('product_id', product_id)
    .eq('size', size)
    .eq('color', color)
    .eq('notified', false)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const { error } = await supabase.from('restock_alerts').insert({
    email: email.trim().toLowerCase(),
    product_id,
    product_handle,
    size,
    color,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
