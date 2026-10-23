import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { REVIEW_MEDIA_BUCKET, reviewMediaBytesMatch, reviewMediaPathForUser } from '@/lib/review-media';

const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const VIDEO_TYPES = new Map([
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
  ['video/quicktime', 'mov'],
]);

export async function POST(req: Request) {
  const { allowed } = await rateLimit(`review-media:${getClientIp(req)}`, { limit: 12, windowMs: 60 * 60_000 });
  if (!allowed) return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to upload review media.' }, { status: 401 });

  let body: { action?: unknown; kind?: unknown; contentType?: unknown; size?: unknown; path?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 });
  }

  const { action, kind, contentType, size, path: requestedPath } = body;
  if ((kind !== 'photo' && kind !== 'video') || typeof contentType !== 'string') {
    return NextResponse.json({ error: 'Valid upload metadata is required.' }, { status: 400 });
  }

  const types = kind === 'photo' ? IMAGE_TYPES : VIDEO_TYPES;
  const extension = types.get(contentType);
  const maxBytes = kind === 'photo' ? 8 * 1024 * 1024 : 40 * 1024 * 1024;
  if (!extension) return NextResponse.json({ error: `Unsupported ${kind} format.` }, { status: 400 });
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0 || size > maxBytes) {
    return NextResponse.json({ error: `${kind === 'photo' ? 'Photo' : 'Video'} is too large.` }, { status: 400 });
  }

  const admin = createAdminClient();
  if (action === 'prepare') {
    const path = `reviews/${user.id}/${kind}s/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await admin.storage.from(REVIEW_MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: false });
    if (error || !data?.token) {
      console.error('Review media signed upload failed:', error?.message);
      return NextResponse.json({ error: 'Could not prepare this upload. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ path, token: data.token }, { status: 201 });
  }

  if (action !== 'complete' || typeof requestedPath !== 'string' || !reviewMediaPathForUser(requestedPath, user.id)) {
    return NextResponse.json({ error: 'Invalid upload completion.' }, { status: 400 });
  }

  const { data: stored, error: downloadError } = await admin.storage.from(REVIEW_MEDIA_BUCKET).download(requestedPath);
  if (downloadError || !stored) {
    return NextResponse.json({ error: 'The uploaded file could not be verified.' }, { status: 400 });
  }
  const bytes = new Uint8Array(await stored.arrayBuffer());
  if (stored.size !== size || stored.size > maxBytes || !reviewMediaBytesMatch(contentType, bytes)) {
    await admin.storage.from(REVIEW_MEDIA_BUCKET).remove([requestedPath]);
    return NextResponse.json({ error: `The uploaded ${kind} failed validation.` }, { status: 400 });
  }

  const { error: validationError } = await admin.from('review_media_validations' as never).upsert({
    path: requestedPath,
    user_id: user.id,
    content_type: contentType,
    byte_size: stored.size,
    validated_at: new Date().toISOString(),
    claimed_at: null,
  } as never, { onConflict: 'path' });
  if (validationError) {
    await admin.storage.from(REVIEW_MEDIA_BUCKET).remove([requestedPath]);
    return NextResponse.json({ error: 'The uploaded file could not be recorded as verified.' }, { status: 500 });
  }

  return NextResponse.json({ path: requestedPath }, { status: 200 });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to remove review media.' }, { status: 401 });

  let paths: unknown;
  try {
    paths = (await req.json() as { paths?: unknown }).paths;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!Array.isArray(paths) || paths.length > 4 || paths.some((path) => typeof path !== 'string' || !reviewMediaPathForUser(path, user.id))) {
    return NextResponse.json({ error: 'Invalid review media path.' }, { status: 400 });
  }
  if (paths.length > 0) {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(REVIEW_MEDIA_BUCKET).remove(paths as string[]);
    if (error) return NextResponse.json({ error: 'Could not remove review media.' }, { status: 500 });
    await admin.from('review_media_validations' as never).delete().eq('user_id', user.id).in('path', paths as string[]);
  }
  return NextResponse.json({ ok: true });
}
