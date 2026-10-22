import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/admin-access';
import { createAdminClient } from '@/lib/supabase/server';
import { REVIEW_MEDIA_BUCKET, storedReviewMediaPath } from '@/lib/review-media';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await context.params;
  const body = await req.json() as { decision?: string };
  const db = createAdminClient();
  if (body.decision === 'approve') {
    const { error } = await db.from('reviews').update({ approved: true }).eq('id', id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (body.decision === 'reject') {
    const { data } = await db.from('reviews').select('photo_urls,video_urls').eq('id', id).maybeSingle();
    const paths = [...(data?.photo_urls ?? []), ...(data?.video_urls ?? [])]
      .map(storedReviewMediaPath).filter((value): value is string => Boolean(value));
    const { error } = await db.from('reviews').delete().eq('id', id).eq('approved', false);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (paths.length) await db.storage.from(REVIEW_MEDIA_BUCKET).remove(paths);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
}
