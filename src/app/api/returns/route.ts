import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createReturnRequest } from '@/lib/returns';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const request = await createReturnRequest({
      userId: user.id,
      orderId: body.orderId,
      desiredResolution: 'return_refund',
      reason: body.reason,
      customerNote: body.customerNote,
      mediaUrls: Array.isArray(body.mediaUrls) ? body.mediaUrls : [],
      items: Array.isArray(body.items)
        ? body.items.map((item: { orderItemId?: unknown; quantity?: unknown }) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            itemCondition: 'opened_unused',
          }))
        : [],
    });

    return NextResponse.json({ request });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not create return request' },
      { status: 400 }
    );
  }
}
