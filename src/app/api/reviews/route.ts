import { pendingReviewFields, validReviewBody, publicReviewRow } from '@/lib/review-moderation';
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 3)}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 3)}***${digits.slice(-4)}`;
}

function getMetadataPhone(metadata: Record<string, unknown> | null | undefined): string {
  const value = metadata?.phone ?? metadata?.phone_number;
  return typeof value === 'string' ? value : '';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');
  if (!productId) return NextResponse.json({ error: 'product_id required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const reader = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;
  const selectWithUser = 'id,product_id,user_id,rating,body,nickname,verified_purchase,approved,photo_urls,video_urls,is_anonymous,created_at';
  const selectWithoutUser = 'id,product_id,rating,body,nickname,verified_purchase,approved,photo_urls,video_urls,is_anonymous,created_at';
  const selectBase = 'id,product_id,rating,body,nickname,verified_purchase,approved,photo_urls,created_at';

  const approvedBaseQuery = () => reader
    .from('reviews')
    .select(selectBase)
    .eq('product_id', productId)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(50);

  const query = reader
    .from('reviews')
    .select(selectWithUser)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data, error } = user
    ? await query.or(`approved.eq.true,user_id.eq.${user.id}`)
    : await query.eq('approved', true);

  if (error?.message.includes('user_id')) {
    const fallbackQuery = reader
      .from('reviews')
      .select(selectWithoutUser)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50);
    const fallback = user?.email
      ? await fallbackQuery.or(`approved.eq.true,email.eq.${user.email.toLowerCase()}`)
      : await fallbackQuery.eq('approved', true);
    if (!fallback.error) {
      return NextResponse.json({
        reviews: (fallback.data ?? []).map(publicReviewRow),
      });
    }
  }

  if (error) {
    if (error.message.includes('photo_urls') || error.message.includes('video_urls') || error.message.includes('is_anonymous')) {
      const fallback = await approvedBaseQuery();
      if (!fallback.error) return NextResponse.json({ reviews: fallback.data ?? [] });
    }
    console.warn('Reviews fetch failed:', error.message);
    return NextResponse.json({ reviews: [] });
  }
  return NextResponse.json({
    reviews: (data ?? []).map(publicReviewRow),
  });
}

export async function POST(req: Request) {
  const { allowed } = await rateLimit(`review:${getClientIp(req)}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  // Require authentication — contact identity comes from session, not from request body
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to write a review.' }, { status: 401 });
  }

  let body: {
    product_id?: string;
    product_handle?: string;
    rating?: number;
    body_text?: string;
    photo_urls?: string[];
    video_urls?: string[];
    is_anonymous?: boolean;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { product_id, product_handle, rating, body_text, photo_urls, video_urls, is_anonymous } = body;

  if (!product_id || !product_handle || !rating || !body_text?.trim()) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return NextResponse.json({ error: 'Rating must be 1–5.' }, { status: 400 });
  }
  if (!validReviewBody(body_text)) {
    return NextResponse.json({ error: 'Review must be at least 10 characters.' }, { status: 400 });
  }
  if (body_text.length > 300) {
    return NextResponse.json({ error: 'Review must be under 300 characters.' }, { status: 400 });
  }
  if (Array.isArray(photo_urls) && photo_urls.length > 3) {
    return NextResponse.json({ error: 'Upload up to 3 photos.' }, { status: 400 });
  }
  if (Array.isArray(video_urls) && video_urls.length > 1) {
    return NextResponse.json({ error: 'Upload up to 1 video.' }, { status: 400 });
  }

  const phone = user.phone ?? getMetadataPhone(user.user_metadata);
  const privateContact = (user.email || phone || user.id).toLowerCase();
  const publicNickname = is_anonymous
    ? 'Anonymous shopper'
    : phone
      ? maskPhone(phone)
      : user.email
        ? maskEmail(user.email)
        : 'Verified shopper';

  const review = {
    user_id: user.id,
    ...pendingReviewFields(),
    product_id,
    product_handle,
    rating,
    body: body_text.trim(),
    nickname: publicNickname,
    email: privateContact,
    photo_urls: Array.isArray(photo_urls) ? photo_urls.slice(0, 3) : [],
    video_urls: Array.isArray(video_urls) ? video_urls.slice(0, 1) : [],
    is_anonymous: !!is_anonymous,
  };
  const buildSubmittedReview = (inserted?: { id?: string; created_at?: string }) => ({
    id: inserted?.id ?? `pending-${crypto.randomUUID()}`,
    product_id: review.product_id,
    rating: review.rating,
    body: review.body,
    nickname: review.nickname,
    verified_purchase: false,
    photo_urls: review.photo_urls,
    video_urls: review.video_urls,
    is_anonymous: review.is_anonymous,
    created_at: inserted?.created_at ?? new Date().toISOString(),
    pending: true,
  });

  // Users cannot insert reviews directly (RLS); the validated row is written with the
  // service role so `approved` / `verified_purchase` keep their database defaults.
  const writer = createAdminClient();
  const { data: insertedReview, error } = await writer
    .from('reviews')
    .insert(review)
    .select('id,created_at')
    .single();

  if (error?.message.includes('photo_urls')) {
    return NextResponse.json(
      { error: 'Review photo storage is not ready. Please run the review_photo_urls migration.' },
      { status: 500 },
    );
  }

  if (error?.message.includes('user_id') || error?.message.includes('video_urls') || error?.message.includes('is_anonymous')) {
    const reviewWithoutNewColumns = {
      ...pendingReviewFields(),
      product_id: review.product_id,
      product_handle: review.product_handle,
      rating: review.rating,
      body: review.body,
      nickname: review.nickname,
      email: review.email,
      photo_urls: review.photo_urls,
    };
    const retry = await writer
      .from('reviews')
      .insert(reviewWithoutNewColumns)
      .select('id,created_at')
      .single();
    if (!retry.error) return NextResponse.json({ ok: true, review: buildSubmittedReview(retry.data) });

    if (!retry.error?.message.includes('photo_urls')) {
      return NextResponse.json({ error: retry.error?.message ?? 'Failed to submit review' }, { status: 500 });
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, review: buildSubmittedReview(insertedReview) });
}
