import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');
  if (!productId) return NextResponse.json({ error: 'product_id required' }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reviews')
    .select('id,product_id,rating,body,nickname,verified_purchase,created_at')
    .eq('product_id', productId)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('Reviews fetch failed:', error.message);
    return NextResponse.json({ reviews: [] });
  }
  return NextResponse.json({ reviews: data ?? [] });
}

export async function POST(req: Request) {
  const { allowed } = rateLimit(`review:${getClientIp(req)}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  // Require authentication — get email from session, not from request body
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Sign in to write a review.' }, { status: 401 });
  }

  let body: {
    product_id?: string;
    product_handle?: string;
    rating?: number;
    body_text?: string;
    nickname?: string;
    photo_urls?: string[];
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { product_id, product_handle, rating, body_text, nickname, photo_urls } = body;

  if (!product_id || !product_handle || !rating || !body_text?.trim() || !nickname?.trim()) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return NextResponse.json({ error: 'Rating must be 1–5.' }, { status: 400 });
  }
  if (body_text.length < 10) {
    return NextResponse.json({ error: 'Review must be at least 10 characters.' }, { status: 400 });
  }

  const review = {
    product_id,
    product_handle,
    rating,
    body: body_text.trim(),
    nickname: nickname.trim(),
    email: user.email.toLowerCase(),
    photo_urls: Array.isArray(photo_urls) ? photo_urls.slice(0, 3) : [],
  };

  const { error } = await supabase.from('reviews').insert(review);

  if (error?.message.includes('photo_urls')) {
    const reviewWithoutPhotos = {
      product_id: review.product_id,
      product_handle: review.product_handle,
      rating: review.rating,
      body: review.body,
      nickname: review.nickname,
      email: review.email,
    };
    const retry = await supabase.from('reviews').insert(reviewWithoutPhotos);
    if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
