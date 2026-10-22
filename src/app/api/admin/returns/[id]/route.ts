import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/admin-access';
import { createAdminClient } from '@/lib/supabase/server';

const STATUSES = new Set(['needs_more_info','approved','rejected','awaiting_customer_shipment','received','inspected','refund_pending','refunded','closed']);

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await context.params;
  const body = await req.json() as { status?: string; note?: string };
  if (!body.status || !STATUSES.has(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  const db = createAdminClient();
  const { error } = await db.rpc('update_return_request_admin' as never, {
    p_request_id: id, p_status: body.status, p_note: body.note?.trim().slice(0, 1000) || '', p_admin_user_id: admin.id,
  } as never);
  if (error && ['42883', 'PGRST202'].includes(error.code ?? '')) return NextResponse.json({ error: 'Return administration is temporarily unavailable during the database upgrade.' }, { status: 503 });
  if (error) return NextResponse.json({ error: 'Return request could not be updated.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
