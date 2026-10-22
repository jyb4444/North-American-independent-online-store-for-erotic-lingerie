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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 });
  }

  const file = formData.get('file');
  const kind = formData.get('kind');
  if (!(file instanceof File) || (kind !== 'photo' && kind !== 'video')) {
    return NextResponse.json({ error: 'A photo or video file is required.' }, { status: 400 });
  }

  const types = kind === 'photo' ? IMAGE_TYPES : VIDEO_TYPES;
  const extension = types.get(file.type);
  const maxBytes = kind === 'photo' ? 8 * 1024 * 1024 : 40 * 1024 * 1024;
  if (!extension) return NextResponse.json({ error: `Unsupported ${kind} format.` }, { status: 400 });
  if (file.size === 0 || file.size > maxBytes) {
    return NextResponse.json({ error: `${kind === 'photo' ? 'Photo' : 'Video'} is too large.` }, { status: 400 });
  }

  const path = `reviews/${user.id}/${kind}s/${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!reviewMediaBytesMatch(file.type, bytes)) {
    return NextResponse.json({ error: `The selected ${kind} file is invalid.` }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin.storage.from(REVIEW_MEDIA_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    console.error('Review media upload failed:', error.message);
    return NextResponse.json({ error: 'Could not upload this file. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ path }, { status: 201 });
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
    const { error } = await createAdminClient().storage.from(REVIEW_MEDIA_BUCKET).remove(paths as string[]);
    if (error) return NextResponse.json({ error: 'Could not remove review media.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
