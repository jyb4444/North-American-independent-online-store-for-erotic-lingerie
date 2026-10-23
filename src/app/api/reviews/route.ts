import { pendingReviewFields, validReviewBody, publicReviewRow } from '@/lib/review-moderation';
import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { REVIEW_MEDIA_BUCKET, reviewMediaPathForUser, signReviewMedia } from '@/lib/review-media';

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

type ReviewCursor = { createdAt: string; id: string };

function decodeCursor(value: string | null): ReviewCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<ReviewCursor>;
    if (typeof parsed.createdAt !== 'string' || !Number.isFinite(Date.parse(parsed.createdAt)) || typeof parsed.id !== 'string') return null;
    return { createdAt: new Date(parsed.createdAt).toISOString(), id: parsed.id };
  } catch {
    return null;
  }
}

function encodeCursor(row: Record<string, unknown> | undefined): string | null {
  if (!row || typeof row.created_at !== 'string' || typeof row.id !== 'string') return null;
  return Buffer.from(JSON.stringify({ createdAt: row.created_at, id: row.id }), 'utf8').toString('base64url');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('product_id');
  if (!productId) return NextResponse.json({ error: 'product_id required' }, { status: 400 });
  const requestedBefore = searchParams.get('before');
  const cursor = decodeCursor(requestedBefore);
  if (requestedBefore && !cursor) return NextResponse.json({ error: 'Invalid review cursor.' }, { status: 400 });
  const pageSize = 20;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const reader = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase;
  const selectWithUser = 'id,product_id,user_id,rating,body,nickname,verified_purchase,approved,photo_urls,video_urls,is_anonymous,created_at';
  const selectWithoutUser = 'id,product_id,rating,body,nickname,verified_purchase,approved,photo_urls,video_urls,is_anonymous,created_at';
  const selectBase = 'id,product_id,rating,body,nickname,verified_purchase,approved,photo_urls,created_at';

  const presentReviews = async (rows: Record<string, unknown>[]) => Promise.all(rows.map(async (row) => ({
    ...publicReviewRow(row),
    photo_urls: await signReviewMedia(reader.storage, row.photo_urls),
    video_urls: await signReviewMedia(reader.storage, row.video_urls),
  })));
  const responseFor = async (rows: Record<string, unknown>[]) => {
    const page = rows.slice(0, pageSize);
    return NextResponse.json({
      reviews: await presentReviews(page),
      nextCursor: rows.length > pageSize ? encodeCursor(page.at(-1)) : null,
    });
  };

  const approvedBaseQuery = () => {
    let base = reader
    .from('reviews')
    .select(selectBase)
    .eq('product_id', productId)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);
    if (cursor) base = base.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    return base;
  };

  let query = reader
    .from('reviews')
    .select(selectWithUser)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);
  if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);

  const { data, error } = user
    ? await query.or(`approved.eq.true,user_id.eq.${user.id}`)
    : await query.eq('approved', true);

  if (error?.message.includes('user_id')) {
    let fallbackQuery = reader
      .from('reviews')
      .select(selectWithoutUser)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1);
    if (cursor) fallbackQuery = fallbackQuery.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
    const fallback = user?.email
      ? await fallbackQuery.or(`approved.eq.true,email.eq.${user.email.toLowerCase()}`)
      : await fallbackQuery.eq('approved', true);
    if (!fallback.error) {
      return responseFor((fallback.data ?? []) as Record<string, unknown>[]);
    }
  }

  if (error) {
    if (error.message.includes('photo_urls') || error.message.includes('video_urls') || error.message.includes('is_anonymous')) {
      const fallback = await approvedBaseQuery();
      if (!fallback.error) return responseFor((fallback.data ?? []) as Record<string, unknown>[]);
    }
    console.warn('Reviews fetch failed:', error.message);
    return NextResponse.json({ reviews: [] });
  }
  return responseFor((data ?? []) as Record<string, unknown>[]);
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
  if ([...(photo_urls ?? []), ...(video_urls ?? [])].some((value) => typeof value !== 'string' || !reviewMediaPathForUser(value, user.id))) {
    return NextResponse.json({ error: 'Invalid review media path.' }, { status: 400 });
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
  // This value is derived from synchronized, paid orders owned by the session user.
  // Missing compatibility schema fails closed and never trusts the request body.
  const normalizedProductId = product_id.replace(/^gid:\/\/shopify\/Product\//, '');
  const purchase = await supabase.rpc('user_has_paid_product' as never, { p_product_id: normalizedProductId } as never);
  if (!purchase.error && purchase.data === true) review.verified_purchase = true;
  const writer = createAdminClient();
  const buildSubmittedReview = async (inserted?: { id?: string; created_at?: string }) => ({
    id: inserted?.id ?? `pending-${crypto.randomUUID()}`,
    product_id: review.product_id,
    rating: review.rating,
    body: review.body,
    nickname: review.nickname,
    verified_purchase: review.verified_purchase,
    photo_urls: await signReviewMedia(writer.storage, review.photo_urls),
    video_urls: await signReviewMedia(writer.storage, review.video_urls),
    is_anonymous: review.is_anonymous,
    created_at: inserted?.created_at ?? new Date().toISOString(),
    pending: true,
  });

  // Users cannot insert reviews directly (RLS); the validated row is written with the
  // service role so `approved` / `verified_purchase` keep their database defaults.
  const uploadedPaths = [...review.photo_urls, ...review.video_urls];
  if (uploadedPaths.length > 0) {
    const { data: validations, error: validationError } = await writer
      .from('review_media_validations' as never)
      .select('path')
      .eq('user_id', user.id)
      .is('claimed_at', null)
      .in('path', uploadedPaths) as { data: { path: string }[] | null; error: { message: string } | null };
    const validatedPaths = new Set((validations ?? []).map((item) => item.path));
    if (validationError || uploadedPaths.some((path) => !validatedPaths.has(path))) {
      return NextResponse.json({ error: 'Every media file must finish verification before review submission.' }, { status: 400 });
    }
  }
  const claimUploadedMedia = async () => {
    if (uploadedPaths.length > 0) {
      await writer.from('review_media_validations' as never).update({ claimed_at: new Date().toISOString() } as never).eq('user_id', user.id).in('path', uploadedPaths);
    }
  };
  const removeUploadedMedia = async () => {
    if (uploadedPaths.length > 0) await writer.storage.from(REVIEW_MEDIA_BUCKET).remove(uploadedPaths);
  };
  const { data: insertedReview, error } = await writer
    .from('reviews')
    .insert(review)
    .select('id,created_at')
    .single();

  if (error?.message.includes('photo_urls')) {
    await removeUploadedMedia();
    return NextResponse.json(
      { error: 'Review photo storage is not ready. Please run the review_photo_urls migration.' },
      { status: 500 },
    );
  }

  if (error?.message.includes('user_id') || error?.message.includes('video_urls') || error?.message.includes('is_anonymous')) {
    const reviewWithoutNewColumns = {
      ...pendingReviewFields(),
      verified_purchase: review.verified_purchase,
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
    if (!retry.error) {
      await claimUploadedMedia();
      return NextResponse.json({ ok: true, review: await buildSubmittedReview(retry.data) });
    }

    if (!retry.error?.message.includes('photo_urls')) {
      await removeUploadedMedia();
      return NextResponse.json({ error: retry.error?.message ?? 'Failed to submit review' }, { status: 500 });
    }
  }

  if (error) {
    await removeUploadedMedia();
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await claimUploadedMedia();
  return NextResponse.json({ ok: true, review: await buildSubmittedReview(insertedReview) });
}
