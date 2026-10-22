import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/admin-access';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin(); if (!admin) return NextResponse.json({error:'Forbidden'},{status:403});
  const { id } = await context.params; const db = createAdminClient();
  const { data, error } = await db.rpc('retry_shopify_webhook_admin' as never, {p_event_id:id,p_admin_user_id:admin.id} as never);
  if(error)return NextResponse.json({error:'Unable to queue webhook retry.'},{status:503}); if(!data)return NextResponse.json({error:'Webhook is no longer awaiting manual review'},{status:409});
  return NextResponse.json({ok:true});
}
