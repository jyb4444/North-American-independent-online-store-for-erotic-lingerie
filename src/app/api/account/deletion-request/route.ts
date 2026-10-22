import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export async function POST() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createAdminClient();
  const existing = await db.from('account_deletion_requests' as never).select('id').eq('user_id', user.id).in('status', ['requested','processing']).maybeSingle();
  if (existing.error && ['42P01','PGRST205'].includes(existing.error.code ?? '')) return NextResponse.json({ error: 'Account deletion requests are temporarily unavailable.' }, { status: 503 });
  if (existing.data) return NextResponse.json({ ok: true, alreadyRequested: true });
  const { error } = await db.from('account_deletion_requests' as never).insert({ user_id: user.id, email: user.email, status: 'requested' } as never);
  if (error?.code === '23505') return NextResponse.json({ ok: true, alreadyRequested: true });
  if (error && ['42P01','PGRST205'].includes(error.code ?? '')) return NextResponse.json({ error: 'Account deletion requests are temporarily unavailable.' }, { status: 503 });
  if (error) return NextResponse.json({ error: 'Unable to submit deletion request' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
