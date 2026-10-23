import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/admin-access';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null) as { status?: unknown; reason?: unknown; attestation?: unknown } | null;
  if (!body || typeof body.status !== 'string' || !['processing','completed','cancelled'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (body.status === 'completed' && (body.attestation !== 'DELETE COMPLETED' || typeof body.reason !== 'string' || body.reason.trim().length < 20)) {
    return NextResponse.json({ error: 'Completion requires the exact attestation and processing evidence.' }, { status: 400 });
  }
  const { id } = await context.params;
  const { error } = await createAdminClient().rpc('update_account_deletion_request_admin' as never, {
    p_request_id: id, p_status: body.status, p_reason: typeof body.reason === 'string' ? body.reason : '', p_admin_user_id: admin.id,
  } as never);
  if (error) return NextResponse.json({ error: 'Deletion request could not be updated.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
