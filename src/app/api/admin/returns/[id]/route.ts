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
  const { error } = await db.from('return_requests').update({ status: body.status, admin_notes: body.note?.trim().slice(0, 1000) || null }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from('return_request_events').insert({ return_request_id: id, event_type: 'merchant_update', title: `Request ${body.status.replaceAll('_',' ')}`, description: body.note?.trim().slice(0,1000) || null, metadata: { admin_id: admin.id } });
  return NextResponse.json({ ok: true });
}
